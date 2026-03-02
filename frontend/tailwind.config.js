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
                background: "#f4f0EA", // Cream/paper white base
                foreground: "#111111", // Pitch black text
                primary: "#FFD000",   // Mustard Yellow
                "primary-foreground": "#111111",
                secondary: "#FFB0E6", // Light pink
                "secondary-foreground": "#111111",
                accent: "#4F46E5",    // Electric Blue
                "accent-foreground": "#ffffff",
                destructive: "#FF4545",
                "destructive-foreground": "#ffffff",
                muted: "#e3ddd5",
                "muted-foreground": "#555555",
                card: "#ffffff",
                "card-foreground": "#111111",
                border: "#111111",    // Black borders
            },
            boxShadow: {
                'neo': '4px 4px 0px 0px rgba(0,0,0,1)',
                'neo-hover': '2px 2px 0px 0px rgba(0,0,0,1)',
                'neo-lg': '8px 8px 0px 0px rgba(0,0,0,1)',
            },
            fontFamily: {
                sans: ['Outfit', 'Space Grotesk', 'system-ui', 'sans-serif'],
                display: ['Space Grotesk', 'Outfit', 'sans-serif'],
            }
        },
    },
    plugins: [],
}
