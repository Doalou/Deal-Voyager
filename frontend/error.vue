<script setup lang="ts">
const props = defineProps({
  error: Object
})

const handleError = () => clearError({ redirect: '/' })
</script>

<template>
  <div class="min-h-screen bg-background text-foreground flex flex-col items-center justify-center p-4 text-center font-sans selection:bg-primary selection:text-primary-foreground">
    <!-- Neo-Brutalist 404 Container -->
    <div class="max-w-2xl w-full">
      <div class="relative inline-block mb-12">
        <h1 class="text-[120px] md:text-[200px] font-black leading-none tracking-tighter uppercase relative z-10">
          404
        </h1>
        <!-- Background decorative box -->
        <div class="absolute -top-4 -left-4 w-full h-full bg-secondary border-4 border-border -z-0 translate-x-4 translate-y-4 shadow-neo"></div>
      </div>

      <div class="bg-card border-4 border-border p-8 md:p-12 mb-12 shadow-neo-lg text-left relative">
        <!-- Floating badge -->
        <div class="absolute -top-6 -right-6 bg-primary text-primary-foreground border-4 border-border px-4 py-2 font-black rotate-12 shadow-neo">
          OUPS !
        </div>

        <h2 class="text-3xl md:text-5xl font-black mb-6 uppercase leading-tight italic">
          Perdu dans le réseau ?
        </h2>
        
        <p class="text-lg md:text-xl font-bold mb-8 leading-relaxed">
          On dirait que ce forfait (ou cette page) n'existe pas ou qu'il a été résilié sans préavis. 
          Pas de panique, notre comparateur est toujours là pour vous aider à retrouver votre chemin.
        </p>

        <button 
          @click="handleError"
          class="neo-button bg-primary text-primary-foreground w-full md:w-auto text-xl"
        >
          <span class="mr-2">🏠</span>
          RETOUR À L'ACCUEIL
        </button>
      </div>

      <!-- Neo decoration -->
      <div class="flex gap-4 justify-center opacity-50">
        <div class="w-8 h-8 rounded-full border-4 border-border bg-accent"></div>
        <div class="w-24 h-8 border-4 border-border bg-muted"></div>
        <div class="w-8 h-8 border-4 border-border bg-secondary rotate-45"></div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.neo-button {
  @apply px-8 py-4 font-black border-4 border-border shadow-neo transition-all duration-100 flex items-center justify-center gap-2 active:shadow-none active:translate-x-[4px] active:translate-y-[4px] hover:translate-x-[-2px] hover:translate-y-[-2px] hover:shadow-neo-lg;
}
</style>
