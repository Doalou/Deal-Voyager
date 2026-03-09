<script setup lang="ts">
import { ref, computed, watch } from 'vue'

const props = defineProps<{
  modelValue: number
  networks: string[]
}>()

const emit = defineEmits<{
  (e: 'update:modelValue', value: number): void
  (e: 'update:networks', value: string[]): void
}>()

const isEditing = ref(false)
const editValue = ref('')

const value = computed({
  get: () => props.modelValue,
  set: (val) => emit('update:modelValue', val)
})

const availableNetworks = [
  { id: 'Orange', label: 'Orange', activeClass: 'bg-orange-500 text-white', dotClass: 'bg-orange-500' },
  { id: 'Bouygues', label: 'Bouygues', activeClass: 'bg-blue-500 text-white', dotClass: 'bg-blue-500' },
  { id: 'SFR', label: 'SFR', activeClass: 'bg-red-500 text-white', dotClass: 'bg-red-500' },
  { id: 'Free', label: 'Free', activeClass: 'bg-red-700 text-white', dotClass: 'bg-red-700' }
]

const toggleNetwork = (id: string) => {
  const current = [...props.networks]
  const index = current.indexOf(id)
  if (index === -1) {
    current.push(id)
  } else {
    current.splice(index, 1)
  }
  emit('update:networks', current)
}

const isNetworkSelected = (id: string) => props.networks.includes(id)

const startEditing = () => {
  editValue.value = value.value.toString()
  isEditing.value = true
}

const finishEditing = () => {
  const parsed = parseInt(editValue.value, 10)
  if (!isNaN(parsed) && parsed >= 0 && parsed <= 500) {
    value.value = parsed
  }
  isEditing.value = false
}
</script>

<template>
  <div class="w-full max-w-4xl mx-auto bg-card text-card-foreground border-4 border-border shadow-neo-lg p-6 md:p-10 mb-16 z-20 relative">
    
    <div class="flex flex-col md:flex-row items-center justify-between mb-8 border-b-4 border-border pb-6 gap-6 md:gap-0">
      <h2 class="text-xl md:text-2xl font-black uppercase tracking-wider text-card-foreground text-center md:text-left">Vos Besoins en Data</h2>
      
      <!-- Editable value display -->
      <div 
        class="bg-primary text-primary-foreground border-4 border-border px-6 py-2 shadow-neo font-black text-3xl md:text-4xl transform rotate-2 cursor-pointer hover:shadow-neo-hover transition-all"
        @click="startEditing"
        v-if="!isEditing"
        title="Cliquez pour saisir une valeur"
      >
        {{ value }} <span class="text-lg md:text-xl">Go</span>
      </div>
      
      <!-- Input mode -->
      <div v-else class="flex items-center gap-2 bg-primary text-primary-foreground border-4 border-border px-4 py-2 shadow-neo transform rotate-2">
        <input
          v-model="editValue"
          type="number"
          min="0"
          max="500"
          autofocus
          class="w-20 md:w-24 text-3xl md:text-4xl font-black bg-transparent text-center text-primary-foreground outline-none border-b-4 border-border"
          @keyup.enter="finishEditing"
          @keyup.escape="isEditing = false"
          @blur="finishEditing"
        />
        <span class="text-lg md:text-xl font-black">Go</span>
      </div>
    </div>
    
    <div class="flex flex-col md:flex-row gap-8 items-center mt-8 relative py-4">
      <div class="flex-1 w-full relative">
        <input 
          type="range" 
          v-model.number="value" 
          min="0" max="500" step="5"
          class="w-full appearance-none bg-muted border-4 border-border h-8 rounded-full outline-none slider-thumb-neo"
        />
        <div class="flex justify-between text-sm font-bold uppercase mt-4 px-1 text-card-foreground">
          <span class="bg-card border-2 border-border px-2 py-1 shadow-neo-hover">0 Go</span>
          <span class="bg-card border-2 border-border px-2 py-1 shadow-neo-hover">500 Go</span>
        </div>
      </div>

      <div class="flex flex-col gap-3 w-full md:w-auto mt-4 md:mt-0 pl-0 md:pl-8 md:border-l-4 md:border-border">
        <label class="block text-sm font-black uppercase text-card-foreground text-center md:text-left">Réseaux ciblés</label>
        <div class="flex flex-wrap md:flex-col gap-2 justify-center md:justify-start">
          <button
            v-for="net in availableNetworks"
            :key="net.id"
            @click="toggleNetwork(net.id)"
            class="px-4 py-2 border-2 border-border font-bold uppercase text-xs transition-all flex items-center gap-2"
            :class="[
              isNetworkSelected(net.id) 
                ? net.activeClass + ' shadow-[2px_2px_0_0_#000] translate-y-0 translate-x-0' 
                : 'bg-card text-muted-foreground hover:bg-muted shadow-none opacity-50 hover:opacity-100'
            ]"
          >
            <div 
              class="w-3 h-3 border-2 border-border" 
              :class="isNetworkSelected(net.id) ? 'bg-white' : net.dotClass"
            ></div>
            {{ net.label }}
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
/* Custom thumb styling for webkit */
input[type=range]::-webkit-slider-thumb {
  -webkit-appearance: none;
  appearance: none;
  width: 32px;
  height: 48px;
  background: var(--tw-colors-accent);
  border: 4px solid black;
  cursor: pointer;
  box-shadow: 2px 2px 0px 0px black;
  border-radius: 4px;
  transition: transform 0.1s;
}

input[type=range]::-webkit-slider-thumb:active {
  transform: scale(0.9) translate(2px, 2px);
  box-shadow: none;
}

/* Custom thumb styling for Firefox */
input[type=range]::-moz-range-thumb {
  width: 32px;
  height: 48px;
  background: var(--tw-colors-accent);
  border: 4px solid black;
  cursor: pointer;
  box-shadow: 2px 2px 0px 0px black;
  border-radius: 4px;
}
</style>
