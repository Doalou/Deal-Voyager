<script setup lang="ts">
import { ref, computed, watch, onUnmounted } from 'vue'

definePageMeta({
  middleware: 'auth'
})

interface MobilePlan {
  id: number;
  operator: string;
  planName: string;
  price: number;
  dataGb: number;
  networkGeneration: string;
  dataEuGb: number | null;
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
  activationPrice: number | null;
  cancellationPrice: number | null;
}

const authToken = useState<string | null>('authToken')

const authHeaders = computed(() => {
  if (!authToken.value) return {}
  return { Authorization: authToken.value }
})

const { data: stats, refresh: refreshStats } = useFetch<Stats>('/api/v1/stats', { default: () => ({ totalOffers: 0, isScraping: false, lastUpdate: null }), server: false, lazy: true })
const { data: deals, refresh: refreshDeals } = useFetch<MobilePlan[]>('/api/v1/deals', { default: () => [], server: false, lazy: true })
const { data: operators, refresh: refreshOperators } = useFetch<OperatorSettings[]>('/api/v1/operators', { default: () => [], server: false, lazy: true })

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
const editingActivationPrice = ref<Record<string, string>>({})
const editingCancellationPrice = ref<Record<string, string>>({})

// Helper to get operator sim price
const getOperatorSimPrice = (operatorName: string): number | null => {
  const op = operators.value?.find(o => o.operatorName === operatorName)
  return op?.simPrice ?? null
}

const getOperatorActivationPrice = (operatorName: string): number | null => {
  const op = operators.value?.find(o => o.operatorName === operatorName)
  return op?.activationPrice ?? null
}

