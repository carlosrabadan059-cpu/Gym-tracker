export default {
    content: [
        "./index.html",
        "./src/**/*.{js,ts,jsx,tsx}",
    ],
    darkMode: 'class',
    theme: {
        extend: {
            colors: {
                primary: 'var(--color-primary)',
                background: 'var(--color-background)',
                surface: 'var(--color-surface)',
                'surface-highlight': 'var(--color-surface-highlight)',
                'text-primary': 'var(--color-text-primary)',
                'text-secondary': 'var(--color-text-secondary)',
            },
            fontFamily: {
                sans: ['Inter', 'sans-serif'], // Or system defaults if Inter is not loaded
            },
        },
    },
    plugins: [],
}
