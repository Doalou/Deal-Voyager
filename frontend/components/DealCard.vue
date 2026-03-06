<script setup lang="ts">
import OperatorBadge from './OperatorBadge.vue'

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
  networkGeneration: string;
  dataEuGb: number | null;
  score: number;
  url: string;
}

const props = defineProps<{
  deal: MobilePlan;
  isFairplay: boolean;
  isStarOffer?: boolean;
  simPrice: number;
  activationPrice: number;
  cancellationPrice: number;
}>()

const formattedScore = (score: number | null) => {
  if (!score || score <= 0) return null
  return score.toFixed(3)
}

</script>

<template>
  <div 
    :class="[
      'relative neo-box p-6 md:p-8 flex flex-col',
      isStarOffer ? 'bg-primary border-4 border-border transform hover:-translate-y-2 text-primary-foreground' : 'bg-card text-card-foreground hover:-translate-y-1'
    ]"
  >
    <!-- Star Offer Ribbon -->
    <div v-if="isStarOffer" class="absolute -top-6 -right-6 md:-top-5 md:-right-5 z-20 transform rotate-12">
      <div class="bg-accent text-accent-foreground px-4 py-2 border-4 border-border shadow-neo font-black uppercase text-lg flex items-center gap-2">
        <svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6" fill="currentColor" viewBox="0 0 24 24"><path d="M12 17.27L18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z"/></svg>
        Le Meilleur Choix
      </div>
    </div>

    <!-- Alert not fairplay -->
    <div v-if="!isFairplay" class="absolute -top-3 left-4 bg-destructive text-destructive-foreground px-3 py-1 text-xs font-bold uppercase border-2 border-border shadow-neo transform -rotate-2 z-10">
      ⚠️ Augmentation probable
    </div>

    <div class="flex-1">
      <OperatorBadge :name="deal.operator" :network="deal.network || 'Inconnu'" :network-generation="deal.networkGeneration" class="mb-6"/>
      
      <h3 :class="['font-black mb-4 leading-tight', isStarOffer ? 'text-4xl md:text-5xl text-primary-foreground' : 'text-2xl text-card-foreground']">
        {{ deal.planName }}
      </h3>
      
      <div class="flex flex-wrap gap-2 mb-6 text-sm font-bold uppercase">
        <span class="bg-card border-2 border-border text-card-foreground flex items-center gap-1.5 px-2 py-1" title="Appels">
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2.5" stroke="currentColor" class="w-4 h-4"><path stroke-linecap="round" stroke-linejoin="round" d="M2.25 6.75c0 8.284 6.716 15 15 15h2.25a2.25 2.25 0 002.25-2.25v-1.372c0-.516-.351-.966-.852-1.091l-4.423-1.106c-.44-.11-.902.055-1.173.417l-.97 1.293c-1.36-.63-2.8-1.5-4.04-2.74-1.24-1.24-2.11-2.68-2.74-4.04l1.293-.97c.363-.271.527-.734.417-1.173L6.963 3.102a1.125 1.125 0 00-1.091-.852H4.5A2.25 2.25 0 002.25 4.5v2.25z" /></svg>
          {{ deal.calls }}
        </span>
        <span class="bg-card border-2 border-border text-card-foreground flex items-center gap-1.5 px-2 py-1" title="SMS/MMS">
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2.5" stroke="currentColor" class="w-4 h-4"><path stroke-linecap="round" stroke-linejoin="round" d="M8.625 9.75a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H8.25m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H12m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0h-.375m-13.5 3.01c0 1.6 1.123 2.994 2.707 3.227 1.087.16 2.185.283 3.293.369V21l4.184-4.183a1.14 1.14 0 01.778-.332 48.294 48.294 0 005.83-.498c1.585-.233 2.708-1.626 2.708-3.228V6.741c0-1.602-1.123-2.995-2.707-3.228A48.394 48.394 0 0012 3c-2.392 0-4.744.175-7.043.513C3.373 3.746 2.25 5.14 2.25 6.741v6.018z" /></svg>
          {{ deal.sms }}
        </span>
        <span class="bg-secondary border-2 border-border text-secondary-foreground flex items-center gap-1.5 px-2 py-1" title="Data Internet">
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2.5" stroke="currentColor" class="w-4 h-4"><path stroke-linecap="round" stroke-linejoin="round" d="M8.288 15.038a5.25 5.25 0 017.424 0M5.106 11.856c3.807-3.808 9.98-3.808 13.788 0M1.924 8.674c5.565-5.565 14.587-5.565 20.152 0M12.53 18.22l-.53.53-.53-.53a.75.75 0 011.06 0z" /></svg>
          {{ deal.dataGb < 1 ? (deal.dataGb * 1000) + ' Mo' : deal.dataGb + ' Go' }}
        </span>
        <span v-if="deal.dataEuGb && deal.dataEuGb > 0" class="bg-card border-2 border-border text-card-foreground flex items-center gap-1.5 px-2 py-1" title="Data en Europe/DOM">
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2.5" stroke="currentColor" class="w-4 h-4"><path stroke-linecap="round" stroke-linejoin="round" d="M12 21a9.004 9.004 0 008.716-6.747M12 21a9.004 9.004 0 01-8.716-6.747M12 21c2.485 0 4.5-4.03 4.5-9S14.485 3 12 3m0 18c-2.485 0-4.5-4.03-4.5-9S9.515 3 12 3m0 0a8.997 8.997 0 017.843 4.582M12 3a8.997 8.997 0 00-7.843 4.582m15.686 0A11.953 11.953 0 0112 10.5c-2.998 0-5.74-1.1-7.843-2.918m15.686 0A8.959 8.959 0 0121 12c0 .778-.099 1.533-.284 2.253m0 0A17.919 17.919 0 0112 16.5a17.92 17.92 0 01-8.716-2.247m0 0A9.015 9.015 0 013 12c0-1.605.42-3.113 1.157-4.418" /></svg>
          {{ deal.dataEuGb }} Go EU
        </span>
        <span v-if="formattedScore(deal.score)" class="bg-muted border-2 border-border text-muted-foreground px-2 py-1">{{ formattedScore(deal.score) }} €/Go</span>
      </div>
    </div>
    
    <div :class="['mt-auto pt-6 border-t-4 border-border flex items-end justify-between', isStarOffer ? 'flex-col sm:flex-row sm:items-end gap-4' : 'flex-row']">
      
      <div>
        <div :class="['text-sm font-bold uppercase mb-1', isStarOffer ? 'text-primary-foreground' : 'text-card-foreground']">Prix mensuel</div>
        <div class="flex items-baseline font-black leading-none">
          <span :class="isStarOffer ? 'text-6xl md:text-7xl text-primary-foreground' : 'text-4xl text-card-foreground'">{{ deal.price.toString().split('.')[0] }}</span>
          <span :class="isStarOffer ? 'text-4xl text-primary-foreground' : 'text-2xl text-card-foreground'">,{{ deal.price.toFixed(2).split('.')[1] || '00' }}</span>
          <span :class="['text-xl ml-1 block mt-2', isStarOffer ? 'text-primary-foreground' : 'text-card-foreground']">€</span>
        </div>
      </div>

      <div class="text-right flex flex-col items-end gap-1">
        <div class="bg-card border-2 border-border px-3 py-1 font-bold text-xs uppercase shadow-neo-hover flex flex-col items-end leading-tight text-card-foreground">
          <span>Carte SIM: <span class="text-primary text-base">{{ simPrice }}€</span></span>
          <span v-if="activationPrice > 0" class="text-[10px] text-muted-foreground">Activation: {{ activationPrice }}€</span>
          <span v-if="cancellationPrice > 0" class="text-[10px] text-muted-foreground">Résiliation: {{ cancellationPrice }}€</span>
        </div>
        <div :class="[
          'px-3 py-1 font-bold text-xs uppercase', 
          isStarOffer ? 'bg-foreground text-background' : 'bg-muted border-2 border-border text-muted-foreground'
        ]">
          1 an: {{ (deal.price * 12 + simPrice + activationPrice + cancellationPrice).toFixed(2) }}€
        </div>
      </div>

    </div>
    
    <!-- Link to operator page -->
    <div class="mt-8">
      <a :href="deal.url" target="_blank" rel="noopener noreferrer" :class="[
        'w-full neo-button text-xl justify-between group',
        isStarOffer ? 'bg-card text-card-foreground hover:bg-muted' : 'bg-foreground text-background hover:bg-accent hover:text-accent-foreground'
      ]">
        <span>{{ isStarOffer ? 'Souscrire maintenant' : 'Voir ce forfait' }}</span>
        <svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6 transform group-hover:translate-x-1 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="3" d="M14 5l7 7m0 0l-7 7m7-7H3"/></svg>
      </a>
    </div>

  </div>
</template>
