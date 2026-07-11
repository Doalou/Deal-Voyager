<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import {
  Activity,
  AlertTriangle,
  ArrowLeft,
  Check,
  ChevronDown,
  ChevronRight,
  CircleDollarSign,
  Clock3,
  Database,
  LoaderCircle,
  Moon,
  Pencil,
  Play,
  RefreshCw,
  Save,
  Search,
  ShieldAlert,
  Sun,
  Trash2,
  WifiOff,
  X,
} from 'lucide-vue-next'

definePageMeta({ middleware: 'auth', layout: 'admin' })

type OutcomeStatus = 'success' | 'partial' | 'failed' | 'blocked'
type ViewName = 'catalogue' | 'execution'
type OperatorFilter = 'all' | 'fairplay' | 'flagged'

interface MobilePlan {
  id: number
  operator: string
  planName: string
  price: number
  dataGb: number
  network: string | null
  networkGeneration: string | null
  dataEuGb: number | null
  simPrice: number | null
  score: number | null
}

interface ScrapeOutcome {
  operator: string
  status: OutcomeStatus
  offers: number
  durationMs: number
  mode: 'http' | 'browser'
  attempts: number
  error?: string
  purgeSkipped?: boolean
}

interface ScrapeSummary {
  success: boolean
  startedAt: string
  finishedAt: string
  durationMs: number
  outcomes: ScrapeOutcome[]
}

interface Stats {
  totalOffers: number
  isScraping: boolean
  lastUpdate: string | null
  lastScrape: ScrapeSummary | null
}

interface OperatorSettings {
  operatorName: string
  isFairplay: boolean
  simPrice: number | null
  activationPrice: number | null
  cancellationPrice: number | null
}

interface FeeDraft {
  simPrice: string
  activationPrice: string
  cancellationPrice: string
}

const colorMode = useColorMode()
const authToken = useState<string | null>('authToken')
const authHeaders = computed(() => authToken.value ? { Authorization: authToken.value } : {})

const { data: stats, refresh: refreshStats } = useFetch<Stats>('/api/v1/stats', {
  default: () => ({ totalOffers: 0, isScraping: false, lastUpdate: null, lastScrape: null }),
  server: false,
  lazy: true,
})
const { data: deals, refresh: refreshDeals } = useFetch<MobilePlan[]>('/api/v1/deals', {
  default: () => [],
  server: false,
  lazy: true,
})
const { data: operators, refresh: refreshOperators } = useFetch<OperatorSettings[]>('/api/v1/operators', {
  default: () => [],
  server: false,
  lazy: true,
})

const activeView = ref<ViewName>('catalogue')
const operatorFilter = ref<OperatorFilter>('all')
const searchQuery = ref('')
const expandedOperators = ref(new Set<string>())
const editingOperator = ref<string | null>(null)
const feeDrafts = ref<Record<string, FeeDraft>>({})
const savingOperator = ref<string | null>(null)
const togglingOperator = ref<string | null>(null)
const isScrapingAction = ref(false)
const isRefreshing = ref(false)
const isClearingAction = ref(false)
const showClearDialog = ref(false)
const clearConfirmation = ref('')
const notification = ref<{ show: boolean; message: string; type: 'success' | 'error' }>({
  show: false,
  message: '',
  type: 'success',
})

let pollingInterval: ReturnType<typeof setInterval> | null = null
let notificationTimeout: ReturnType<typeof setTimeout> | null = null
const wasScraping = ref(false)

const settingsByOperator = computed(() => new Map(
  (operators.value ?? []).map(operator => [operator.operatorName, operator]),
))

const groupedDeals = computed(() => {
  const groups = new Map<string, MobilePlan[]>()
  for (const deal of deals.value ?? []) {
    const group = groups.get(deal.operator) ?? []
    group.push(deal)
    groups.set(deal.operator, group)
  }
  for (const group of groups.values()) {
    group.sort((left, right) => left.dataGb - right.dataGb || left.price - right.price)
  }
  return groups
})

