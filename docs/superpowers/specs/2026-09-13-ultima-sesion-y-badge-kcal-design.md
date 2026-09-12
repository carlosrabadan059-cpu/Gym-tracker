# Dos bugs de la tarjeta de rutina del Dashboard: "última vez" oculta y badge de kcal invisible

Reportado por el usuario con captura real: al terminar un entreno, las kcal se ven en el resumen emergente, pero no quedan visibles en ninguna parte de la tarjeta de la rutina en el Dashboard. Investigando, son **dos bugs independientes** en `DashboardView.jsx` que se combinan para dar ese resultado.

## Bug 1: `LastSessionCard` se oculta al completar la rutina

`DashboardView.jsx:365` — condición `!isCompleted && lastSummaries[routine.id]`. Se decidió así en una sesión anterior (2026-09-10, razón dada: "referencia pre-entreno, redundante una vez hecha"). Consecuencia real: en cuanto la rutina queda marcada como completada esta semana, la tarjeta "Última vez · X min · Y kcal" (`src/components/ui/LastSessionCard.jsx`) desaparece del Dashboard el resto de la semana — justo cuando el usuario quiere consultar lo que hizo.

**Fix:** quitar `!isCompleted` de la condición. Se muestra siempre que haya `lastSummaries[routine.id]`, antes y después de completar.

## Bug 2: el badge "N Ejercicios · M kcal" es invisible (texto y fondo del mismo color)

Al reconstruir la tarjeta con los componentes reales en un prototipo (mismos datos, mismo `Badge.jsx`), se reprodujo exactamente la barra sólida sin texto de la captura original. Verificado con el DOM real:

```
background-color: rgb(249, 115, 22)   ← naranja sólido, sin transparencia
color:            rgb(249, 115, 22)   ← el texto es el MISMO color exacto
```

Causa: `DashboardView.jsx:353` construye la clase como `cn("bg-opacity-20", routine.color, routine.text_color)`. `tailwind-merge` (la función `cn`) descarta `bg-opacity-20` porque detecta que `routine.color` (p.ej. `bg-orange-500`) es una utilidad de fondo más específica del mismo grupo y se queda solo con la última — el fondo pasa de "traslúcido al 20%" a "sólido al 100%". Como el texto usa `routine.text_color`, que es el mismo color, queda perfectamente invisible sobre su propio fondo.

**Fix:** usar la sintaxis moderna de opacidad de Tailwind, que es un único token atómico (`bg-orange-500/20`) y no se puede partir en dos clases que compitan entre sí:

```jsx
<Badge className={cn(`${routine.color}/20`, routine.text_color)}>
```

**Problema añadido, y su solución:** Tailwind solo genera CSS para clases que ve escritas *literalmente* en el código fuente escaneado — no para las que se construyen por interpolación en tiempo de ejecución. Hoy `bg-orange-500`/`border-orange-500`/`text-orange-500` (y sus equivalentes para blue/red/green/yellow/purple, los 6 colores fijos que puede tener una rutina) ya funcionan porque aparecen literalmente en el array `COLORS` de `RoutineAssignerView.jsx`. Pero `bg-{color}-500/20` no aparece literal en ningún sitio — sin más, la clase existiría en el HTML pero sin ninguna regla CSS detrás (fondo transparente en vez de sólido, no soluciona nada).

Se añade un `safelist` en `tailwind.config.js` con las 6 clases exactas (`bg-blue-500/20`, `bg-red-500/20`, `bg-green-500/20`, `bg-yellow-500/20`, `bg-purple-500/20`, `bg-orange-500/20`) — es el mecanismo oficial de Tailwind para clases construidas desde datos en tiempo de ejecución, y no mezcla una necesidad de build tooling dentro de un componente.

## Fuera de alcance

- No se toca el badge estático de kcal en sí (`totalCalories` calculado por `calculateCaloriesByVolume` sobre `routine.exercises`) — sigue siendo una estimación de la rutina, no de la sesión real.
- No se audita ningún otro uso de `cn(...)` con colores dinámicos en el resto de la app — este spec cubre solo `DashboardView.jsx:353`, el único sitio confirmado con el patrón `bg-opacity-N` + color dinámico en el mismo grupo (verificado por grep: `Button.jsx` usa `hover:bg-opacity-N`, que al llevar el prefijo `hover:` no compite con la clase base sin prefijo, no tiene este bug).
- Ningún cambio de datos ni de esquema — los tres campos (`color`, `text_color`, `border_color`) de `routines` no cambian.
