<script setup lang="ts">
import { computed } from 'vue'

const props = defineProps<{
  name: string;
  network: string;
  networkGeneration?: string;
}>()

// Map operator names to specific brand colors for the neo-brutalist aesthetic
const getOperatorStyle = (name: string) => {
  const normalized = name
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
  if (normalized.includes('sosh') || normalized.includes('orange')) return 'bg-[#FF7900] text-black'
  if (normalized.includes('red')) return 'bg-[#00E094] text-black'
  if (normalized.includes('b&you') || normalized.includes('bouygues')) return 'bg-[#009DCC] text-white'
  if (normalized.includes('free')) return 'bg-[#E30613] text-white'
  if (normalized.includes('youprice')) return 'bg-[#3A1F6B] text-white'
  if (normalized.includes('coriolis')) return 'bg-[#4DBDC6] text-black'
  if (normalized.includes('la poste')) return 'bg-[#FFD300] text-black'
  if (normalized.includes('nrj')) return 'bg-[#FF0032] text-white'
  if (normalized.includes('auchan')) return 'bg-[#D6180B] text-white'
  if (normalized.includes('cdiscount')) return 'bg-[#1B5EFF] text-white'
  if (normalized.includes('syma')) return 'bg-[#EC1C24] text-white'
  if (normalized.includes('lebara')) return 'bg-[#B91866] text-white'
  if (normalized.includes('reglo')) return 'bg-[#97085F] text-white'
  if (normalized.includes('lycamobile') || normalized.includes('lyca')) return 'bg-[#08DC7D] text-black'
  if (normalized.includes('prixtel')) return 'bg-[#545FFF] text-white'
  if (normalized.includes('telecoop')) return 'bg-[#2D8F4E] text-white'
  if (normalized.includes('akeo')) return 'bg-[#004B87] text-white'
  if (normalized.includes('nordnet')) return 'bg-[#FF6C00] text-white'
  if (normalized.includes('france t') || normalized.includes('bleutel')) return 'bg-[#1A3A6B] text-white'
  if (normalized.includes('sfr')) return 'bg-[#E2001A] text-white'
  
  return 'bg-card text-card-foreground'
}

const badgeClass = computed(() => getOperatorStyle(props.name))
</script>

<template>
  <div class="flex flex-wrap items-center gap-2 md:gap-3">
    <div :class="['px-4 py-1.5 font-black uppercase text-sm border-2 border-border shadow-neo-hover transform -rotate-2', badgeClass]">
      {{ name }}
    </div>
    <div class="px-2 py-1 bg-card border-2 border-border text-card-foreground text-xs font-bold uppercase shadow-neo-hover">
      Réseau {{ network }}
    </div>
    <div v-if="networkGeneration" :class="[
      'px-2 py-1 border-2 border-border text-xs font-black uppercase shadow-neo-hover',
      networkGeneration === '5G' ? 'bg-accent text-accent-foreground' : 'bg-muted text-muted-foreground'
    ]">
      {{ networkGeneration }}
    </div>
  </div>
</template>