const visibleOperators = computed(() => {
  const query = searchQuery.value.trim().toLocaleLowerCase('fr')
  return [...groupedDeals.value.entries()]
    .filter(([name]) => {
      const isFairplay = settingsByOperator.value.get(name)?.isFairplay !== false
      if (operatorFilter.value === 'fairplay' && !isFairplay) return false
      if (operatorFilter.value === 'flagged' && isFairplay) return false
      return !query || name.toLocaleLowerCase('fr').includes(query)
    })
    .sort(([left], [right]) => left.localeCompare(right, 'fr'))
})

const operatorCount = computed(() => groupedDeals.value.size)
const flaggedCount = computed(() => [...groupedDeals.value.keys()].filter(name => !isOperatorFairplay(name)).length)
const averagePrice = computed(() => {
  const catalog = deals.value ?? []
  if (catalog.length === 0) return 0
  return catalog.reduce((sum, deal) => sum + deal.price, 0) / catalog.length
})
const outcomeCounts = computed(() => {
  const counts: Record<OutcomeStatus, number> = { success: 0, partial: 0, failed: 0, blocked: 0 }
  for (const outcome of stats.value.lastScrape?.outcomes ?? []) counts[outcome.status] += 1
  return counts
})
const sortedOutcomes = computed(() => [...(stats.value.lastScrape?.outcomes ?? [])].sort((left, right) => {
  const order: Record<OutcomeStatus, number> = { failed: 0, blocked: 1, partial: 2, success: 3 }
  return order[left.status] - order[right.status] || left.operator.localeCompare(right.operator, 'fr')
}))

const formattedDate = computed(() => formatDate(stats.value.lastUpdate))
const clearIsConfirmed = computed(() => clearConfirmation.value.trim().toUpperCase() === 'SUPPRIMER')

function isOperatorFairplay(operatorName: string) {
  return settingsByOperator.value.get(operatorName)?.isFairplay !== false
}

function operatorFees(operatorName: string) {
  return settingsByOperator.value.get(operatorName) ?? {
    operatorName,
    isFairplay: true,
    simPrice: null,
    activationPrice: null,
    cancellationPrice: null,
  }
}

function toggleOperator(operatorName: string) {
  const next = new Set(expandedOperators.value)
  next.has(operatorName) ? next.delete(operatorName) : next.add(operatorName)
  expandedOperators.value = next
}

function formatDate(value: string | null | undefined) {
  if (!value) return 'Aucune donnée'
  return new Date(value).toLocaleString('fr-FR', { dateStyle: 'medium', timeStyle: 'short' })
}

function formatDuration(milliseconds: number) {
  if (milliseconds < 1000) return `${milliseconds} ms`
  const seconds = Math.round(milliseconds / 1000)
  if (seconds < 60) return `${seconds} s`
  return `${Math.floor(seconds / 60)} min ${seconds % 60} s`
}

function formatData(dataGb: number) {
  return dataGb < 1 ? `${Math.round(dataGb * 1000)} Mo` : `${dataGb} Go`
}

function formatMoney(value: number | null | undefined) {
  return value == null ? 'Non défini' : `${value.toLocaleString('fr-FR', { minimumFractionDigits: 0, maximumFractionDigits: 2 })} €`
}

function statusLabel(status: OutcomeStatus) {
  return { success: 'Réussi', partial: 'Partiel', failed: 'Échec', blocked: 'Bloqué' }[status]
}

function statusClass(status: OutcomeStatus) {
  return {
    success: 'bg-emerald-100 text-emerald-900 border-emerald-900',
    partial: 'bg-amber-100 text-amber-950 border-amber-900',
    failed: 'bg-red-100 text-red-900 border-red-900',
    blocked: 'bg-slate-200 text-slate-950 border-slate-900',
  }[status]
}

function showNotification(message: string, type: 'success' | 'error' = 'success') {
  if (notificationTimeout) clearTimeout(notificationTimeout)
  notification.value = { show: true, message, type }
  notificationTimeout = setTimeout(() => { notification.value.show = false }, 5000)
}

async function refreshAll(silent = false) {
  if (!silent) isRefreshing.value = true
  try {
    await Promise.all([refreshStats(), refreshDeals(), refreshOperators()])
  } catch {
    if (!silent) showNotification('Impossible d’actualiser les données.', 'error')
  } finally {
    isRefreshing.value = false
  }
}

