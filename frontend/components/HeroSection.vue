<script setup lang="ts">
const operators = [
  { name: 'Sosh', color: '#FF7900', text: 'black' },
  { name: 'RED by SFR', color: '#E2001A', text: 'white' },
  { name: 'B&You', color: '#0089C5', text: 'white' },
  { name: 'Free Mobile', color: '#CC0000', text: 'white' },
  { name: 'YouPrice', color: '#1B1B3A', text: 'white' },
  { name: 'Coriolis', color: '#6B2D8B', text: 'white' },
  { name: 'La Poste Mobile', color: '#FFD300', text: 'black' },
  { name: 'NRJ Mobile', color: '#E31937', text: 'white' },
  { name: 'Auchan Telecom', color: '#E30613', text: 'white' },
  { name: 'Cdiscount Mobile', color: '#00528A', text: 'white' },
  { name: 'Syma Mobile', color: '#00A651', text: 'white' },
  { name: 'Lebara', color: '#E6007E', text: 'white' },
  { name: 'Lycamobile', color: '#63A532', text: 'white' },
  { name: 'Prixtel', color: '#00B4D8', text: 'white' },
  { name: 'TeleCoop', color: '#2D8F4E', text: 'white' },
  { name: 'Akeo Telecom', color: '#004B87', text: 'white' },
  { name: 'Nordnet', color: '#003DA5', text: 'white' },
  { name: 'France Téléphone', color: '#2C5F8A', text: 'white' }
]

const rotations = ['-2', '1', '-1', '2', '-1.5', '1.5', '-2', '1', '2', '-1', '1.5', '-2', '-1', '2', '-1.5', '1', '-2', '1.5']
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
      
      <h1 class="text-4xl md:text-7xl font-black tracking-tight mb-8 leading-tight text-foreground">
        Trouvez votre forfait <br/> 
        <span class="inline-block bg-primary text-primary-foreground px-4 py-1 border-4 border-border mt-2 transform rotate-1">IDÉAL</span>
      </h1>
      
      <p class="text-lg md:text-2xl font-medium text-card-foreground max-w-2xl mx-auto bg-card border-2 border-border p-4 shadow-neo">
        Ajustez le curseur, on vous trouve <span class="font-black bg-secondary text-secondary-foreground px-1">le forfait le moins cher</span> au centime près.
      </p>

      <!-- Operator badges -->
      <div class="mt-10 flex flex-wrap items-center justify-center gap-3">
        <div
          v-for="(op, i) in operators"
          :key="op.name"
          class="px-3 py-1.5 font-black text-xs uppercase border-2 border-border shadow-neo select-none transition-transform hover:scale-110 hover:-translate-y-0.5"
          :style="{
            backgroundColor: op.color,
            color: op.text,
            transform: `rotate(${rotations[i]}deg)`,
          }"
        >
          {{ op.name }}
        </div>
      </div>
      <p class="mt-4 text-sm font-bold text-muted-foreground uppercase tracking-widest">
        {{ operators.length }} opérateurs scannés en temps réel
      </p>
    </div>
  </header>
</template>
