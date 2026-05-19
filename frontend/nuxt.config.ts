import tailwindcss from "@tailwindcss/vite";

export default defineNuxtConfig({
  compatibilityDate: "2024-04-03",
  devtools: { enabled: false },
  modules: ["@nuxtjs/color-mode"],
  css: ["~/assets/css/main.css"],
  vite: {
    plugins: [tailwindcss()],
  },
  runtimeConfig: {
    apiInternalUrl: "http://localhost:3001",
    public: {
      matomoUrl: "",
      matomoSiteId: "",
      discordClientId: "",
    },
  },
  colorMode: {
    classSuffix: "",
  },
  app: {
    head: {
      title: "Deal-Voyager — Vos forfaits mobiles sans embrouilles",
      meta: [
        {
          name: "description",
          content:
            "Le seul comparateur de forfaits mobiles français qui classe vos offres au centime près, sans partenariat, sans pub, sans bullshit. Juste les vrais prix.",
        },
        { name: "theme-color", content: "#FFD000" },
      ],
      link: [
        { rel: "preconnect", href: "https://fonts.googleapis.com" },
        {
          rel: "preconnect",
          href: "https://fonts.gstatic.com",
          crossorigin: "",
        },
        {
          rel: "stylesheet",
          href: "https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;500;600;700&family=Outfit:wght@400;500;600;700;800;900&display=swap",
        },
        {
          rel: "icon",
          type: "image/svg+xml",
          href: "data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 100 100%22><text y=%22.9em%22 font-size=%2290%22>📡</text></svg>",
        },
      ],
    },
  },
});