async function triggerScrape() {
  if (isScrapingAction.value || stats.value.isScraping) return
  isScrapingAction.value = true
  try {
    const response = await $fetch<{ message: string }>('/api/v1/scrape', {
      method: 'POST',
      headers: authHeaders.value,
    })
    showNotification(response.message)
    await refreshStats()
  } catch {
    showNotification('Le lancement de la collecte a échoué.', 'error')
  } finally {
    isScrapingAction.value = false
  }
}

async function toggleFairplay(operatorName: string) {
  if (togglingOperator.value) return
  togglingOperator.value = operatorName
  const isFairplay = !isOperatorFairplay(operatorName)
  try {
    await $fetch(`/api/v1/operators/${encodeURIComponent(operatorName)}/fairplay`, {
      method: 'PUT',
      headers: authHeaders.value,
      body: { isFairplay },
    })
    await refreshOperators()
    showNotification(`${operatorName} est maintenant ${isFairplay ? 'Fairplay' : 'signalé'}.`)
  } catch {
    showNotification(`Le statut de ${operatorName} n’a pas été modifié.`, 'error')
  } finally {
    togglingOperator.value = null
  }
}

function startEditFees(operatorName: string) {
  const settings = operatorFees(operatorName)
  feeDrafts.value[operatorName] = {
    simPrice: settings.simPrice?.toString() ?? '',
    activationPrice: settings.activationPrice?.toString() ?? '',
    cancellationPrice: settings.cancellationPrice?.toString() ?? '',
  }
  editingOperator.value = operatorName
}

function cancelEditFees() {
  editingOperator.value = null
}

function parseFee(value: string) {
  if (value.trim() === '') return null
  const parsed = Number.parseFloat(value.replace(',', '.'))
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : null
}

async function saveFees(operatorName: string) {
  const draft = feeDrafts.value[operatorName]
  if (!draft || savingOperator.value) return
  savingOperator.value = operatorName
  try {
    await $fetch(`/api/v1/operators/${encodeURIComponent(operatorName)}/simprice`, {
      method: 'PUT',
      headers: authHeaders.value,
      body: {
        simPrice: parseFee(draft.simPrice),
        activationPrice: parseFee(draft.activationPrice),
        cancellationPrice: parseFee(draft.cancellationPrice),
      },
    })
    await refreshOperators()
    editingOperator.value = null
    showNotification(`Les frais de ${operatorName} sont enregistrés.`)
  } catch {
    showNotification(`Les frais de ${operatorName} n’ont pas été enregistrés.`, 'error')
  } finally {
    savingOperator.value = null
  }
}

function openClearDialog() {
  clearConfirmation.value = ''
  showClearDialog.value = true
}

function closeClearDialog() {
  if (isClearingAction.value) return
  showClearDialog.value = false
  clearConfirmation.value = ''
}

async function clearDatabase() {
  if (!clearIsConfirmed.value || isClearingAction.value) return
  isClearingAction.value = true
  try {
    await $fetch('/api/v1/clear', { method: 'DELETE', headers: authHeaders.value })
    await refreshAll(true)
    showClearDialog.value = false
    clearConfirmation.value = ''
    showNotification('Le catalogue a été vidé.')
  } catch {
    showNotification('La suppression du catalogue a échoué.', 'error')
  } finally {
    isClearingAction.value = false
  }
}

watch(() => stats.value.isScraping, async (isScraping) => {
  if (wasScraping.value && !isScraping) {
    await refreshAll(true)
    showNotification('La collecte est terminée. Le catalogue est à jour.')
  }
  wasScraping.value = isScraping
})

onMounted(() => {
  pollingInterval = setInterval(async () => {
    await refreshStats()
    if (stats.value.isScraping) await refreshDeals()
  }, 5000)
})

onUnmounted(() => {
  if (pollingInterval) clearInterval(pollingInterval)
  if (notificationTimeout) clearTimeout(notificationTimeout)
})
</script>

