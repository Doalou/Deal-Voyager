<script setup lang="ts">
import { ref, computed } from 'vue'

// Components
import HeroSection from '../components/HeroSection.vue'
import DataSlider from '../components/DataSlider.vue'
import DealCard from '../components/DealCard.vue'

// Types
interface MobilePlan {
  id: number;
  operator: string;
  planName: string;
  price: number;
  simPrice: number | null;
  activationPrice: number | null;
  cancellationPrice: number | null;
  dataGb: number;
  calls: string;
  sms: string;
  network: string;
  networkGeneration: string;
  dataEuGb: number | null;
  score: number;
  url: string;
}

interface OperatorSettings {
  operatorName: string;
  isFairplay: boolean;
  simPrice: number | null;
  activationPrice: number | null;
  cancellationPrice: number | null;
}

const { data: deals, pending: pendingDeals } = useFetch<MobilePlan[]>('/api/v1/deals', { default: () => [], server: false, lazy: true })
const { data: operators } = useFetch<OperatorSettings[]>('/api/v1/operators', { default: () => [], server: false, lazy: true })

// State
const targetDataGb = ref(20)
const targetNetworks = ref<string[]>(['Orange', 'Bouygues', 'SFR', 'Free'])
const activeCategory = ref<'mobile' | 'box'>('mobile')

// Helper: check if operator is flagged
const isFairplay = (operatorName: string) => {
  const op = operators.value?.find((o: OperatorSettings) => o.operatorName === operatorName)
  return op ? op.isFairplay : true // True by default
}

const getFee = (deal: MobilePlan, field: 'simPrice' | 'activationPrice' | 'cancellationPrice'): number | null => {
  const settings = operators.value?.find((operator: OperatorSettings) => operator.operatorName === deal.operator)
  return settings?.[field] ?? deal[field] ?? null
}

const unknownFeeCount = (deal: MobilePlan) => (
  ['simPrice', 'activationPrice', 'cancellationPrice'] as const
).filter(field => getFee(deal, field) == null).length

// Computed: Filtered deals
const filteredDeals = computed(() => {
  if (!deals.value) return []
  // If slider is at 0, show all deals sorted by price
  if (targetDataGb.value === 0) {
    return [...deals.value].sort((a, b) => a.price - b.price)
  }
  return deals.value
    .filter((d: MobilePlan) => d.dataGb >= targetDataGb.value)
    .filter((d: MobilePlan) => targetNetworks.value.length > 0 && targetNetworks.value.some(net => d.network?.toLowerCase().includes(net.toLowerCase())))
    .sort((a: MobilePlan, b: MobilePlan) => {
      const missingFeeDifference = unknownFeeCount(a) - unknownFeeCount(b)
      if (missingFeeDifference !== 0) return missingFeeDifference
      const costA = (a.price * 12) + (getFee(a, 'simPrice') ?? 0) + (getFee(a, 'activationPrice') ?? 0) + (getFee(a, 'cancellationPrice') ?? 0);
      const costB = (b.price * 12) + (getFee(b, 'simPrice') ?? 0) + (getFee(b, 'activationPrice') ?? 0) + (getFee(b, 'cancellationPrice') ?? 0);
      if (costA === costB) return b.dataGb - a.dataGb;
      return costA - costB;
    })
})

const starOffer = computed(() => filteredDeals.value.length > 0 ? filteredDeals.value[0] : null)
const showAllDeals = ref(false)
const otherOffers = computed(() => {
  const rest = filteredDeals.value.slice(1)
  return showAllDeals.value ? rest : rest.slice(0, 3)
})
const hasMoreDeals = computed(() => filteredDeals.value.length > 4)

const config = useRuntimeConfig()

if (import.meta.dev) {
  console.log('[DEBUG Discord] discordClientId from runtimeConfig:', config.public.discordClientId)
}

const discordInviteUrl = computed(() => {
  const clientId = config.public.discordClientId
  if (!clientId) {
    console.warn('[Deal-Voyager] NUXT_PUBLIC_DISCORD_CLIENT_ID is not set - Discord invite link disabled.')
    return ''
  }
  const scope = encodeURIComponent('bot applications.commands')
  return `https://discord.com/oauth2/authorize?client_id=${clientId}&scope=${scope}&permissions=19456`
})
const isDiscordConfigured = computed(() => !!config.public.discordClientId)
</script>