const getOperatorCancellationPrice = (operatorName: string): number | null => {
  const op = operators.value?.find(o => o.operatorName === operatorName)
  return op?.cancellationPrice ?? null
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
    const res = await $fetch('/api/v1/scrape', { 
        method: 'POST',
        headers: authHeaders.value
    }).catch((e) => e.data)
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
    await $fetch('/api/v1/clear', { 
        method: 'DELETE',
        headers: authHeaders.value 
    })
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
    await $fetch(`/api/v1/operators/${encodeURIComponent(operatorName)}/fairplay`, {
      method: 'PUT',
      headers: authHeaders.value,
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
  editingActivationPrice.value[operatorName] = (getOperatorActivationPrice(operatorName) ?? 0).toString()
  editingCancellationPrice.value[operatorName] = (getOperatorCancellationPrice(operatorName) ?? 0).toString()
}

const saveSimPrice = async (operatorName: string) => {
  const sim = editingSimPrice.value[operatorName]
  const act = editingActivationPrice.value[operatorName]
  const canc = editingCancellationPrice.value[operatorName]
  
  try {
    await $fetch(`/api/v1/operators/${encodeURIComponent(operatorName)}/simprice`, {
      method: 'PUT',
      headers: authHeaders.value,
      body: { 
        simPrice: sim ? parseFloat(sim) : null,
        activationPrice: act ? parseFloat(act) : null,
        cancellationPrice: canc ? parseFloat(canc) : null
      }
    })
    showNotification(`Frais ${operatorName} mis à jour!`, 'success')
    delete editingSimPrice.value[operatorName]
    delete editingActivationPrice.value[operatorName]
    delete editingCancellationPrice.value[operatorName]
    refreshOperators()
  } catch (err) {
    showNotification("Erreur lors de la sauvegarde des frais", 'error')
  }
}

const cancelEditSimPrice = (operatorName: string) => {
  delete editingSimPrice.value[operatorName]
  delete editingActivationPrice.value[operatorName]
  delete editingCancellationPrice.value[operatorName]
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
        'fixed top-6 right-6 z-50 px-6 py-4 border-4 border-border shadow-neo-lg transition-transform font-bold text-lg',
        notification.type === 'error' ? 'bg-destructive text-destructive-foreground' : 'bg-primary text-primary-foreground transform rotate-2'
      ]"
    >
      {{ notification.message }}
    </div>

    <!-- Admin Header -->
    <header class="bg-foreground text-background py-12 px-4 border-b-8 border-accent mb-16">
      <div class="container mx-auto max-w-5xl flex flex-col md:flex-row md:items-end md:justify-between gap-6">
        <div>
          <div class="bg-accent text-accent-foreground px-3 py-1 inline-block border-2 border-border mb-4 font-bold uppercase tracking-widest text-sm shadow-[4px_4px_0_0_var(--border)] transform -rotate-2">
            Zone Restreinte
          </div>
          <h1 class="text-5xl md:text-7xl font-black uppercase tracking-tighter">
            Control <br/> Room
          </h1>
        </div>
        
        <div class="flex items-center gap-4">
          <NuxtLink to="/" class="neo-button bg-card text-card-foreground border-border shadow-[4px_4px_0_0_#4F46E5]">
            ← Retour au site
          </NuxtLink>
        </div>
      </div>
    </header>

    <main class="container mx-auto px-4 max-w-5xl flex flex-col gap-12 text-card-foreground">
      
      <!-- Stats Dashboards -->
      <div class="grid md:grid-cols-2 gap-8">
        
        <!-- Db Status -->
        <div class="neo-box bg-card p-8 md:p-12 relative overflow-hidden group hover:bg-secondary transition-colors text-card-foreground">
          <div class="bg-foreground text-background px-3 py-1 inline-block font-bold uppercase text-xs mb-8">
            Inventaire
          </div>
          <p class="text-8xl font-black mb-4">{{ stats?.totalOffers || 0 }}</p>
          <h2 class="text-2xl font-bold uppercase tracking-wider mb-8">Offres Actives</h2>
          <div class="pt-4 border-t-4 border-border font-bold flex flex-col">
            <span class="text-muted-foreground uppercase text-xs">Dernière extraction</span>
            <span class="text-xl">{{ formattedDate }}</span>
          </div>
        </div>

        <!-- Scraper Status -->
        <div :class="['neo-box p-8 md:p-12 relative overflow-hidden text-card-foreground', stats?.isScraping ? 'bg-primary text-primary-foreground' : 'bg-card']">
          <div class="bg-foreground text-background px-3 py-1 inline-block font-bold uppercase text-xs mb-8">
            Processus Robot
          </div>
           
          <div class="flex items-center gap-6 mb-8">
            <div :class="['w-8 h-8 border-4 border-border rounded-full', stats?.isScraping ? 'bg-destructive animate-pulse' : 'bg-green-500']"></div>
            <p class="text-3xl md:text-4xl font-black uppercase leading-tight">
              {{ stats?.isScraping ? "Scraping en cours..." : "En veille" }}
            </p>
          </div>

          <p class="text-lg font-bold border-l-4 border-border pl-4 my-8">
            Planification: Cron <code class="bg-foreground text-background px-2 py-1 ml-1">0 * * * *</code>
          </p>

          <button 
            @click="triggerScrape" 
            :disabled="isScrapingAction || stats?.isScraping"
            class="w-full neo-button bg-foreground text-background hover:bg-accent hover:text-accent-foreground border-border"
          >
            Lancer l'extraction maintenant
          </button>
        </div>
      </div>

      <!-- Danger Zone -->
      <div class="neo-box bg-card text-card-foreground p-8 md:p-12 flex flex-col md:flex-row items-center gap-8 justify-between">
        <div>
          <h2 class="text-2xl font-black uppercase flex items-center gap-3 mb-2">
            <span class="bg-destructive text-destructive-foreground p-1 border-2 border-border">⚠</span>
            Bouton Rouge
          </h2>
          <p class="font-bold text-lg">Supprime l'intégralité de la base de données. Irréversible.</p>
        </div>
        <button 
          @click="clearDB" 
          :disabled="isClearingAction"
          class="neo-button bg-destructive text-destructive-foreground hover:bg-red-600 border-border text-xl whitespace-nowrap"
        >
          Détruire la base
        </button>
      </div>

      <!-- ===================== -->
      <!-- DEALS DETAIL TABLE -->
      <!-- ===================== -->
      <div class="text-card-foreground">
        <h2 class="text-4xl font-black uppercase mb-8 border-b-8 border-border pb-4 inline-block">Forfaits & Prix SIM</h2>
        
        <div v-if="Object.keys(dealsByOperator).length === 0" class="neo-box bg-card p-12 text-center text-xl font-bold uppercase">
          Aucune offre. Lancez un scraping d'abord.
        </div>

        <div v-for="(operatorDeals, operatorName) in dealsByOperator" :key="operatorName" class="neo-box bg-card mb-8 text-card-foreground">
          
          <!-- Operator Header Row -->
          <div class="flex flex-col md:flex-row items-start md:items-center justify-between p-4 md:p-6 bg-muted border-b-4 border-border gap-4">
            <div class="flex items-center gap-4">
              <h3 class="text-2xl md:text-3xl font-black uppercase">{{ operatorName }}</h3>
              <span class="bg-foreground text-background px-2 py-1 text-xs font-bold">{{ operatorDeals.length }} offres</span>
            </div>
            <div class="flex items-center gap-4 flex-wrap mt-4 md:mt-0">
              <!-- Frais per operator -->
              <div class="flex flex-col gap-2 bg-card p-3 border-2 border-border">
                <span class="font-black text-sm uppercase mb-1 border-b-2 border-border pb-1">Frais Opérateur (SIM, Act, Résil)</span>
                
                <div v-if="editingSimPrice[operatorName as string] === undefined" class="flex items-center justify-between gap-4">
                  <div class="flex gap-3 text-sm">
                    <span><strong>SIM:</strong> {{ getOperatorSimPrice(operatorName as string) !== null ? getOperatorSimPrice(operatorName as string) + '€' : '10€ (défaut)' }}</span>
                    <span><strong>Act:</strong> {{ getOperatorActivationPrice(operatorName as string) !== null ? getOperatorActivationPrice(operatorName as string) + '€' : '0€' }}</span>
                    <span><strong>Résil:</strong> {{ getOperatorCancellationPrice(operatorName as string) !== null ? getOperatorCancellationPrice(operatorName as string) + '€' : '0€' }}</span>
                  </div>
                  <button 
                    @click="startEditSimPrice(operatorName as string)" 
                    class="bg-card border-2 border-border px-2 py-1 text-xs font-bold uppercase shadow-neo-hover hover:bg-primary transition-colors text-card-foreground hover:text-primary-foreground"
                  >✏️ Editer</button>
                </div>
                
                <div v-else class="flex flex-col gap-2 relative z-50">
                  <div class="flex items-center gap-2 text-sm justify-between">
                    <label class="font-bold w-12">SIM:</label>
                    <div class="flex items-center">
                      <input v-model="editingSimPrice[operatorName as string]" type="number" step="0.01" min="0" class="w-16 px-1 py-0.5 border-2 border-border text-center font-bold bg-card text-card-foreground focus:outline-none focus:ring-1 focus:ring-primary h-7" @keyup.enter="saveSimPrice(operatorName as string)" @keyup.escape="cancelEditSimPrice(operatorName as string)" />
                      <span class="font-bold ml-1">€</span>
                    </div>
                  </div>
                  <div class="flex items-center gap-2 text-sm justify-between">
                    <label class="font-bold w-12">Act:</label>
                    <div class="flex items-center">
                      <input v-model="editingActivationPrice[operatorName as string]" type="number" step="0.01" min="0" class="w-16 px-1 py-0.5 border-2 border-border text-center font-bold bg-card text-card-foreground focus:outline-none focus:ring-1 focus:ring-primary h-7" @keyup.enter="saveSimPrice(operatorName as string)" @keyup.escape="cancelEditSimPrice(operatorName as string)" />
                      <span class="font-bold ml-1">€</span>
                    </div>
                  </div>
                  <div class="flex items-center gap-2 text-sm justify-between">
                    <label class="font-bold w-12">Résil:</label>
                    <div class="flex items-center">
                      <input v-model="editingCancellationPrice[operatorName as string]" type="number" step="0.01" min="0" class="w-16 px-1 py-0.5 border-2 border-border text-center font-bold bg-card text-card-foreground focus:outline-none focus:ring-1 focus:ring-primary h-7" @keyup.enter="saveSimPrice(operatorName as string)" @keyup.escape="cancelEditSimPrice(operatorName as string)" />
                      <span class="font-bold ml-1">€</span>
                    </div>
                  </div>
                  <div class="flex items-center justify-end gap-2 mt-1 z-50">
                    <button @click="saveSimPrice(operatorName as string)" class="bg-primary text-primary-foreground border-2 border-border px-3 py-1 text-xs font-bold shadow-neo-hover">Sauvegarder</button>
                    <button @click="cancelEditSimPrice(operatorName as string)" class="bg-card text-card-foreground border-2 border-border px-3 py-1 text-xs font-bold shadow-neo-hover hover:bg-destructive hover:text-white">Annuler</button>
                  </div>
                </div>
              </div>

              <button 
                @click="toggleFairplay(operatorName as string, operators?.find(o => o.operatorName === operatorName)?.isFairplay ?? true)"
                class="neo-button px-4 py-2 text-sm border-border h-full relative z-40"
                :class="operators?.find(o => o.operatorName === operatorName)?.isFairplay === false ? 'bg-primary text-primary-foreground' : 'bg-card text-card-foreground hover:bg-destructive hover:text-destructive-foreground'"
              >
                {{ operators?.find(o => o.operatorName === operatorName)?.isFairplay === false ? '⚠ Frauduleux (Rétablir)' : '✓ Fairplay (Signaler)' }}
              </button>
            </div>
          </div>
          
          <!-- Deals Table -->
          <table class="w-full text-left border-collapse z-10 relative">
            <thead>
              <tr class="border-b-4 border-border text-xs uppercase tracking-wider bg-card text-card-foreground">
                <th class="p-3 md:p-4 font-black border-r-2 border-border">Forfait</th>
                <th class="p-3 md:p-4 font-black border-r-2 border-border text-center">Data</th>
                <th class="p-3 md:p-4 font-black border-r-2 border-border text-center">Réseau</th>
                <th class="p-3 md:p-4 font-black border-r-2 border-border text-center">Prix/mois</th>
                <th class="p-3 md:p-4 font-black text-center">€/Go</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="deal in operatorDeals" :key="deal.id" class="border-b-2 border-border last:border-0 hover:bg-primary/10 transition-colors">
                <td class="p-3 md:p-4 font-bold text-lg border-r-2 border-border">{{ deal.planName }}</td>
                <td class="p-3 md:p-4 text-center font-bold border-r-2 border-border">
                  <span class="bg-secondary text-secondary-foreground border-2 border-border px-2 py-0.5 text-sm">{{ deal.dataGb }} Go</span>
                </td>
                <td class="p-3 md:p-4 text-center border-r-2 border-border">
                  <span :class="[
                    'px-2 py-0.5 text-xs font-black border-2 border-border',
                    deal.networkGeneration === '5G' ? 'bg-accent text-accent-foreground' : 'bg-muted text-muted-foreground'
                  ]">{{ deal.networkGeneration || '—' }}</span>
                </td>
                <td class="p-3 md:p-4 text-center font-black text-xl border-r-2 border-border">{{ deal.price.toFixed(2) }}€</td>
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
