<script setup lang="ts">
import { ref, computed, watch, onUnmounted } from 'vue'

interface MobilePlan {
  id: number;
  operator: string;
  planName: string;
  price: number;
  dataGb: number;
  score: number;
}

interface Stats {
  totalOffers: number;
  isScraping: boolean;
  lastUpdate: string | null;
}

interface OperatorSettings {
  operatorName: string;
  isFairplay: boolean;
  simPrice: number | null;
}

// Fetch all necessary data (client-only to avoid SSR Docker networking issues)
const { data: stats, refresh: refreshStats } = useFetch<Stats>('http://localhost:3001/api/v1/stats', { default: () => ({ totalOffers: 0, isScraping: false, lastUpdate: null }), server: false, lazy: true })
const { data: deals, refresh: refreshDeals } = useFetch<MobilePlan[]>('http://localhost:3001/api/v1/deals', { default: () => [], server: false, lazy: true })
const { data: operators, refresh: refreshOperators } = useFetch<OperatorSettings[]>('http://localhost:3001/api/v1/operators', { default: () => [], server: false, lazy: true })

// Loading states
const isScrapingAction = ref(false)
const isClearingAction = ref(false)
const notification = ref({ show: false, message: '', type: 'success' })

// Auto-polling: refresh stats & deals every 5 seconds while scraping is active
let pollingInterval: ReturnType<typeof setInterval> | null = null

const startPolling = () => {
  if (pollingInterval) return
  pollingInterval = setInterval(async () => {
    await refreshStats()
    if (!stats.value.isScraping) {
      // Scraping finished — do a final refresh and stop polling
      await refreshDeals()
      await refreshOperators()
      stopPolling()
      showNotification('Scraping terminé ! Les forfaits sont à jour.', 'success')
    }
  }, 5000)
}

const stopPolling = () => {
  if (pollingInterval) {
    clearInterval(pollingInterval)
    pollingInterval = null
  }
}

// Watch stats to auto-start polling if scraping is detected (e.g. on page load)
watch(() => stats.value?.isScraping, (isScraping) => {
  if (isScraping) startPolling()
}, { immediate: true })

onUnmounted(() => stopPolling())

// Track which operator's sim price is being edited
const editingSimPrice = ref<Record<string, string>>({})

// Helper to get operator sim price
const getOperatorSimPrice = (operatorName: string): number | null => {
  const op = operators.value?.find(o => o.operatorName === operatorName)
  return op?.simPrice ?? null
}

const showNotification = (msg: string, type: 'success' | 'error' = 'success') => {
  notification.value = { show: true, message: msg, type }
  setTimeout(() => { notification.value.show = false }, 5000)
}

// Actions
const triggerScrape = async () => {
  if (isScrapingAction.value || stats.value.isScraping) return
  isScrapingAction.value = true
  
  try {
    const res = await $fetch('/api/v1/scrape', { baseURL: 'http://localhost:3001', method: 'POST' }).catch((e) => e.data)
    if (res && res.message) {
      showNotification(res.message, 'success')
      await refreshStats()
      startPolling()
    }
  } catch (error) {
    showNotification("Erreur lors du lancement du scraper.", 'error')
  } finally {
    isScrapingAction.value = false
  }
}

const clearDB = async () => {
  if (!confirm("VOULEZ-VOUS VRAIMENT TOUT DÉTRUIRE ?")) return
  isClearingAction.value = true
  
  try {
    await $fetch('http://localhost:3001/api/v1/clear', { method: 'DELETE' })
    showNotification("Base de données détruite avec succès.", 'success')
    refreshStats()
    refreshDeals()
  } catch (error) {
    showNotification("Erreur lors de la suppression.", 'error')
  } finally {
    isClearingAction.value = false
  }
}

const toggleFairplay = async (operatorName: string, currentState: boolean) => {
  try {
    const newState = !currentState
    await $fetch(`http://localhost:3001/api/v1/operators/${encodeURIComponent(operatorName)}/fairplay`, {
      method: 'PUT',
      body: { isFairplay: newState }
    })
    showNotification(`${operatorName} → ${newState ? 'Fairplay ✓' : 'Signalé frauduleux ⚠️'}`, 'success')
    refreshOperators()
  } catch (err) {
    showNotification("Erreur lors de la modification du statut", 'error')
  }
}

const startEditSimPrice = (operatorName: string) => {
  editingSimPrice.value[operatorName] = (getOperatorSimPrice(operatorName) ?? 10).toString()
}

const saveSimPrice = async (operatorName: string) => {
  const val = editingSimPrice.value[operatorName]
  try {
    await $fetch(`http://localhost:3001/api/v1/operators/${encodeURIComponent(operatorName)}/simprice`, {
      method: 'PUT',
      body: { simPrice: val ? parseFloat(val) : null }
    })
    showNotification(`Prix SIM ${operatorName} mis à jour : ${val}€`, 'success')
    delete editingSimPrice.value[operatorName]
    refreshOperators()
  } catch (err) {
    showNotification("Erreur lors de la sauvegarde du prix SIM", 'error')
  }
}

