<script setup lang="ts">
// Palette de couleurs par opérateur - couleurs de marque officielles
const operatorColors: Record<string, { color: string; text: string }> = {
  'Sosh':             { color: '#FF7900', text: 'black'  }, // Orange Sosh
  'RED by SFR':       { color: '#00E094', text: 'black'  }, // Vert menthe officiel RED by SFR (--c-b-brand-1)
  'B&You':            { color: '#009DCC', text: 'white'  }, // Bleu Pacific Blue Bouygues Telecom
  'Free Mobile':      { color: '#E30613', text: 'white'  }, // Rouge Free/Iliad
  'YouPrice':         { color: '#3A1F6B', text: 'white'  }, // Violet foncé YouPrice
  'Coriolis':         { color: '#4DBDC6', text: 'black'  }, // Bleu-canard Coriolis officiel
  'La Poste Mobile':  { color: '#FFD300', text: 'black'  }, // Jaune La Poste
  'NRJ Mobile':       { color: '#FF0032', text: 'white'  }, // Rouge NRJ
  'Auchan Telecom':   { color: '#D6180B', text: 'white'  }, // Rouge Auchan
  'Cdiscount Mobile': { color: '#1B5EFF', text: 'white'  }, // Bleu digital Cdiscount (nouveau logo 2024)
  'Syma Mobile':      { color: '#EC1C24', text: 'white'  }, // Rouge Syma Mobile (logo rouge et blanc)
  'Lebara':           { color: '#B91866', text: 'white'  }, // Magenta Lebara officiel
  'Réglo Mobile':     { color: '#97085F', text: 'white'  }, // Bordeaux-magenta Réglo Mobile officiel
  'Lycamobile':       { color: '#08DC7D', text: 'black'  }, // Vert menthe Lycamobile officiel
  'Prixtel':          { color: '#545FFF', text: 'white'  }, // Bleu-violet - couleur du point du logo 2021
  'TeleCoop':         { color: '#2D8F4E', text: 'white'  }, // Vert TeleCoop
  'Akeo Telecom':     { color: '#004B87', text: 'white'  }, // Bleu Akeo
  'Nordnet':          { color: '#FF6C00', text: 'white'  }, // Orange (filiale Orange group)
  'France Téléphone': { color: '#1A3A6B', text: 'white'  }, // Bleu marine France Téléphone
}

// Fallback si l'API est vide ou indisponible
const fallbackOperators = Object.keys(operatorColors).map(name => ({
  name,
  ...operatorColors[name],
}))

const operators = ref(fallbackOperators)

const rotations = ['-2', '1', '-1', '2', '-1.5', '1.5', '-2', '1', '2', '-1', '1.5', '-2', '-1', '2', '-1.5', '1', '-2', '1.5', '-2', '1']

// Chargement dynamique depuis l'API : déduplique les opérateurs réels en base
const { data: deals } = await useFetch('/api/v1/deals')
if (deals.value && Array.isArray(deals.value) && deals.value.length > 0) {
  const uniqueNames = [...new Set((deals.value as any[]).map((d: any) => d.operator as string))].sort()
  operators.value = uniqueNames.map(name => ({
    name,
    ...(operatorColors[name] ?? { color: '#374151', text: 'white' }),
  }))
}
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
            transform: `rotate(${rotations[i % rotations.length]}deg)`,
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
