<script setup lang="ts">
import { computed } from 'vue'

const props = defineProps<{
  name: string;
  network: string;
  networkGeneration?: string;
}>()

// Map operator names to specific brand colors for the neo-brutalist aesthetic
const getOperatorStyle = (name: string) => {
  const normalized = name.toLowerCase()
  if (normalized.includes('sosh') || normalized.includes('orange')) return 'bg-[#FF7900] text-black'
  if (normalized.includes('red') || normalized.includes('sfr')) return 'bg-[#E2001A] text-white'
  if (normalized.includes('b&you') || normalized.includes('bouygues')) return 'bg-[#0089C5] text-white'
  if (normalized.includes('free')) return 'bg-[#CC0000] text-white'
  if (normalized.includes('coriolis')) return 'bg-[#6B2D8B] text-white'
  if (normalized.includes('youprice')) return 'bg-[#1B1B3A] text-white'
  if (normalized.includes('la poste')) return 'bg-[#FFD300] text-black'
  if (normalized.includes('nrj')) return 'bg-[#E31937] text-white'
  if (normalized.includes('auchan')) return 'bg-[#E30613] text-white'
  if (normalized.includes('cdiscount')) return 'bg-[#00528A] text-white'
  if (normalized.includes('syma')) return 'bg-[#00A651] text-white'
  if (normalized.includes('lebara')) return 'bg-[#E6007E] text-white'
  
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
