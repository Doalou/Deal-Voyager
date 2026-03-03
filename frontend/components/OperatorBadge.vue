<script setup lang="ts">
import { computed } from 'vue'

const props = defineProps<{
  name: string;
  network: string;
}>()

// Map operator names to specific brand colors for the neo-brutalist aesthetic
const getOperatorStyle = (name: string) => {
  const normalized = name.toLowerCase()
  if (normalized.includes('sosh') || normalized.includes('orange')) return 'bg-[#FF7900] text-black'
  if (normalized.includes('red') || normalized.includes('sfr')) return 'bg-[#E2001A] text-white'
  if (normalized.includes('b&you') || normalized.includes('bouygues')) return 'bg-[#0089C5] text-white'
  if (normalized.includes('free')) return 'bg-[#CC0000] text-white'
  
  // Default fallback
  return 'bg-card text-card-foreground'
}

const badgeClass = computed(() => getOperatorStyle(props.name))
</script>

<template>
  <div class="flex items-center gap-3">
    <div :class="['px-4 py-1.5 font-black uppercase text-sm border-2 border-border shadow-neo-hover transform -rotate-2', badgeClass]">
      {{ name }}
    </div>
    <div class="px-2 py-1 bg-card border-2 border-border text-card-foreground text-xs font-bold uppercase shadow-neo-hover">
      Réseau {{ network }}
    </div>
  </div>
</template>