const cancelEditSimPrice = (operatorName: string) => {
  delete editingSimPrice.value[operatorName]
}

// Formatters
const formattedDate = computed(() => {
  if (!stats.value?.lastUpdate) return 'Jamais'
  return new Date(stats.value.lastUpdate).toLocaleString('fr-FR', { dateStyle: 'long', timeStyle: 'short' })
})

const dealsByOperator = computed(() => {
  if (!deals.value) return {}
  return deals.value.reduce((acc: Record<string, MobilePlan[]>, deal) => {
    if (!acc[deal.operator]) acc[deal.operator] = []
    acc[deal.operator].push(deal)
    return acc
  }, {})
})
</script>

<template>
  <div class="min-h-screen bg-background relative overflow-x-hidden pb-32">
    <!-- Notification Toast -->
    <div 
      v-if="notification.show"
      :class="[
        'fixed top-6 right-6 z-50 px-6 py-4 border-4 border-black shadow-neo-lg transition-transform font-bold text-lg',
        notification.type === 'error' ? 'bg-destructive text-white' : 'bg-primary text-black transform rotate-2'
      ]"
    >
      {{ notification.message }}
    </div>

    <!-- Admin Header -->
    <header class="bg-black text-white py-12 px-4 border-b-8 border-accent mb-16">
      <div class="container mx-auto max-w-5xl flex flex-col md:flex-row md:items-end md:justify-between gap-6">
        <div>
          <div class="bg-accent text-white px-3 py-1 inline-block border-2 border-white mb-4 font-bold uppercase tracking-widest text-sm shadow-[4px_4px_0_0_white] transform -rotate-2">
            Zone Restreinte
          </div>
          <h1 class="text-5xl md:text-7xl font-black uppercase tracking-tighter">
            Control <br/> Room
          </h1>
        </div>
        
        <div class="flex items-center gap-4">
          <NuxtLink to="/" class="neo-button bg-white text-black border-white shadow-[4px_4px_0_0_#4F46E5]">
            ← Retour au site
          </NuxtLink>
        </div>
      </div>
    </header>

    <main class="container mx-auto px-4 max-w-5xl flex flex-col gap-12">
      
      <!-- Stats Dashboards -->
      <div class="grid md:grid-cols-2 gap-8">
        
        <!-- Db Status -->
        <div class="neo-box bg-white p-8 md:p-12 relative overflow-hidden group hover:bg-secondary transition-colors">
          <div class="bg-black text-white px-3 py-1 inline-block font-bold uppercase text-xs mb-8">
            Inventaire
          </div>
          <p class="text-8xl font-black text-black mb-4">{{ stats?.totalOffers || 0 }}</p>
          <h2 class="text-2xl font-bold uppercase tracking-wider mb-8">Offres Actives</h2>
          <div class="pt-4 border-t-4 border-black font-bold flex flex-col">
            <span class="text-muted-foreground uppercase text-xs">Dernière extraction</span>
            <span class="text-xl">{{ formattedDate }}</span>
          </div>
        </div>

        <!-- Scraper Status -->
        <div :class="['neo-box p-8 md:p-12 relative overflow-hidden', stats?.isScraping ? 'bg-primary' : 'bg-white']">
          <div class="bg-black text-white px-3 py-1 inline-block font-bold uppercase text-xs mb-8">
            Processus Robot
          </div>
           
          <div class="flex items-center gap-6 mb-8">
            <div :class="['w-8 h-8 border-4 border-black rounded-full', stats?.isScraping ? 'bg-destructive animate-pulse' : 'bg-green-500']"></div>
            <p class="text-3xl md:text-4xl font-black uppercase leading-tight">
              {{ stats?.isScraping ? "Scraping en cours..." : "En veille" }}
            </p>
          </div>

          <p class="text-lg font-bold border-l-4 border-black pl-4 my-8">
            Planification: Cron <code class="bg-black text-white px-2 py-1 ml-1">0 * * * *</code>
          </p>

          <button 
            @click="triggerScrape" 
            :disabled="isScrapingAction || stats?.isScraping"
            class="w-full neo-button bg-black text-white hover:bg-accent hover:text-white border-black"
          >
            Lancer l'extraction maintenant
          </button>
        </div>
      </div>

      <!-- Danger Zone -->
      <div class="neo-box bg-white p-8 md:p-12 flex flex-col md:flex-row items-center gap-8 justify-between">
        <div>
          <h2 class="text-2xl font-black uppercase flex items-center gap-3 mb-2">
            <span class="bg-destructive text-white p-1 border-2 border-black">⚠</span>
            Bouton Rouge
          </h2>
          <p class="font-bold text-lg">Supprime l'intégralité de la base de données. Irréversible.</p>
        </div>
        <button 
          @click="clearDB" 
          :disabled="isClearingAction"
          class="neo-button bg-destructive text-white hover:bg-red-600 border-black text-xl whitespace-nowrap"
        >
          Détruire la base
        </button>
      </div>

      <!-- ===================== -->
      <!-- DEALS DETAIL TABLE -->
      <!-- ===================== -->
      <div>
        <h2 class="text-4xl font-black uppercase mb-8 border-b-8 border-black pb-4 inline-block">Forfaits & Prix SIM</h2>
        
        <div v-if="Object.keys(dealsByOperator).length === 0" class="neo-box bg-white p-12 text-center text-xl font-bold uppercase">
          Aucune offre. Lancez un scraping d'abord.
        </div>

        <div v-for="(operatorDeals, operatorName) in dealsByOperator" :key="operatorName" class="neo-box bg-white mb-8">
          
          <!-- Operator Header Row -->
          <div class="flex flex-col md:flex-row items-start md:items-center justify-between p-4 md:p-6 bg-muted border-b-4 border-black gap-4">
            <div class="flex items-center gap-4">
              <h3 class="text-2xl md:text-3xl font-black uppercase">{{ operatorName }}</h3>
              <span class="bg-black text-white px-2 py-1 text-xs font-bold">{{ operatorDeals.length }} offres</span>
            </div>
            <div class="flex items-center gap-4 flex-wrap">
              <!-- SIM Price per operator -->
              <div class="flex items-center gap-2">
                <span class="font-bold text-sm uppercase">Prix SIM :</span>
                <div v-if="editingSimPrice[operatorName as string] === undefined" class="flex items-center gap-2">
                  <span class="bg-white border-2 border-black px-3 py-1 font-bold">{{ getOperatorSimPrice(operatorName as string) !== null ? getOperatorSimPrice(operatorName as string) + '€' : '10€ (défaut)' }}</span>
                  <button 
                    @click="startEditSimPrice(operatorName as string)" 
                    class="bg-white border-2 border-black px-2 py-1 text-xs font-bold uppercase shadow-neo-hover hover:bg-primary transition-colors"
                  >✏️</button>
                </div>
                <div v-else class="flex items-center gap-2">
                  <input 
                    v-model="editingSimPrice[operatorName as string]" 
                    type="number" step="0.01" min="0"
                    class="w-20 px-2 py-1 border-2 border-black text-center font-bold bg-white focus:outline-none focus:ring-2 focus:ring-primary"
                    @keyup.enter="saveSimPrice(operatorName as string)"
                    @keyup.escape="cancelEditSimPrice(operatorName as string)"
                  />
                  <span class="font-bold">€</span>
                  <button @click="saveSimPrice(operatorName as string)" class="bg-primary border-2 border-black px-2 py-1 text-xs font-bold shadow-neo-hover">✓</button>
                  <button @click="cancelEditSimPrice(operatorName as string)" class="bg-white border-2 border-black px-2 py-1 text-xs font-bold shadow-neo-hover hover:bg-destructive hover:text-white">✕</button>
                </div>
              </div>
              <button 
                @click="toggleFairplay(operatorName as string, operators?.find(o => o.operatorName === operatorName)?.isFairplay ?? true)"
                class="neo-button px-4 py-2 text-sm border-black"
                :class="operators?.find(o => o.operatorName === operatorName)?.isFairplay === false ? 'bg-primary text-black' : 'bg-white text-black hover:bg-destructive hover:text-white'"
              >
                {{ operators?.find(o => o.operatorName === operatorName)?.isFairplay === false ? '⚠ Frauduleux (Rétablir)' : '✓ Fairplay (Signaler)' }}
              </button>
            </div>
          </div>
          
          <!-- Deals Table -->
          <table class="w-full text-left border-collapse">
            <thead>
              <tr class="border-b-4 border-black text-xs uppercase tracking-wider bg-white">
                <th class="p-3 md:p-4 font-black border-r-2 border-black">Forfait</th>
                <th class="p-3 md:p-4 font-black border-r-2 border-black text-center">Data</th>
                <th class="p-3 md:p-4 font-black border-r-2 border-black text-center">Prix/mois</th>
                <th class="p-3 md:p-4 font-black text-center">€/Go</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="deal in operatorDeals" :key="deal.id" class="border-b-2 border-black last:border-0 hover:bg-primary/10 transition-colors">
                <td class="p-3 md:p-4 font-bold text-lg border-r-2 border-black">{{ deal.planName }}</td>
                <td class="p-3 md:p-4 text-center font-bold border-r-2 border-black">
                  <span class="bg-secondary border-2 border-black px-2 py-0.5 text-sm">{{ deal.dataGb }} Go</span>
                </td>
                <td class="p-3 md:p-4 text-center font-black text-xl border-r-2 border-black">{{ deal.price.toFixed(2) }}€</td>
                <td class="p-3 md:p-4 text-center font-mono text-sm">
                  {{ deal.score ? deal.score.toFixed(3) : '—' }}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

    </main>
  </div>
</template>
