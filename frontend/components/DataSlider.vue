<script setup lang="ts">
import { ref, computed, watch } from 'vue'

const props = defineProps<{
  modelValue: number
}>()

const emit = defineEmits<{
  (e: 'update:modelValue', value: number): void
}>()

const isEditing = ref(false)
const editValue = ref('')

const value = computed({
  get: () => props.modelValue,
  set: (val) => emit('update:modelValue', val)
})

const startEditing = () => {
  editValue.value = value.value.toString()
  isEditing.value = true
}

const finishEditing = () => {
  const parsed = parseInt(editValue.value, 10)
  if (!isNaN(parsed) && parsed >= 0 && parsed <= 400) {
    value.value = parsed
  }
  isEditing.value = false
}
</script>

<template>
  <div class="w-full max-w-2xl mx-auto bg-white border-4 border-black shadow-neo-lg p-6 md:p-10 mb-16 z-20 relative">
    
    <div class="flex items-end justify-between mb-8 border-b-4 border-black pb-4">
      <h2 class="text-xl md:text-2xl font-black uppercase tracking-wider">Vos Besoins en Data</h2>
      
      <!-- Editable value display -->
      <div 
        class="bg-primary border-4 border-black px-6 py-2 shadow-neo font-black text-4xl transform rotate-2 cursor-pointer hover:shadow-neo-hover transition-all"
        @click="startEditing"
        v-if="!isEditing"
        title="Cliquez pour saisir une valeur"
      >
        {{ value }} <span class="text-xl">Go</span>
      </div>
      
      <!-- Input mode -->
      <div v-else class="flex items-center gap-2 bg-primary border-4 border-black px-4 py-2 shadow-neo transform rotate-2">
        <input
          v-model="editValue"
          type="number"
          min="0"
          max="400"
          autofocus
          class="w-24 text-4xl font-black bg-transparent text-center outline-none border-b-4 border-black"
          @keyup.enter="finishEditing"
          @keyup.escape="isEditing = false"
          @blur="finishEditing"
        />
        <span class="text-xl font-black">Go</span>
      </div>
    </div>
    
    <div class="relative py-4">
      <input 
        type="range" 
        v-model.number="value" 
        min="0" max="400" step="5"
        class="w-full appearance-none bg-muted border-4 border-black h-8 rounded-full outline-none slider-thumb-neo"
      />
      <div class="flex justify-between text-sm font-bold uppercase mt-4 px-1">
        <span class="bg-white border-2 border-black px-2 py-1 shadow-neo-hover">0 Go</span>
        <span class="bg-white border-2 border-black px-2 py-1 shadow-neo-hover">400 Go</span>
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
