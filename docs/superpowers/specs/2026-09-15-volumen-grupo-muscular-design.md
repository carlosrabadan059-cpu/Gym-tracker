# Volumen semanal por grupo muscular

**Fecha:** 2026-09-15
**Alcance:** `docs/plan-trainer-improvements.md`, Fase 5, tercer punto
("Volumen semanal por grupo muscular del cliente").

## El bloqueo que no existía

El plan daba este punto por dependiente de **v3 Fase C** ("se apoya en el
etiquetado del catálogo que pide v3 Fase C; si ese trabajo se hace, esta
vista sale casi gratis"). Comprobado contra la base de datos real: **ese
etiquetado ya existe**.

- `exercise_catalog` tiene columna `category`, con **101 de 101** ejercicios
  etiquetados en 8 grupos: Bíceps 15, Abdomen 15, Pecho 14, Hombro 14,
  Pierna 14, Tríceps 11, Dorsal 11, Glúteo 7.
- Las **64** filas de `exercises` (rutinas asignadas) tienen todas
  `catalog_id`, así que heredan categoría vía `enrichExercisesWithCatalog`.

Por tanto esta pieza se construye ahora, sin esperar a Fase C. Lo que Fase C
sigue aportando —y que este spec **no** construye— es el etiquetado
múltiple (músculo primario/secundario) y la ventana de recuperación 48-72h.
Para un gráfico de volumen basta una etiqueta por ejercicio; para un mapa de
recuperación no, porque un press de banca también carga tríceps y hombro.

## Decisiones tomadas (brainstorming, no reabrir)

1. **La métrica son series completadas por grupo**, no tonelaje. Es la
   unidad estándar del entrenamiento (se razona en 10-20 series semanales
   por grupo) y es comparable entre ejercicios; el tonelaje infla pierna
   frente a hombro hasta hacer las barras inútiles.
2. **Se ve en los dos lados**: Estadísticas del cliente y ficha de cliente
   del entrenador, con la misma función pura detrás.
3. **Los 8 grupos del catálogo tal cual**, sin tabla de equivalencias que
   mantener. Lo que hay en `category` es lo que se pinta.

## Decisiones de detalle

- **Semana = lunes**, reusando `getWeekStart` de `src/lib/utils.js` (fuente
  única desde el fix de 2026-09-15). No se reimplementa el cálculo.
- **Una serie cuenta si está marcada como completada** (`completedSets[i]
  === true`). Si un log antiguo no trae `completedSets`, se cuentan las
  entradas de `setsData` con `reps > 0`. Sin este matiz, series apuntadas y
  no hechas inflarían el volumen.
- **Ejercicios sin categoría resoluble van a "Sin clasificar"**, un grupo
  más en el resultado, y la UI solo lo pinta si tiene series. Es un caso
  real: de los 80 ids de ejercicio que aparecen en `workout_logs`, **17 ya
  no existen** en `exercises` (rutinas borradas con el tiempo). En una vista
  de 7 días casi nunca aparecerán, pero desaparecer en silencio convertiría
  un hueco de datos en un dato falso.

## Arquitectura

### Función pura — `src/lib/muscleVolume.js`

```js
computeWeeklyMuscleVolume(logs, idToCategory, referenceDate) => Array<{ category, sets }>
```

- `logs`: lo que devuelve `loadWorkoutLogs` (`{date, routineId, logs}`).
- `idToCategory`: mapa `{ [exerciseId]: category }`, resuelto por el que
  llama (cada vista ya sabe resolver ids a datos de catálogo).
- `referenceDate`: normalmente `new Date()`; parámetro explícito para poder
  testear sin `vi.useFakeTimers()`.

Filtra las sesiones de la semana de `referenceDate` (vía `getWeekStart`),
cuenta series completadas por ejercicio, las suma por categoría y devuelve
el array ordenado de más a menos series. Los grupos con cero series **no**
aparecen: el gráfico muestra lo entrenado, no un listado de ceros.

### Componente compartido — `src/components/shared/MuscleVolumeCard.jsx`

Recibe `data` (la salida de la función pura) y pinta un `BarChart`
horizontal de Recharts, el mismo que ya usa `StatisticsView`. Sin estado
propio ni acceso a Supabase: cada vista carga sus datos y le pasa el array
ya calculado. Si `data` viene vacío, muestra "Sin series esta semana" en vez
de un gráfico vacío.

### Puntos de montaje

- **Cliente** — `StatisticsView.jsx`, pestaña Resumen. Ya carga
  `loadWorkoutLogs` y construye un `idToName`; se amplía esa misma
  resolución para quedarse también con `category` (la query de la línea 261
  pasa a pedir `exercise_catalog(name, category)`, y el fallback de ids
  estáticos pide `category` además de `name`).
- **Entrenador** — `ClientProfileView.jsx`, bajo las tarjetas de adherencia.
  Ya carga el historial del cliente y resuelve ejercicios para el panel de
  sesión; se reutiliza esa carga.

**Nota de privacidad:** el volumen de entrenamiento **no** es un dato de
salud de los que gatea el consentimiento de la Fase 5 parte 1 (peso
corporal, kcal). Son series de las rutinas que el propio entrenador
prescribe, y ya ve el detalle completo de cada sesión. No se gatea.

## Testing

`src/lib/muscleVolume.test.js`, con fechas fijas pasadas por
`referenceDate` (sin fake timers):

- Suma series de varios ejercicios del mismo grupo en una semana.
- Excluye sesiones fuera de la semana de referencia (la anterior y la
  siguiente).
- Cuenta solo series con `completedSets[i] === true`.
- Fallback: log sin `completedSets` cuenta las `setsData` con `reps > 0`.
- Ids sin categoría van a "Sin clasificar".
- Devuelve el array ordenado de más a menos series.
- Sin sesiones en la semana → array vacío.

Verificación en navegador con la cuenta de entrenador de prueba y los datos
reales de Carlos (solo navegar y capturar).

## Fuera de alcance

- Etiquetado primario/secundario y ventana de recuperación (v3 Fase C).
- Tonelaje / kg totales.
- Histórico multi-semana o comparativa con la semana anterior.
- Objetivos por grupo ("te faltan 4 series de dorsal esta semana").
