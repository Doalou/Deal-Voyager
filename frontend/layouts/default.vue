<script setup lang="ts">
import DarkModeSwitch from '../components/DarkModeSwitch.vue'
</script>

<template>
  <div class="min-h-screen bg-background text-foreground flex flex-col transition-colors duration-300">
    <DarkModeSwitch />

    <!-- Beta notice -->
    <aside
      class="relative z-40 border-b-4 border-border bg-secondary px-4 py-3 pr-20 text-secondary-foreground"
      aria-label="Information sur la version bêta"
    >
      <p class="mx-auto flex max-w-5xl flex-wrap items-center justify-center gap-x-2 gap-y-1 text-center text-sm font-bold md:text-base">
        <span class="border-2 border-border bg-foreground px-2 py-0.5 text-xs font-black uppercase tracking-widest text-background shadow-neo-hover">
          Bêta
        </span>
        <span>Deal Voyager est encore en bêta. Un souci ou une anomalie ?</span>
        <a
          href="https://x.com/doalou"
          target="_blank"
          rel="noopener noreferrer"
          class="font-black underline decoration-2 underline-offset-2 hover:no-underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-foreground"
        >
          Signalez-le-moi en DM sur X (@doalou)
        </a>
      </p>
    </aside>

    <!-- Page Content -->
    <main class="flex-1 w-full">
      <slot />
    </main>

    <!-- Footer -->
    <footer class="py-6 border-t-4 border-border bg-card text-card-foreground relative z-10">
      <div class="container mx-auto px-4 flex flex-col items-center justify-center gap-4 text-center">
        <p class="font-bold text-sm uppercase tracking-wider">
          © {{ new Date().getFullYear() }} Deal-Voyager - Ton Forfait, Ton Choix.
        </p>
        <NuxtLink
          to="/mentions-legales"
          class="font-bold text-xs uppercase tracking-widest border-2 border-border px-3 py-1 shadow-neo hover:shadow-neo-hover hover:translate-x-[2px] hover:translate-y-[2px] bg-card text-card-foreground hover:bg-primary hover:text-primary-foreground transition-all duration-100"
        >
          📜 Mentions Légales
        </NuxtLink>
      </div>
    </footer>
  </div>
</template>
