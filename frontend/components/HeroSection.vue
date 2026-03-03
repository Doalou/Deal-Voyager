<script setup lang="ts">
// HeroSection.vue
</script>

<template>
  <header class="w-full flex flex-col items-center text-center py-16 md:py-24 px-4 relative overflow-hidden">
    <!-- Decorative neo-brutalist shapes -->
    <div class="hidden md:block absolute top-12 left-10 w-24 h-24 bg-secondary border-4 border-border rounded-full shadow-neo transform -rotate-12 z-0"></div>
    <div class="hidden md:block absolute bottom-10 right-16 w-32 h-32 bg-primary border-4 border-border shadow-neo transform rotate-6 z-0"></div>
    <div class="hidden md:block absolute top-20 right-32 w-16 h-16 bg-accent border-4 border-border shadow-neo transform rotate-45 z-0"></div>

    <div class="relative z-10 max-w-4xl mx-auto">
      <div class="inline-block bg-card border-4 border-border shadow-neo px-6 py-2 mb-8 transform -rotate-2">
        <span class="font-bold text-xl uppercase tracking-wider text-card-foreground">📡 Deal-Voyager</span>
      </div>
      
      <h1 class="text-5xl md:text-7xl font-black tracking-tight mb-8 leading-tight text-foreground">
        Trouvez votre forfait <br/> 
        <span class="inline-block bg-primary text-primary-foreground px-4 py-1 border-4 border-border mt-2 transform rotate-1">IDÉAL</span>
      </h1>
      
      <p class="text-xl md:text-2xl font-medium text-card-foreground max-w-2xl mx-auto bg-card border-2 border-border p-4 shadow-neo">
        Ajustez le curseur, on vous trouve <span class="font-black bg-secondary text-secondary-foreground px-1">le forfait le moins cher</span> au centime près.
      </p>
    </div>
  </header>
</template>
