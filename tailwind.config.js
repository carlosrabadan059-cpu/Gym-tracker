export default {
    content: [
        "./index.html",
        "./src/**/*.{js,ts,jsx,tsx}",
    ],
    darkMode: 'class',
    // Los 6 colores posibles de una rutina (routines.color en Supabase, ver
    // el array COLORS de RoutineAssignerView.jsx) construyen su clase de
    // badge por interpolación en tiempo de ejecución
    // (`${routine.color}/20` en DashboardView.jsx) — Tailwind no puede
    // detectar esas clases escaneando el código fuente porque nunca
    // aparecen escritas literalmente, así que hay que decírselo aquí.
    safelist: [
        'bg-blue-500/20',
        'bg-red-500/20',
        'bg-green-500/20',
        'bg-yellow-500/20',
        'bg-purple-500/20',
        'bg-orange-500/20',
    ],
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
