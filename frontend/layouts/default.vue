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
          © {{ new Date().getFullYear() }} Deal-Voyager — Le comparateur qui ne vous ment pas.
        </p>
      </div>
    </footer>
  </div>
</template>
