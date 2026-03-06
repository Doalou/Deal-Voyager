<template>
  <div>
    <NuxtLayout>
      <NuxtPage />
    </NuxtLayout>
  </div>
</template>

<script setup lang="ts">
const config = useRuntimeConfig();

// Initation dynamique de Matomo avec les variables d'environnement au runtime (Docker)
if (config.public.matomoUrl && config.public.matomoSiteId) {
  useScriptMatomoAnalytics({
    matomoUrl: config.public.matomoUrl,
    siteId: config.public.matomoSiteId,
  });
}
</script>

<style>
/* Global styles defined in assets/css/main.css */
</style>