<template>
  <div class="min-h-screen bg-background text-foreground pb-20">
    <Transition enter-active-class="transition duration-200" enter-from-class="translate-y-2 opacity-0" leave-active-class="transition duration-150" leave-to-class="translate-y-2 opacity-0">
      <div
        v-if="notification.show"
        role="status"
        :class="[
          'fixed bottom-5 left-4 right-4 z-[70] mx-auto flex max-w-xl items-center gap-3 border-2 border-border px-4 py-3 shadow-neo md:left-auto md:right-6',
          notification.type === 'error' ? 'bg-destructive text-destructive-foreground' : 'bg-foreground text-background',
        ]"
      >
        <AlertTriangle v-if="notification.type === 'error'" class="h-5 w-5 shrink-0" />
        <Check v-else class="h-5 w-5 shrink-0" />
        <span class="min-w-0 flex-1 font-bold">{{ notification.message }}</span>
        <button class="p-1" title="Fermer" @click="notification.show = false"><X class="h-4 w-4" /></button>
      </div>
    </Transition>

    <header class="sticky top-0 z-40 border-b-2 border-border bg-foreground text-background">
      <div class="mx-auto flex min-h-16 max-w-7xl items-center gap-3 px-4 py-3 lg:px-6">
        <NuxtLink to="/" class="grid h-10 w-10 shrink-0 place-items-center border-2 border-background/40 hover:bg-background hover:text-foreground" title="Retour au site">
          <ArrowLeft class="h-5 w-5" />
        </NuxtLink>
        <div class="min-w-0 flex-1">
          <div class="flex items-center gap-2">
            <span class="h-2.5 w-2.5 shrink-0 bg-primary" />
            <h1 class="truncate font-display text-xl font-black uppercase md:text-2xl">Control Room</h1>
          </div>
          <p class="truncate text-xs font-semibold text-background/65">Deal-Voyager 2.3.0</p>
        </div>
        <div class="hidden items-center gap-2 sm:flex">
          <span :class="['h-2.5 w-2.5', stats.isScraping ? 'animate-pulse bg-primary' : 'bg-emerald-400']" />
          <span class="text-sm font-bold">{{ stats.isScraping ? 'Collecte active' : 'Service disponible' }}</span>
        </div>
        <button class="grid h-10 w-10 place-items-center border-2 border-background/40 hover:bg-background hover:text-foreground" title="Changer de thème" @click="colorMode.preference = colorMode.value === 'dark' ? 'light' : 'dark'">
          <ClientOnly><Sun v-if="colorMode.value === 'dark'" class="h-5 w-5" /><Moon v-else class="h-5 w-5" /></ClientOnly>
        </button>
      </div>
    </header>

    <main class="mx-auto max-w-7xl px-4 py-6 lg:px-6 lg:py-8">
      <section class="mb-6 grid grid-cols-2 border-l-2 border-t-2 border-border lg:grid-cols-4">
        <div class="min-w-0 border-b-2 border-r-2 border-border bg-card p-4 text-card-foreground lg:p-5">
          <div class="mb-3 flex items-center justify-between"><Database class="h-5 w-5 text-accent" /><span class="text-xs font-black uppercase text-muted-foreground">Catalogue</span></div>
          <p class="text-3xl font-black tabular-nums">{{ stats.totalOffers }}</p><p class="text-sm font-semibold text-muted-foreground">offres actives</p>
        </div>
        <div class="min-w-0 border-b-2 border-r-2 border-border bg-card p-4 text-card-foreground lg:p-5">
          <div class="mb-3 flex items-center justify-between"><Activity class="h-5 w-5 text-emerald-600" /><span class="text-xs font-black uppercase text-muted-foreground">Couverture</span></div>
          <p class="text-3xl font-black tabular-nums">{{ operatorCount }}<span class="text-lg text-muted-foreground">/18</span></p><p class="text-sm font-semibold text-muted-foreground">opérateurs publiés</p>
        </div>
        <div class="min-w-0 border-b-2 border-r-2 border-border bg-card p-4 text-card-foreground lg:p-5">
          <div class="mb-3 flex items-center justify-between"><CircleDollarSign class="h-5 w-5 text-primary" /><span class="text-xs font-black uppercase text-muted-foreground">Prix moyen</span></div>
          <p class="text-3xl font-black tabular-nums">{{ averagePrice.toFixed(2) }} €</p><p class="text-sm font-semibold text-muted-foreground">par mois</p>
        </div>
        <div class="min-w-0 border-b-2 border-r-2 border-border bg-card p-4 text-card-foreground lg:p-5">
          <div class="mb-3 flex items-center justify-between"><Clock3 class="h-5 w-5 text-secondary" /><span class="text-xs font-black uppercase text-muted-foreground">Actualisation</span></div>
          <p class="truncate text-base font-black md:text-lg">{{ formattedDate }}</p><p class="text-sm font-semibold text-muted-foreground">cron horaire</p>
        </div>
      </section>

      <section class="mb-8 border-2 border-border bg-card text-card-foreground shadow-neo">
        <div class="flex flex-col gap-4 p-4 md:flex-row md:items-center md:justify-between lg:p-5">
          <div class="flex min-w-0 items-center gap-3">
            <div :class="['grid h-11 w-11 shrink-0 place-items-center border-2 border-border', stats.isScraping ? 'bg-primary' : 'bg-muted']">
              <LoaderCircle v-if="stats.isScraping" class="h-6 w-6 animate-spin" /><Activity v-else class="h-6 w-6" />
            </div>
            <div class="min-w-0"><h2 class="font-black uppercase">{{ stats.isScraping ? 'Collecte Crawlee en cours' : 'Collecteur en veille' }}</h2><p class="truncate text-sm font-medium text-muted-foreground">{{ stats.isScraping ? 'Le catalogue se met à jour automatiquement.' : 'Dernière mise à jour : ' + formattedDate }}</p></div>
          </div>
          <div class="flex flex-wrap gap-2">
            <button class="neo-button min-h-11 flex-1 bg-primary px-4 py-2 text-primary-foreground md:flex-none" :disabled="stats.isScraping || isScrapingAction" @click="triggerScrape">
              <LoaderCircle v-if="isScrapingAction" class="h-4 w-4 animate-spin" /><Play v-else class="h-4 w-4" />
              {{ stats.isScraping ? 'En cours' : 'Lancer maintenant' }}
            </button>
            <button class="grid h-11 w-11 place-items-center border-2 border-border bg-card shadow-neo-hover disabled:opacity-50" :disabled="isRefreshing" title="Actualiser" @click="refreshAll()">
              <RefreshCw :class="['h-5 w-5', isRefreshing && 'animate-spin']" />
            </button>
            <button class="grid h-11 w-11 place-items-center border-2 border-border bg-destructive text-destructive-foreground shadow-neo-hover" title="Vider le catalogue" @click="openClearDialog"><Trash2 class="h-5 w-5" /></button>
          </div>
        </div>
      </section>

      <div class="mb-6 flex border-b-2 border-border" role="tablist">
        <button :class="['flex items-center gap-2 border-x-2 border-t-2 border-border px-4 py-3 text-sm font-black uppercase', activeView === 'catalogue' ? 'bg-foreground text-background' : 'bg-card text-card-foreground']" @click="activeView = 'catalogue'"><Database class="h-4 w-4" />Catalogue</button>
        <button :class="['-ml-0.5 flex items-center gap-2 border-x-2 border-t-2 border-border px-4 py-3 text-sm font-black uppercase', activeView === 'execution' ? 'bg-foreground text-background' : 'bg-card text-card-foreground']" @click="activeView = 'execution'"><Activity class="h-4 w-4" />Dernière exécution</button>
      </div>

      <section v-if="activeView === 'catalogue'">
        <div class="mb-5 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div class="relative w-full max-w-lg"><Search class="pointer-events-none absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground" /><input v-model="searchQuery" class="neo-input pl-11 shadow-none" type="search" placeholder="Rechercher un opérateur" /></div>
          <div class="flex overflow-x-auto" role="group" aria-label="Filtrer les opérateurs">
            <button v-for="filter in ([['all', 'Tous'], ['fairplay', 'Fairplay'], ['flagged', `Signalés (${flaggedCount})`]] as const)" :key="filter[0]" :class="['whitespace-nowrap border-2 border-border px-4 py-2 text-sm font-bold first:ml-0 -ml-0.5', operatorFilter === filter[0] ? 'bg-accent text-accent-foreground' : 'bg-card text-card-foreground']" @click="operatorFilter = filter[0]">{{ filter[1] }}</button>
          </div>
        </div>

        <div v-if="visibleOperators.length === 0" class="border-2 border-dashed border-border bg-card px-6 py-14 text-center"><Search class="mx-auto mb-3 h-8 w-8 text-muted-foreground" /><p class="font-black uppercase">Aucun opérateur trouvé</p></div>

        <div class="space-y-4">
          <article v-for="[operatorName, operatorDeals] in visibleOperators" :key="operatorName" class="border-2 border-border bg-card text-card-foreground shadow-neo">
            <div class="flex flex-col gap-4 p-4 lg:flex-row lg:items-center lg:p-5">
              <button class="flex min-w-0 flex-1 items-center gap-3 text-left" :aria-expanded="expandedOperators.has(operatorName)" @click="toggleOperator(operatorName)">
                <ChevronDown v-if="expandedOperators.has(operatorName)" class="h-5 w-5 shrink-0" /><ChevronRight v-else class="h-5 w-5 shrink-0" />
                <div class="min-w-0"><h3 class="truncate text-lg font-black uppercase md:text-xl">{{ operatorName }}</h3><p class="text-sm font-semibold text-muted-foreground">{{ operatorDeals.length }} offres · {{ operatorDeals.filter(deal => deal.networkGeneration === '5G').length }} en 5G</p></div>
              </button>

              <div v-if="editingOperator !== operatorName" class="grid grid-cols-3 gap-x-4 gap-y-1 border-y-2 border-border py-3 text-sm lg:border-y-0 lg:border-l-2 lg:py-0 lg:pl-5">
                <div><span class="block text-xs font-bold uppercase text-muted-foreground">SIM</span><strong>{{ formatMoney(operatorFees(operatorName).simPrice) }}</strong></div>
                <div><span class="block text-xs font-bold uppercase text-muted-foreground">Activation</span><strong>{{ formatMoney(operatorFees(operatorName).activationPrice) }}</strong></div>
                <div><span class="block text-xs font-bold uppercase text-muted-foreground">Résiliation</span><strong>{{ formatMoney(operatorFees(operatorName).cancellationPrice) }}</strong></div>
              </div>
              <div v-else class="grid gap-2 border-y-2 border-border py-3 sm:grid-cols-3 lg:border-y-0 lg:border-l-2 lg:py-0 lg:pl-5">
                <label v-for="field in ([['simPrice', 'SIM'], ['activationPrice', 'Activation'], ['cancellationPrice', 'Résiliation']] as const)" :key="field[0]" class="text-xs font-bold uppercase"><span>{{ field[1] }}</span><span class="mt-1 flex items-center border-2 border-border bg-background"><input v-model="feeDrafts[operatorName][field[0]]" class="min-w-0 w-20 bg-transparent px-2 py-1.5 text-right text-sm font-bold outline-none" inputmode="decimal" /><span class="pr-2">€</span></span></label>
              </div>

              <div class="flex items-center gap-2">
                <template v-if="editingOperator === operatorName">
                  <button class="grid h-10 w-10 place-items-center border-2 border-border bg-primary shadow-neo-hover" :disabled="savingOperator === operatorName" title="Enregistrer les frais" @click="saveFees(operatorName)"><LoaderCircle v-if="savingOperator === operatorName" class="h-4 w-4 animate-spin" /><Save v-else class="h-4 w-4" /></button>
                  <button class="grid h-10 w-10 place-items-center border-2 border-border bg-card shadow-neo-hover" title="Annuler" @click="cancelEditFees"><X class="h-4 w-4" /></button>
                </template>
                <button v-else class="grid h-10 w-10 place-items-center border-2 border-border bg-card shadow-neo-hover" title="Modifier les frais" @click="startEditFees(operatorName)"><Pencil class="h-4 w-4" /></button>
                <button role="switch" :aria-checked="isOperatorFairplay(operatorName)" :disabled="togglingOperator === operatorName" :class="['flex h-10 items-center gap-2 border-2 border-border px-3 text-sm font-black shadow-neo-hover', isOperatorFairplay(operatorName) ? 'bg-emerald-100 text-emerald-950' : 'bg-destructive text-destructive-foreground']" @click="toggleFairplay(operatorName)">
                  <LoaderCircle v-if="togglingOperator === operatorName" class="h-4 w-4 animate-spin" /><Check v-else-if="isOperatorFairplay(operatorName)" class="h-4 w-4" /><ShieldAlert v-else class="h-4 w-4" />
                  {{ isOperatorFairplay(operatorName) ? 'Fairplay' : 'Signalé' }}
                </button>
              </div>
            </div>

            <div v-if="expandedOperators.has(operatorName)" class="border-t-2 border-border">
              <div class="divide-y-2 divide-border md:hidden">
                <div v-for="deal in operatorDeals" :key="deal.id" class="grid grid-cols-[1fr_auto] gap-3 p-4">
                  <div class="min-w-0"><p class="truncate font-black">{{ deal.planName }}</p><p class="mt-1 text-sm font-semibold text-muted-foreground">{{ deal.network || 'Réseau inconnu' }} · {{ deal.networkGeneration || '4G' }} · {{ deal.dataEuGb != null ? deal.dataEuGb + ' Go UE' : 'UE non renseignée' }}</p></div>
                  <div class="text-right"><p class="text-lg font-black">{{ deal.price.toFixed(2) }} €</p><p class="text-sm font-bold text-muted-foreground">{{ formatData(deal.dataGb) }}</p></div>
                </div>
              </div>
              <div class="hidden overflow-x-auto md:block">
                <table class="w-full min-w-[760px] border-collapse text-left">
                  <thead class="bg-muted text-xs uppercase text-muted-foreground"><tr><th class="px-4 py-3 font-black">Forfait</th><th class="px-4 py-3 font-black">Réseau</th><th class="px-4 py-3 text-right font-black">Data</th><th class="px-4 py-3 text-right font-black">UE</th><th class="px-4 py-3 text-right font-black">Prix mensuel</th><th class="px-4 py-3 text-right font-black">SIM</th><th class="px-4 py-3 text-right font-black">€/Go</th></tr></thead>
                  <tbody class="divide-y-2 divide-border"><tr v-for="deal in operatorDeals" :key="deal.id" class="hover:bg-primary/10"><td class="px-4 py-3 font-bold">{{ deal.planName }}</td><td class="px-4 py-3"><span class="border-2 border-border px-2 py-1 text-xs font-black">{{ deal.network || '-' }} · {{ deal.networkGeneration || '4G' }}</span></td><td class="px-4 py-3 text-right font-bold">{{ formatData(deal.dataGb) }}</td><td class="px-4 py-3 text-right">{{ deal.dataEuGb != null ? deal.dataEuGb + ' Go' : '-' }}</td><td class="px-4 py-3 text-right text-lg font-black">{{ deal.price.toFixed(2) }} €</td><td class="px-4 py-3 text-right">{{ formatMoney(deal.simPrice) }}</td><td class="px-4 py-3 text-right font-mono text-sm">{{ deal.score != null ? deal.score.toFixed(3) : '-' }}</td></tr></tbody>
                </table>
              </div>
            </div>
          </article>
        </div>
      </section>

      <section v-else>
        <div v-if="!stats.lastScrape" class="border-2 border-dashed border-border bg-card px-6 py-14 text-center"><Activity class="mx-auto mb-3 h-8 w-8 text-muted-foreground" /><p class="font-black uppercase">Aucune exécution enregistrée</p></div>
        <template v-else>
          <div class="mb-5 flex flex-col gap-4 border-2 border-border bg-card p-4 text-card-foreground md:flex-row md:items-center md:justify-between">
            <div><p class="text-xs font-black uppercase text-muted-foreground">Terminée le</p><p class="font-black">{{ formatDate(stats.lastScrape.finishedAt) }}</p><p class="text-sm font-semibold text-muted-foreground">Durée totale : {{ formatDuration(stats.lastScrape.durationMs) }}</p></div>
            <div class="grid grid-cols-4 divide-x-2 divide-border border-2 border-border text-center"><div class="px-3 py-2"><strong class="block text-xl text-emerald-700">{{ outcomeCounts.success }}</strong><span class="text-xs font-bold">Réussis</span></div><div class="px-3 py-2"><strong class="block text-xl text-amber-700">{{ outcomeCounts.partial }}</strong><span class="text-xs font-bold">Partiels</span></div><div class="px-3 py-2"><strong class="block text-xl text-slate-700">{{ outcomeCounts.blocked }}</strong><span class="text-xs font-bold">Bloqués</span></div><div class="px-3 py-2"><strong class="block text-xl text-red-700">{{ outcomeCounts.failed }}</strong><span class="text-xs font-bold">Échecs</span></div></div>
          </div>

          <div class="overflow-hidden border-2 border-border bg-card text-card-foreground shadow-neo">
            <div v-for="outcome in sortedOutcomes" :key="outcome.operator" class="grid gap-3 border-b-2 border-border p-4 last:border-b-0 md:grid-cols-[minmax(180px,1fr)_110px_90px_100px_90px] md:items-center">
              <div class="min-w-0"><p class="truncate font-black uppercase">{{ outcome.operator }}</p><p v-if="outcome.error" class="mt-1 line-clamp-2 text-xs font-semibold text-muted-foreground" :title="outcome.error">{{ outcome.error }}</p></div>
              <span :class="['w-fit border-2 px-2 py-1 text-xs font-black uppercase', statusClass(outcome.status)]"><WifiOff v-if="outcome.status === 'blocked'" class="mr-1 inline h-3.5 w-3.5" />{{ statusLabel(outcome.status) }}</span>
              <p class="text-sm"><span class="text-muted-foreground md:hidden">Offres : </span><strong>{{ outcome.offers }}</strong></p>
              <p class="text-sm"><span class="text-muted-foreground md:hidden">Mode : </span><strong>{{ outcome.mode === 'browser' ? 'Playwright' : 'HTTP' }}</strong><span class="block text-xs font-semibold text-muted-foreground">{{ outcome.attempts }} {{ outcome.attempts > 1 ? 'tentatives' : 'tentative' }}</span></p>
              <p class="text-sm tabular-nums"><span class="text-muted-foreground md:hidden">Durée : </span><strong>{{ formatDuration(outcome.durationMs) }}</strong></p>
            </div>
          </div>
        </template>
      </section>
    </main>

    <Teleport to="body">
      <div v-if="showClearDialog" class="fixed inset-0 z-[80] grid place-items-center bg-black/70 p-4" @click.self="closeClearDialog">
        <div role="dialog" aria-modal="true" aria-labelledby="clear-title" class="w-full max-w-md border-2 border-border bg-card p-5 text-card-foreground shadow-neo-lg md:p-6">
          <div class="mb-5 flex items-start gap-3"><div class="grid h-11 w-11 shrink-0 place-items-center border-2 border-border bg-destructive text-destructive-foreground"><Trash2 class="h-5 w-5" /></div><div><h2 id="clear-title" class="text-xl font-black uppercase">Vider le catalogue</h2><p class="mt-1 text-sm font-semibold text-muted-foreground">Les {{ stats.totalOffers }} offres seront supprimées définitivement.</p></div></div>
          <label class="block text-sm font-black uppercase" for="clear-confirmation">Confirmation</label>
          <input id="clear-confirmation" v-model="clearConfirmation" class="neo-input mt-2 shadow-none" autocomplete="off" placeholder="SUPPRIMER" @keyup.enter="clearDatabase" />
          <div class="mt-6 flex justify-end gap-2"><button class="border-2 border-border bg-card px-4 py-2 font-bold shadow-neo-hover" @click="closeClearDialog">Annuler</button><button class="flex items-center gap-2 border-2 border-border bg-destructive px-4 py-2 font-bold text-destructive-foreground shadow-neo-hover disabled:cursor-not-allowed disabled:opacity-40" :disabled="!clearIsConfirmed || isClearingAction" @click="clearDatabase"><LoaderCircle v-if="isClearingAction" class="h-4 w-4 animate-spin" /><Trash2 v-else class="h-4 w-4" />Supprimer</button></div>
        </div>
      </div>
    </Teleport>
  </div>
</template>