<template>
  <div class="min-h-screen bg-background relative overflow-x-hidden pb-32">
    <!-- Grid pattern background via global CSS -->

    <HeroSection />

    <main class="container mx-auto px-4 relative z-10 flex flex-col items-center">

      <!-- Sélecteur Forfaits Mobiles / Box Opérateurs -->
      <div class="flex gap-4 mb-8 w-full max-w-5xl justify-center">
        <button
          @click="activeCategory = 'mobile'"
          :class="[
            'neo-button text-lg px-8 py-3 font-black uppercase border-4 border-border transition-all',
            activeCategory === 'mobile'
              ? 'bg-primary text-primary-foreground shadow-neo transform -rotate-1'
              : 'bg-card text-card-foreground hover:bg-muted'
          ]"
        >
          📱 Forfaits Mobiles
        </button>
        <button
          disabled
          class="neo-button text-lg px-8 py-3 font-black uppercase border-4 border-border bg-muted text-muted-foreground cursor-not-allowed opacity-60 relative"
        >
          📦 Box Opérateurs
          <span class="absolute -top-3 -right-3 bg-accent text-accent-foreground text-xs font-black px-2 py-0.5 border-2 border-border shadow-neo rotate-6">
            SOON
          </span>
        </button>
      </div>

      <DataSlider v-model="targetDataGb" v-model:networks="targetNetworks" />

      <!-- Dynamic Data Section (Client-only to prevent hydration mismatch) -->
      <ClientOnly>
        <!-- Loading State -->
        <div v-if="pendingDeals" class="w-full max-w-5xl py-24 flex justify-center">
          <div class="bg-primary text-primary-foreground font-black text-2xl border-4 border-border px-6 py-4 shadow-neo animate-pulse transform -rotate-2">
            Recherche des meilleures offres...
          </div>
        </div>

        <!-- Results Section -->
        <div v-else-if="filteredDeals.length > 0" class="w-full max-w-5xl">

          <!-- L'OFFRE STAR -->
          <div v-if="starOffer" class="mb-16">
            <DealCard
              :deal="starOffer"
              :is-fairplay="isFairplay(starOffer.operator)"
              :is-star-offer="true"
              :sim-price="getFee(starOffer, 'simPrice')"
              :activation-price="getFee(starOffer, 'activationPrice')"
              :cancellation-price="getFee(starOffer, 'cancellationPrice')"
            />
          </div>

          <!-- Alternatives -->
          <div v-if="otherOffers.length > 0">
            <div class="inline-block bg-foreground text-background px-4 py-2 font-bold uppercase tracking-widest mb-8 border-l-8 border-secondary">
              Alternatives Solides
            </div>

            <div class="grid md:grid-cols-3 gap-6 md:gap-8">
              <DealCard
                v-for="deal in otherOffers"
                :key="deal.id"
                :deal="deal"
                :is-fairplay="isFairplay(deal.operator)"
                :is-star-offer="false"
                :sim-price="getFee(deal, 'simPrice')"
                :activation-price="getFee(deal, 'activationPrice')"
                :cancellation-price="getFee(deal, 'cancellationPrice')"
              />
            </div>

            <!-- See All / Collapse Button -->
            <div v-if="hasMoreDeals" class="flex justify-center mt-12">
              <button
                @click="showAllDeals = !showAllDeals"
                class="neo-button bg-card text-card-foreground hover:bg-primary hover:text-primary-foreground text-xl px-12 py-4 transform hover:-rotate-1"
              >
                <span v-if="!showAllDeals">📋 Voir les {{ filteredDeals.length - 4 }} autres forfaits</span>
                <span v-else>↑ Réduire la liste</span>
              </button>
            </div>
          </div>

        </div>

        <!-- Empty State -->
        <div v-else class="w-full max-w-2xl text-center py-24 neo-box p-12 bg-card">
          <div class="w-24 h-24 bg-muted border-4 border-border shadow-neo mx-auto mb-8 flex items-center justify-center transform rotate-12 text-muted-foreground">
            <svg xmlns="http://www.w3.org/2000/svg" class="h-12 w-12" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="square" stroke-linejoin="miter" stroke-width="3" d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
          </div>
          <h3 class="text-3xl font-black uppercase mb-4 text-card-foreground">Aïe, c'est désert !</h3>
          <p class="text-xl font-medium border-l-4 border-border pl-4 text-left inline-block text-card-foreground">
            Il n'y a actuellement aucune offre qui correspond à <span class="bg-secondary px-1 font-bold border-2 border-border text-secondary-foreground">{{ targetDataGb }} Go</span><span v-if="targetNetworks.length < 4"> sur les réseaux sélectionnés</span>. Essayez de baisser vos critères, d'activer plus de réseaux, ou contactez un administrateur.
          </p>
        </div>
      </ClientOnly>

    </main>

    <!-- Section Promotion Discord -->
    <section class="container mx-auto px-4 mt-24 relative z-10 flex justify-center">
      <div class="neo-box bg-[#5865F2] text-white p-8 md:p-12 w-full max-w-5xl border-4 border-black shadow-neo transform -rotate-1 hover:rotate-0 transition-transform duration-300">
        <div class="grid md:grid-cols-12 gap-8 items-center">
          <!-- Colonne Gauche - Texte -->
          <div class="md:col-span-7 text-left space-y-4">
            <span class="inline-block bg-yellow-400 text-black font-black text-xs uppercase px-2.5 py-1 border-2 border-black tracking-wider transform -rotate-2">
              🔌 BOT DISCORD
            </span>
            <h2 class="text-3xl md:text-5xl font-black uppercase tracking-tight drop-shadow-md">
              Ne ratez plus aucun deal ! 🚀
            </h2>
            <p class="text-lg md:text-xl font-medium leading-relaxed opacity-95">
              Le marché des télécoms change constamment. Ajoutez notre robot comparateur sur votre serveur pour recevoir des alertes <strong>en temps réel</strong> dès qu'un forfait baisse de prix ou qu'une nouvelle offre est détectée !
            </p>
          </div>

          <!-- Colonne Droite - Capture & CTA -->
          <div class="md:col-span-5 flex flex-col items-center justify-center">
            <!-- Capture d'écran Réelle du Bot Discord -->
            <div class="w-full border-4 border-black rounded-none overflow-hidden shadow-neo mb-6 transform rotate-1 hover:rotate-0 transition-transform bg-[#313338]">
              <img
                src="/images/discord.png"
                alt="Aperçu des alertes du Bot Discord Deal Voyager"
                class="w-full h-auto object-cover"
              />
            </div>

            <!-- Bouton d'invitation -->
            <div class="w-full">
              <a
                v-if="isDiscordConfigured"
                :href="discordInviteUrl"
                target="_blank"
                rel="noopener noreferrer"
                class="w-full inline-block text-center bg-yellow-400 text-black font-black text-xl uppercase py-4 border-4 border-black shadow-neo hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-neo-hover transition-all"
              >
                🤖 Inviter le Bot
              </a>
              <span
                v-else
                class="w-full inline-block text-center bg-gray-300 text-gray-600 font-black text-xl uppercase py-4 border-4 border-black shadow-neo cursor-not-allowed opacity-70"
                title="Le lien d'invitation Discord n'est pas configuré (DISCORD_CLIENT_ID manquant)."
              >
                🤖 Bot non configuré
              </span>
            </div>
          </div>
        </div>
      </div>
    </section>

    <!-- Section Méthodologie -->
    <section class="container mx-auto px-4 mt-24 mb-16 relative z-10 text-center">
      <div class="inline-block transform -rotate-1 mb-10">
        <h2 class="text-3xl md:text-5xl font-black uppercase tracking-tight text-foreground bg-card px-6 py-3 border-4 border-border shadow-neo">
          Notre Méthodologie
        </h2>
      </div>

      <div class="grid md:grid-cols-2 lg:grid-cols-4 gap-6 text-left">
        <!-- Carte 1 -->
        <div class="neo-box bg-yellow-100 text-black p-6 border-4 border-black shadow-neo flex flex-col justify-between hover:scale-102 hover:rotate-1 transition-all duration-200">
          <div>
            <div class="bg-yellow-400 text-black font-black text-xl w-10 h-10 flex items-center justify-center border-2 border-black shadow-neo mb-4 transform -rotate-6">
              1
            </div>
            <h3 class="font-black text-xl uppercase mb-3 leading-tight text-black">Le Coût Réel</h3>
          </div>
          <p class="font-medium text-black">Fini les mauvaises surprises. On calcule pour vous le vrai coût sur la première année, en incluant le forfait, la carte SIM et les frais d'activation et de résiliation.</p>
        </div>

        <!-- Carte 2 -->
        <div class="neo-box bg-emerald-100 text-black p-6 border-4 border-black shadow-neo flex flex-col justify-between hover:scale-102 hover:-rotate-1 transition-all duration-200">
          <div>
            <div class="bg-emerald-400 text-black font-black text-xl w-10 h-10 flex items-center justify-center border-2 border-black shadow-neo mb-4 transform rotate-6">
              2
            </div>
            <h3 class="font-black text-xl uppercase mb-3 leading-tight text-black">Le Juste Prix</h3>
          </div>
          <p class="font-medium text-black">Indiquez vos besoins en gigas et on élimine d'office les offres hors-sujet. Vous ne voyez que ce qui est optimal et économique pour vous.</p>
        </div>

        <!-- Carte 3 -->
        <div class="neo-box bg-cyan-100 text-black p-6 border-4 border-black shadow-neo flex flex-col justify-between hover:scale-102 hover:rotate-1 transition-all duration-200">
          <div>
            <div class="bg-cyan-400 text-black font-black text-xl w-10 h-10 flex items-center justify-center border-2 border-black shadow-neo mb-4 transform -rotate-6">
              3
            </div>
            <h3 class="font-black text-xl uppercase mb-3 leading-tight text-black">100% Neutre</h3>
          </div>
          <p class="font-medium text-black">Nos scrapers parcourent les sites des opérateurs quotidiennement. Aucun lien affilié caché, aucun traitement de faveur : juste la réalité du marché.</p>
        </div>

        <!-- Carte 4 -->
        <div class="neo-box bg-rose-100 text-black p-6 border-4 border-black shadow-neo flex flex-col justify-between hover:scale-102 hover:-rotate-1 transition-all duration-200">
          <div>
            <div class="bg-rose-400 text-black font-black text-xl w-10 h-10 flex items-center justify-center border-2 border-black shadow-neo mb-4 transform rotate-6">
              4
            </div>
            <h3 class="font-black text-xl uppercase mb-3 leading-tight text-black">Label Fairplay</h3>
          </div>
          <p class="font-medium text-black">Si un opérateur a l'habitude de pratiquer des augmentations surprises après quelques mois, nous lui retirons son label de confiance pour vous protéger.</p>
        </div>
      </div>
    </section>

  </div>
</template>
