# Última sesión oculta y badge de kcal invisible Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** En la tarjeta de rutina del Dashboard, la tarjeta "Última vez · X min · Y kcal" se sigue viendo tras completar la rutina, y el badge "N Ejercicios · M kcal" deja de ser invisible (texto y fondo del mismo color).

**Architecture:** Dos fixes independientes y pequeños, ambos en `DashboardView.jsx`: quitar una condición de visibilidad, y cambiar la construcción de una clase CSS de "clase de opacidad separada" a "sintaxis de opacidad de Tailwind en un solo token", más un `safelist` en `tailwind.config.js` para que Tailwind genere esas clases (se construyen desde datos de la BD en tiempo de ejecución, Tailwind no las ve si no están escritas literalmente en algún sitio).

**Tech Stack:** React 19, Tailwind CSS 3.4. Sin cambios de datos, sin tests nuevos (son cambios de JSX/config, no de lógica pura).

---

## Task 1: Mostrar "Última vez" también tras completar la rutina

**Files:**
- Modify: `src/views/DashboardView.jsx`

- [ ] **Step 1: Quitar la condición `!isCompleted`**

En `src/views/DashboardView.jsx`, cambiar:

```jsx
                                {!isCompleted && lastSummaries[routine.id] && (
                                    <div className="mt-3">
                                        <LastSessionCard summary={lastSummaries[routine.id]} />
                                    </div>
                                )}
```

por:

```jsx
                                {lastSummaries[routine.id] && (
                                    <div className="mt-3">
                                        <LastSessionCard summary={lastSummaries[routine.id]} />
                                    </div>
                                )}
```

- [ ] **Step 2: Verificar lint**

Run: `npx eslint src/views/DashboardView.jsx`
Expected: sin errores nuevos (comparar con `HEAD~1` si hay alguno preexistente).

- [ ] **Step 3: Commit**

```bash
git add src/views/DashboardView.jsx
git commit -m "$(cat <<'EOF'
fix(cliente): mostrar "última vez" también tras completar la rutina

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

## Task 2: Arreglar el badge invisible de "N Ejercicios · M kcal"

**Files:**
- Modify: `src/views/DashboardView.jsx`
- Modify: `tailwind.config.js`

- [ ] **Step 1: Añadir el `safelist` a `tailwind.config.js`**

El archivo completo hoy es:

```javascript
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
```

Cambiar a:

```javascript
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
```

- [ ] **Step 2: Cambiar la clase del badge en `DashboardView.jsx`**

Cambiar:

```jsx
                                        <Badge className={cn("bg-opacity-20", routine.color, routine.text_color)}>
```

por:

```jsx
                                        <Badge className={cn(`${routine.color}/20`, routine.text_color)}>
```

- [ ] **Step 3: Reiniciar el servidor de dev y verificar en el navegador**

Un cambio en `tailwind.config.js` no siempre se recoge en caliente — parar y volver a arrancar `npm run dev` antes de comprobar.

Run (skill `run-rutinex`): arrancar la app, entrar como `admin@gymtracker.com` o el usuario que corresponda, ir al Dashboard, y comprobar visualmente que el badge "N Ejercicios · M kcal" de cada rutina se ve con texto legible (color de texto distinto del fondo, fondo translúcido) para **las 6 rutinas de colores distintos si las hay, o al menos para las que existan** — no solo para la que ya funcionaba por casualidad (rojo, porque `red-500/20` ya existía literal en otro archivo antes de este fix).

- [ ] **Step 4: Verificar lint**

Run: `npx eslint src/views/DashboardView.jsx`
Expected: sin errores nuevos.

- [ ] **Step 5: Commit**

```bash
git add src/views/DashboardView.jsx tailwind.config.js
git commit -m "$(cat <<'EOF'
fix(cliente): badge de ejercicios/kcal invisible por texto y fondo del mismo color

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

## Task 3: Verificación final en navegador

**Files:** ninguno

- [ ] **Step 1: Ejecutar la suite**

Run: `npm test`
Expected: PASS, sin cambios de recuento (este plan no toca funciones puras ni tests).

- [ ] **Step 2: Verificar en el navegador (skill `run-rutinex`)**

Con la app ya arrancada tras el Task 2, en el Dashboard del cliente:
- Confirmar que una rutina ya completada esta semana sigue mostrando su tarjeta "Última vez · X min · Y kcal" (Task 1).
- Confirmar que el badge "N Ejercicios · M kcal" es legible en las rutinas visibles, sea cual sea su color (Task 2).
- Revisar la consola: sin errores nuevos.

---

## Self-review

**Cobertura del spec:**
- Bug 1 (LastSessionCard oculta tras completar) → Task 1. ✓
- Bug 2 (badge invisible, `bg-opacity-20` descartada por `tailwind-merge`) → Task 2, Step 2. ✓
- Safelist de las 6 clases `bg-{color}-500/20` en `tailwind.config.js`, mecanismo oficial de Tailwind → Task 2, Step 1. ✓
- No se toca el cálculo de `totalCalories` (estimación estática de la rutina) → ningún task lo modifica. ✓
- No se audita `Button.jsx` (`hover:bg-opacity-N`, confirmado sin el mismo bug por llevar prefijo de variante) → no aparece en ningún task, correcto. ✓
- Sin cambios de datos/esquema → ningún task toca Supabase. ✓

**Placeholders:** ninguno — código completo en cada step, incluyendo el archivo `tailwind.config.js` reescrito entero para evitar ambigüedad.

**Consistencia de tipos:** `routine.color` sigue siendo la misma cadena (`"bg-{color}-500"`) que ya usa `RoutineAssignerView.jsx` al crear rutinas — el `safelist` usa exactamente esos 6 valores, ni uno más ni uno menos.
