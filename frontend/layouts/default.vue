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
      <div class="container mx-auto px-4 flex flex-col md:flex-row items-center justify-between gap-4">
        <p class="font-bold text-sm uppercase tracking-wider">
          © {{ new Date().getFullYear() }} Deal-Voyager — Le comparateur qui ne vous ment pas.
        </p>
        <NuxtLink to="/admin" class="text-sm font-black uppercase tracking-widest bg-foreground text-background px-4 py-2 border-2 border-border shadow-neo hover:bg-accent hover:text-accent-foreground hover:shadow-neo-hover hover:translate-x-[2px] hover:translate-y-[2px] transition-all">
          ⚙️ Admin
        </NuxtLink>
      </div>
    </footer>
  </div>
</template>
