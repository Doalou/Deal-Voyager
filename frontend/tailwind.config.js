export default {
    darkMode: 'class',
    content: [
        "./components/**/*.{js,vue,ts}",
        "./layouts/**/*.vue",
        "./pages/**/*.vue",
        "./plugins/**/*.{js,ts}",
        "./app.vue",
        "./error.vue"
    ],
    theme: {
        extend: {
            colors: {
                background: "var(--background)",
                foreground: "var(--foreground)",
                primary: "var(--primary)",
                "primary-foreground": "var(--primary-foreground)",
                secondary: "var(--secondary)",
                "secondary-foreground": "var(--secondary-foreground)",
                accent: "var(--accent)",
                "accent-foreground": "var(--accent-foreground)",
                destructive: "var(--destructive)",
                "destructive-foreground": "var(--destructive-foreground)",
                muted: "var(--muted)",
                "muted-foreground": "var(--muted-foreground)",
                card: "var(--card)",
                "card-foreground": "var(--card-foreground)",
                border: "var(--border)",
            },
            boxShadow: {
                'neo': '4px 4px 0px 0px var(--shadow-color)',
                'neo-hover': '2px 2px 0px 0px var(--shadow-color)',
                'neo-lg': '8px 8px 0px 0px var(--shadow-color)',
            },
            fontFamily: {
                sans: ['Outfit', 'Space Grotesk', 'system-ui', 'sans-serif'],
                display: ['Space Grotesk', 'Outfit', 'sans-serif'],
            }
        },
    },
    plugins: [],
}
