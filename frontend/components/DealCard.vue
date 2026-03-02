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
  score: number;
  url: string;
}

const props = defineProps<{
  deal: MobilePlan;
  isFairplay: boolean;
  isStarOffer?: boolean;
  simPrice: number;
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
      isStarOffer ? 'bg-primary border-4 transform hover:-translate-y-2' : 'bg-white hover:-translate-y-1'
    ]"
  >
    <!-- Star Offer Ribbon -->
    <div v-if="isStarOffer" class="absolute -top-6 -right-6 md:-top-5 md:-right-5 z-20 transform rotate-12">
      <div class="bg-accent text-white px-4 py-2 border-4 border-black shadow-neo font-black uppercase text-lg flex items-center gap-2">
        <svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6" fill="currentColor" viewBox="0 0 24 24"><path d="M12 17.27L18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z"/></svg>
        Le Meilleur Choix
      </div>
    </div>

    <!-- Alert not fairplay -->
    <div v-if="!isFairplay" class="absolute -top-3 left-4 bg-destructive text-white px-3 py-1 text-xs font-bold uppercase border-2 border-black shadow-neo transform -rotate-2 z-10">
      ⚠️ Augmentation probable
    </div>

    <div class="flex-1">
      <OperatorBadge :name="deal.operator" :network="deal.network || 'Inconnu'" class="mb-6"/>
      
      <h3 :class="['font-black mb-4 leading-tight', isStarOffer ? 'text-4xl md:text-5xl' : 'text-2xl']">
        {{ deal.planName }}
      </h3>
      
      <div class="flex flex-wrap gap-2 mb-6 text-sm font-bold uppercase">
        <span class="bg-white border-2 border-black px-2 py-1">{{ deal.calls }}</span>
        <span class="bg-white border-2 border-black px-2 py-1">{{ deal.sms }}</span>
        <span class="bg-secondary border-2 border-black px-2 py-1">{{ deal.dataGb < 1 ? (deal.dataGb * 1000) + ' Mo' : deal.dataGb + ' Go' }}</span>
        <span v-if="formattedScore(deal.score)" class="bg-muted border-2 border-black px-2 py-1">{{ formattedScore(deal.score) }} €/Go</span>
      </div>
    </div>
    
    <div :class="['mt-auto pt-6 border-t-4 border-black flex items-end justify-between', isStarOffer ? 'flex-col sm:flex-row sm:items-end gap-4' : 'flex-row']">
      
      <div>
        <div class="text-sm font-bold uppercase mb-1">Prix mensuel</div>
        <div class="flex items-baseline font-black leading-none text-black">
          <span :class="isStarOffer ? 'text-6xl md:text-7xl' : 'text-4xl'">{{ deal.price.toString().split('.')[0] }}</span>
          <span :class="isStarOffer ? 'text-4xl' : 'text-2xl'">,{{ deal.price.toFixed(2).split('.')[1] || '00' }}</span>
          <span class="text-xl ml-1 block mt-2">€</span>
        </div>
      </div>

      <div class="text-right flex flex-col items-end">
        <div class="bg-white border-2 border-black px-3 py-1 font-bold text-xs uppercase mb-2 shadow-neo-hover">
          Carte SIM: {{ simPrice }}€
        </div>
        <div v-if="isStarOffer" class="bg-black text-white px-3 py-1 font-bold text-sm">
          Abonnement 1 an: {{ (deal.price * 12 + simPrice).toFixed(2) }}€
        </div>
      </div>

    </div>
    
    <!-- Link to operator page -->
    <div class="mt-8">
      <a :href="deal.url" target="_blank" rel="noopener noreferrer" :class="[
        'w-full neo-button text-xl justify-between group',
        isStarOffer ? 'bg-white text-black hover:bg-muted' : 'bg-black text-white hover:bg-accent'
      ]">
        <span>{{ isStarOffer ? 'Souscrire maintenant' : 'Voir ce forfait' }}</span>
        <svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6 transform group-hover:translate-x-1 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="3" d="M14 5l7 7m0 0l-7 7m7-7H3"/></svg>
      </a>
    </div>

  </div>
</template>
