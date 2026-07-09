<script setup lang="ts">
import DarkModeSwitch from '../components/DarkModeSwitch.vue'
</script>

<template>
  <div class="min-h-screen bg-background text-foreground flex flex-col transition-colors duration-300">
    <DarkModeSwitch />
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
