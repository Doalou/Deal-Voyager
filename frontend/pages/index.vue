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
  simPrice: number;
  dataGb: number;
  calls: string;
  sms: string;
  network: string;
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

// Fetch data (client-only to avoid SSR Docker networking issues)
const { data: deals, pending: pendingDeals } = useFetch<MobilePlan[]>('http://localhost:3001/api/v1/deals', { default: () => [], server: false, lazy: true })
const { data: operators } = useFetch<OperatorSettings[]>('http://localhost:3001/api/v1/operators', { default: () => [], server: false, lazy: true })

// State
const targetDataGb = ref(20)

// Helper: check if operator is flagged
const isFairplay = (operatorName: string) => {
  const op = operators.value?.find(o => o.operatorName === operatorName)
  return op ? op.isFairplay : true // True by default
}

// Helper: get operator sim price
const getSimPrice = (operatorName: string): number => {
  const op = operators.value?.find(o => o.operatorName === operatorName)
  return op?.simPrice ?? 10 // 10€ by default
}

const getActivationPrice = (operatorName: string): number => {
  const op = operators.value?.find(o => o.operatorName === operatorName)
  return op?.activationPrice ?? 0
}

const getCancellationPrice = (operatorName: string): number => {
  const op = operators.value?.find(o => o.operatorName === operatorName)
  return op?.cancellationPrice ?? 0
}

// Computed: Filtered deals
const filteredDeals = computed(() => {
  if (!deals.value) return []
  // If slider is at 0, show all deals sorted by price
  if (targetDataGb.value === 0) {
    return [...deals.value].sort((a, b) => a.price - b.price)
  }
  return deals.value
    .filter(d => d.dataGb >= targetDataGb.value)
    .sort((a, b) => {
      const costA = (a.price * 12) + getSimPrice(a.operator) + getActivationPrice(a.operator) + getCancellationPrice(a.operator);
      const costB = (b.price * 12) + getSimPrice(b.operator) + getActivationPrice(b.operator) + getCancellationPrice(b.operator);
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
</script>

<template>
  <div class="min-h-screen bg-background relative overflow-x-hidden pb-32">
    <!-- Grid pattern background via global CSS -->
    
    <HeroSection />

    <main class="container mx-auto px-4 relative z-10 flex flex-col items-center">
      
      <DataSlider v-model="targetDataGb" />

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
            :sim-price="getSimPrice(starOffer.operator)"
            :activation-price="getActivationPrice(starOffer.operator)"
            :cancellation-price="getCancellationPrice(starOffer.operator)"
          />
        </div>

        <!-- Alternatives -->
        <div v-if="otherOffers.length > 0">
          <div class="inline-block bg-foreground text-background px-4 py-2 font-bold uppercase tracking-widest mb-8 border-l-8 border-secondary">
            Alternatives Solides
          </div>
          
          <div class="grid md:grid-cols-3 gap-8">
            <DealCard 
              v-for="deal in otherOffers" 
              :key="deal.id" 
              :deal="deal" 
              :is-fairplay="isFairplay(deal.operator)" 
              :is-star-offer="false"
              :sim-price="getSimPrice(deal.operator)"
              :activation-price="getActivationPrice(deal.operator)"
              :cancellation-price="getCancellationPrice(deal.operator)"
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
          Il n'y a actuellement aucune offre qui correspond à <span class="bg-secondary px-1 font-bold border-2 border-border text-secondary-foreground">{{ targetDataGb }} Go</span>. Essayez de baisser vos critères ou relancez un scraping.
        </p>
      </div>

    </main>

    <!-- Section Méthodologie -->
    <section class="container mx-auto px-4 mt-24 mb-16 relative z-10">
      <div class="neo-box bg-card p-8 md:p-12 border-4 border-border text-card-foreground">
        <h2 class="text-3xl md:text-4xl font-black uppercase mb-6 border-b-8 border-border pb-4 inline-block">Notre Méthodologie</h2>
        <div class="grid md:grid-cols-2 gap-8 text-lg font-medium">
          <div>
            <div class="flex items-start gap-4 mb-6">
              <div class="bg-primary text-primary-foreground font-black text-xl w-10 h-10 flex items-center justify-center flex-shrink-0 border-2 border-border shadow-neo">1</div>
              <div>
                <h3 class="font-bold text-xl uppercase mb-2">Le Coût Réel (1 an)</h3>
                <p>Nous ne nous laissons pas duper par les prix d'appel. Notre algorithme calcule le coût total sur la première année, incluant obligatoirement le forfait mensuel, le coût de la carte SIM, les éventuels frais d'activation et de résiliation.</p>
              </div>
            </div>
            <div class="flex items-start gap-4">
              <div class="bg-secondary text-secondary-foreground font-black text-xl w-10 h-10 flex items-center justify-center flex-shrink-0 border-2 border-border shadow-neo">2</div>
              <div>
                <h3 class="font-bold text-xl uppercase mb-2">Le Filtre Data Intransigeant</h3>
                <p>Lorsque vous réglez votre besoin en gigaoctets, notre système élimine instantanément toute offre inférieure et réordonne purement par le coût annuel le plus bas. L'offre star est mathématiquement la moins chère.</p>
              </div>
            </div>
          </div>
          <div>
            <div class="flex items-start gap-4 mb-6">
              <div class="bg-accent text-accent-foreground font-black text-xl w-10 h-10 flex items-center justify-center flex-shrink-0 border-2 border-border shadow-neo">3</div>
              <div>
                <h3 class="font-bold text-xl uppercase mb-2">Indépendance Totale</h3>
                <p>Nos robots (scrapers) parcourent les sites des opérateurs plusieurs fois par jour pour récupérer les vrais prix en direct. Zéro sponsoring, zéro manipulation : 100% data brute.</p>
              </div>
            </div>
            <div class="flex items-start gap-4">
              <div class="bg-destructive text-destructive-foreground font-black text-xl w-10 h-10 flex items-center justify-center flex-shrink-0 border-2 border-border shadow-neo">4</div>
              <div>
                <h3 class="font-bold text-xl uppercase mb-2">Le Label "Fairplay"</h3>
                <p>Un opérateur est coutumier des augmentations de tarifs sauvages en cours d'année ? Nous lui retirons son label Fairplay. Un badge d'alerte s'affiche pour vous prévenir du risque de hausse.</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>

  </div>
</template>
