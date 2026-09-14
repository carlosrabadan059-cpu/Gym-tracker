# Calendario Semanal Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** El entrenador asigna a cada rutina los días de la semana en que toca (al crearla o después, desde la ficha del cliente), y el Dashboard del cliente destaca las rutinas de hoy sobre el resto (o muestra una card de descanso si hoy no toca ninguna).

**Architecture:** Una columna `scheduled_days smallint[]` nueva en `routines` (sin tabla aparte). Dos funciones puras nuevas en `src/lib/routineSchedule.js` deciden "¿toca hoy?" y separan una lista de rutinas en hoy/resto. `DashboardView.jsx` extrae su tarjeta de rutina a un componente `RoutineCard` reutilizable para poder renderizar dos grupos sin duplicar ~120 líneas de JSX. `RoutineAssignerView.jsx` (crear) y `ClientProfileView.jsx` (editar ya asignada) ganan un selector de 7 días.

**Tech Stack:** React 19, Supabase (Postgres), Vitest.

---

## Task 1: Migración — columna `scheduled_days`

**Files:**
- Create: `supabase/migrations/20260915_add_scheduled_days_to_routines.sql`

- [ ] **Step 1: Escribir la migración**

```sql
-- Fase 3 (parte 1): qué días de la semana toca cada rutina. null = sin día
-- fijo asignado (comportamiento actual, sin cambios). Valores 0-6 igual que
-- Date.prototype.getDay() de JS (0 = domingo ... 6 = sábado) — se elige esa
-- convención y no "lunes primero" porque es la que ya usa new Date().getDay()
-- sin ninguna conversión, sin añadir una tercera convención de inicio de
-- semana a las dos que ya conviven en el proyecto (ver nota en CLAUDE.md).
alter table routines add column if not exists scheduled_days smallint[];
```

- [ ] **Step 2: Aplicar la migración**

Usar `mcp__supabase__apply_migration` con `project_id` `jqpyqqlkgisykgywilrf`, `name` `add_scheduled_days_to_routines`, y el SQL de arriba.

- [ ] **Step 3: Verificar**

Con `mcp__supabase__execute_sql` (solo lectura):
```sql
select column_name, data_type from information_schema.columns where table_schema='public' and table_name='routines' and column_name='scheduled_days';
```
Expected: una fila, `data_type` = `ARRAY`.

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/20260915_add_scheduled_days_to_routines.sql
git commit -m "$(cat <<'EOF'
feat(entrenador): columna scheduled_days en routines para el calendario semanal

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

## Task 2: `src/lib/routineSchedule.js` — funciones puras

**Files:**
- Create: `src/lib/routineSchedule.js`
- Test: `src/lib/routineSchedule.test.js`

- [ ] **Step 1: Escribir el test que falla**

Crear `src/lib/routineSchedule.test.js`:

```js
import { describe, it, expect } from 'vitest';
import { WEEKDAY_LABELS, isRoutineScheduledForDay, splitRoutinesByToday } from './routineSchedule';

describe('WEEKDAY_LABELS', () => {
    it('tiene 7 días, orden L-M-X-J-V-S-D, valores 0-6 de getDay()', () => {
        expect(WEEKDAY_LABELS).toHaveLength(7);
        expect(WEEKDAY_LABELS.map(d => d.label)).toEqual(['L', 'M', 'X', 'J', 'V', 'S', 'D']);
        expect(WEEKDAY_LABELS.map(d => d.value).sort((a, b) => a - b)).toEqual([0, 1, 2, 3, 4, 5, 6]);
    });
});

describe('isRoutineScheduledForDay', () => {
    it('true si el día está en el array', () => {
        expect(isRoutineScheduledForDay([1, 3, 5], 3)).toBe(true);
    });

    it('false si el día no está en el array', () => {
        expect(isRoutineScheduledForDay([1, 3, 5], 2)).toBe(false);
    });

    it('false si scheduled_days es null', () => {
        expect(isRoutineScheduledForDay(null, 3)).toBe(false);
    });

    it('false si scheduled_days es un array vacío', () => {
        expect(isRoutineScheduledForDay([], 3)).toBe(false);
    });

    it('false si scheduled_days es undefined', () => {
        expect(isRoutineScheduledForDay(undefined, 3)).toBe(false);
    });
});

describe('splitRoutinesByToday', () => {
    it('separa rutinas de hoy y el resto', () => {
        const routines = [
            { id: 'a', scheduled_days: [1, 3, 5] },
            { id: 'b', scheduled_days: [2, 4] },
            { id: 'c', scheduled_days: null },
        ];
        const { today, rest } = splitRoutinesByToday(routines, 1);
        expect(today.map(r => r.id)).toEqual(['a']);
        expect(rest.map(r => r.id)).toEqual(['b', 'c']);
    });

    it('todas caen en rest si ninguna coincide con hoy', () => {
        const routines = [
            { id: 'a', scheduled_days: [1] },
            { id: 'b', scheduled_days: null },
        ];
        const { today, rest } = splitRoutinesByToday(routines, 6);
        expect(today).toEqual([]);
        expect(rest.map(r => r.id)).toEqual(['a', 'b']);
    });

    it('varias rutinas pueden coincidir con hoy a la vez, preservando orden', () => {
        const routines = [
            { id: 'a', scheduled_days: [2] },
            { id: 'b', scheduled_days: [2, 4] },
            { id: 'c', scheduled_days: [5] },
        ];
        const { today, rest } = splitRoutinesByToday(routines, 2);
        expect(today.map(r => r.id)).toEqual(['a', 'b']);
        expect(rest.map(r => r.id)).toEqual(['c']);
    });

    it('lista vacía de entrada da listas vacías', () => {
        expect(splitRoutinesByToday([], 3)).toEqual({ today: [], rest: [] });
    });
});
```

- [ ] **Step 2: Ejecutar y verificar que falla**

Run: `npm test -- routineSchedule`
Expected: FAIL — el módulo `./routineSchedule` no existe.

- [ ] **Step 3: Implementar**

Crear `src/lib/routineSchedule.js`:

```js
// Fase 3 (parte 1) del plan de entrenador: calendario semanal. Ver
// docs/plan-trainer-improvements.md y
// docs/superpowers/specs/2026-09-15-calendario-semanal-design.md.

/**
 * Días de la semana para el selector de UI, en el orden natural en español
 * (L-M-X-J-V-S-D), con el `value` que usa internamente `scheduled_days`
 * (igual que Date.prototype.getDay(): 0 = domingo ... 6 = sábado).
 */
export const WEEKDAY_LABELS = [
    { value: 1, label: 'L' },
    { value: 2, label: 'M' },
    { value: 3, label: 'X' },
    { value: 4, label: 'J' },
    { value: 5, label: 'V' },
    { value: 6, label: 'S' },
    { value: 0, label: 'D' },
];

/**
 * ¿Esta rutina está programada para el día `dayOfWeek` (0-6, getDay())?
 * Una rutina sin `scheduledDays` (null, undefined o array vacío) nunca
 * "toca hoy" — se trata como sin programar, no como "todos los días".
 *
 * @param {number[]|null|undefined} scheduledDays
 * @param {number} dayOfWeek
 * @returns {boolean}
 */
export function isRoutineScheduledForDay(scheduledDays, dayOfWeek) {
    return Array.isArray(scheduledDays) && scheduledDays.includes(dayOfWeek);
}

/**
 * Separa una lista de rutinas en las de hoy y el resto, para el Dashboard.
 * `todayDayOfWeek` se pasa como parámetro (no se llama a `new Date()` dentro)
 * para que la función sea pura y testeable con cualquier día fijo.
 *
 * @param {Array<{scheduled_days?: number[]|null}>} routines
 * @param {number} todayDayOfWeek
 * @returns {{ today: Array, rest: Array }}
 */
export function splitRoutinesByToday(routines, todayDayOfWeek) {
    const today = [];
    const rest = [];
    for (const routine of routines) {
        if (isRoutineScheduledForDay(routine.scheduled_days, todayDayOfWeek)) {
            today.push(routine);
        } else {
            rest.push(routine);
        }
    }
    return { today, rest };
}
```

- [ ] **Step 4: Ejecutar y verificar que pasa**

Run: `npm test -- routineSchedule`
Expected: PASS (10 tests).

- [ ] **Step 5: Verificar lint**

Run: `npx eslint src/lib/routineSchedule.js`
Expected: sin errores.

- [ ] **Step 6: Commit**

```bash
git add src/lib/routineSchedule.js src/lib/routineSchedule.test.js
git commit -m "$(cat <<'EOF'
feat(cliente): funciones puras para calcular qué rutina toca hoy

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

## Task 3: `DashboardView.jsx` — extraer `RoutineCard` y destacar la de hoy

**Files:**
- Modify: `src/views/DashboardView.jsx`

**Contexto:** hoy el archivo renderiza cada tarjeta de rutina inline dentro de
`routines.map((routine) => { ... return <Card>...~120 líneas...</Card>; })`
(líneas 310-434 antes de este cambio). Para mostrar dos grupos (hoy / resto)
sin duplicar esa JSX, se extrae a un componente `RoutineCard` fuera de
`DashboardView`, sin cambiar ni una clase CSS ni el comportamiento visual de
la tarjeta en sí.

- [ ] **Step 1: Añadir el import de `routineSchedule`**

En la cabecera de imports (junto a `import { getRoutineIcon } from '../lib/routineUtils';`), añadir:

```js
import { splitRoutinesByToday } from '../lib/routineSchedule';
```

- [ ] **Step 2: Extraer `RoutineCard` como componente**

Justo antes de `const DashboardView = ({ onStartDaily, onSeeAll, completedRoutines = [] }) => {`, añadir:

```jsx
// Tarjeta de una rutina en el Dashboard. Extraída de DashboardView para
// poder renderizarse dos veces (grupo "hoy" y grupo "resto") sin duplicar
// la JSX — Fase 3 (parte 1), calendario semanal.
function RoutineCard({ routine, isExpanded, isCompleted, lastSummary, onToggle, onStart }) {
    const visibleExercises = isExpanded ? routine.exercises : routine.exercises.slice(0, 3);
    const routineIcon = getRoutineIcon(routine.name);

    return (
        <Card
            className={cn(
                "flex flex-col gap-4 p-5 transition-all cursor-pointer border-l-4",
                routine.border_color,
                "bg-surface",
                isExpanded ? "scale-[1.02] shadow-lg" : "hover:scale-[1.01]",
                isCompleted && "opacity-80"
            )}
            onClick={onToggle}
        >
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                    {routineIcon && (
                        <div className="h-14 w-14 rounded-2xl overflow-hidden bg-surface-highlight/50 border border-surface-highlight flex-shrink-0">
                            <img
                                src={routineIcon}
                                alt="icon"
                                className="h-full w-full object-cover p-1.5"
                                loading="lazy"
                                onError={(e) => {
                                    e.target.onerror = null;
                                    e.target.src = 'https://images.unsplash.com/photo-1540497077202-7c8a3999166f?auto=format&fit=crop&q=80&w=200';
                                }}
                            />
                        </div>
                    )}
                    <h4 className={cn("text-lg font-bold leading-tight", routine.text_color)}>
                        {routine.name}
                    </h4>
                </div>
                <div className="flex items-center gap-2">
                    <ChevronRight
                        className={cn(
                            "h-5 w-5 text-gray-400 transition-transform duration-300",
                            isExpanded ? "rotate-90" : ""
                        )}
                    />
                </div>
            </div>

            {lastSummary && (
                <div className="mt-3">
                    <LastSessionCard summary={lastSummary} />
                </div>
            )}

            <div className="space-y-3">
                {visibleExercises.map((ex) => (
                    <div key={ex.id} className="flex items-center gap-3 animate-fadeIn">
                        <div className="h-10 w-10 flex-shrink-0 overflow-hidden rounded-lg bg-gray-700/50">
                            {ex.image_url ? (
                                <img
                                    src={ex.image_url}
                                    alt={ex.name}
                                    className="h-full w-full object-cover"
                                    loading="lazy"
                                    referrerPolicy="no-referrer"
                                    onError={(e) => {
                                        e.target.style.display = 'none';
                                        e.target.parentElement.classList.add('animate-pulse');
                                    }}
                                />
                            ) : (
                                <div className="h-full w-full bg-surface-highlight" />
                            )}
                        </div>
                        <div className="flex flex-1 items-center justify-between text-sm text-text-secondary">
                            <span className="font-medium text-text-primary">{ex.name}</span>
                            <span className="text-xs opacity-70 ml-2 whitespace-nowrap">{ex.series}x{ex.reps}</span>
                        </div>
                    </div>
                ))}
                {!isExpanded && routine.exercises.length > 3 && (
                    <div className="text-xs text-text-secondary opacity-50 pl-[3.25rem]">
                        + {routine.exercises.length - 3} ejercicios más...
                    </div>
                )}
            </div>

            <div className="mt-2 flex items-center justify-end">
                <Button
                    size="sm"
                    className={cn(
                        "rounded-full w-full h-9 transition-all font-bold",
                        isCompleted ? "bg-green-500 text-black shadow-lg shadow-green-500/20" : cn(routine.color, "text-black")
                    )}
                    onClick={(e) => {
                        e.stopPropagation();
                        onStart();
                    }}
                >
                    {isCompleted ? (
                        <>
                            Revisar Entrenamiento
                            <Check className="ml-2 h-4 w-4 stroke-black" strokeWidth={3} />
                        </>
                    ) : (
                        <>
                            Iniciar Rutina
                            <Play className="ml-2 h-4 w-4 fill-black" />
                        </>
                    )}
                </Button>
            </div>
        </Card>
    );
}
```

Nota: `onStart` ya no recibe el evento (el `e.stopPropagation()` se queda en
el `onClick` de arriba, que sigue viviendo en `RoutineCard` porque es parte
del comportamiento de la tarjeta, no de la lógica de negocio) — el padre solo
decide QUÉ pasa al iniciar, no el detalle de parar la propagación del click.

- [ ] **Step 3: Extraer la lógica de "qué pasa al pulsar Iniciar/Revisar"**

Dentro de `DashboardView`, busca `const toggleRoutine = (id) => {` (línea 213
antes de este cambio) y añade justo debajo una función hermana:

```js
    const handleStartRoutine = (routine) => {
        const isCompleted = completedRoutines.includes(routine.id);
        if (isCompleted) {
            onStartDaily(routine);
            return;
        }
        const hasSavedSession = !!localStorage.getItem(`gymTracker_workout_${routine.id}`);
        if (hasSavedSession) {
            onStartDaily(routine);
        } else {
            setPendingRoutine(routine);
            setShowCardioSelector(true);
        }
    };
```

Esto es exactamente la lógica que hoy vive inline en el `onClick` del botón
(dentro del `.map` que se sustituye en el Step 4) — se mueve tal cual, sin
cambiar ningún comportamiento.

- [ ] **Step 4: Sustituir el render por los dos grupos**

Busca el bloque completo que empieza en `{routines.map((routine) => {` y
termina en el `})}` que le corresponde (justo antes del `</div>` que cierra
`<div className="space-y-4">`). Todo ese bloque — la función `.map` inline
completa, con su `<Card>` de ~120 líneas — se reemplaza por:

```jsx
                    {(() => {
                        const { today, rest } = splitRoutinesByToday(routines, new Date().getDay());
                        const renderCard = (routine) => (
                            <RoutineCard
                                key={routine.id}
                                routine={routine}
                                isExpanded={expandedRoutine === routine.id}
                                isCompleted={completedRoutines.includes(routine.id)}
                                lastSummary={lastSummaries[routine.id]}
                                onToggle={() => toggleRoutine(routine.id)}
                                onStart={() => handleStartRoutine(routine)}
                            />
                        );
                        return (
                            <>
                                <h3 className="text-sm font-bold text-text-secondary uppercase tracking-wider">
                                    Hoy toca
                                </h3>
                                {today.length > 0 ? (
                                    today.map(renderCard)
                                ) : (
                                    <Card className="p-5 bg-surface border-dashed border-2 border-surface-highlight text-center">
                                        <p className="text-2xl mb-1">💤</p>
                                        <p className="text-text-primary font-semibold">Hoy toca descanso</p>
                                        <p className="text-text-secondary text-xs mt-1">No tienes ninguna rutina programada para hoy.</p>
                                    </Card>
                                )}
                                {rest.length > 0 && (
                                    <>
                                        <h3 className="text-sm font-bold text-text-secondary uppercase tracking-wider mt-2">
                                            {today.length > 0 ? 'Resto de tus rutinas' : 'Tus rutinas'}
                                        </h3>
                                        {rest.map(renderCard)}
                                    </>
                                )}
                            </>
                        );
                    })()}
```

Esto sustituye únicamente el `.map` y su `<Card>` — el `<div className="space-y-4">` que lo envuelve y el `routines.length === 0 ? (...) : null` que va justo antes (el mensaje "No hay rutinas asignadas") **no cambian, se quedan igual**.

- [ ] **Step 5: Verificar lint**

Run: `npx eslint src/views/DashboardView.jsx`
Expected: mismo único warning preexistente de `onSeeAll` sin usar (ya documentado en `run-rutinex`), sin errores nuevos.

- [ ] **Step 6: Ejecutar la suite**

Run: `npm test`
Expected: PASS, 97 tests (87 previos + 10 de `routineSchedule.test.js`).

- [ ] **Step 7: Commit**

```bash
git add src/views/DashboardView.jsx
git commit -m "$(cat <<'EOF'
feat(cliente): destacar en el Dashboard la rutina programada para hoy

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

## Task 4: `RoutineAssignerView.jsx` — elegir días al crear una rutina

**Files:**
- Modify: `src/views/trainer/RoutineAssignerView.jsx`

- [ ] **Step 1: Importar `WEEKDAY_LABELS`**

Añadir a los imports (junto a `fetchRecentHistorySummary, matchDraftExercisesToCatalog, buildRoutineDraftPayload` de `'../../lib/trainerUtils'`, en una línea nueva ya que es de otro módulo):

```js
import { WEEKDAY_LABELS, isRoutineScheduledForDay } from '../../lib/routineSchedule';
```

- [ ] **Step 2: Añadir el estado `scheduledDays`**

Justo debajo de `const [routineColor, setRoutineColor] = useState(COLORS[0]);`:

```js
    const [scheduledDays, setScheduledDays] = useState([]);
```

- [ ] **Step 3: Añadir el selector de días en el bloque móvil**

Busca el bloque `<div className="md:hidden p-4 space-y-3 border-b border-surface-highlight">` (contiene el input de nombre y el selector de color). Justo después del `</div>` que cierra el `<div className="flex items-center gap-3">` del selector de color (y antes del `</div>` que cierra todo el bloque `md:hidden`), añade:

```jsx
                        <div className="flex items-center gap-2">
                            <span className="text-xs text-text-secondary flex-shrink-0">Días:</span>
                            <div className="flex gap-1">
                                {WEEKDAY_LABELS.map(({ value, label }) => (
                                    <button
                                        key={value}
                                        onClick={() => setScheduledDays(prev =>
                                            isRoutineScheduledForDay(prev, value)
                                                ? prev.filter(d => d !== value)
                                                : [...prev, value].sort((a, b) => a - b)
                                        )}
                                        className={`w-7 h-7 rounded-full text-xs font-bold transition-colors ${isRoutineScheduledForDay(scheduledDays, value) ? 'bg-primary text-black' : 'bg-surface-highlight text-text-secondary hover:text-text-primary'}`}
                                    >
                                        {label}
                                    </button>
                                ))}
                            </div>
                        </div>
```

- [ ] **Step 4: Añadir el mismo selector en el rail de escritorio**

En el `<aside className="hidden md:flex ...">`, justo después del `</div>` que cierra el segundo selector de color (el del rail, línea con `{COLORS.map(c => (` duplicada) y antes del `<div className="border-t border-surface-highlight pt-3">`, añade el mismo bloque exacto del Step 3.

- [ ] **Step 5: Incluir `scheduled_days` en el insert de `handleSave`**

En el `insert` de `routines` dentro de `handleSave`:

```js
            const { error: routineError } = await supabase
                .from('routines')
                .insert([{
                    id: routineId,
                    name: routineName.trim(),
                    color: routineColor.value,
                    border_color: routineColor.border,
                    text_color: routineColor.text,
                    trainer_id: user.id,
                    owner_client_id: client.user_id,
                }]);
```

Cambiar a:

```js
            const { error: routineError } = await supabase
                .from('routines')
                .insert([{
                    id: routineId,
                    name: routineName.trim(),
                    color: routineColor.value,
                    border_color: routineColor.border,
                    text_color: routineColor.text,
                    trainer_id: user.id,
                    owner_client_id: client.user_id,
                    scheduled_days: scheduledDays.length > 0 ? scheduledDays : null,
                }]);
```

- [ ] **Step 6: Verificar lint**

Run: `npx eslint src/views/trainer/RoutineAssignerView.jsx`
Expected: mismo único error preexistente (`onBack` sin usar en `AssignExistingTab`), sin errores nuevos.

- [ ] **Step 7: Ejecutar la suite**

Run: `npm test`
Expected: PASS, 97/97 (este task no añade tests nuevos, es JSX + un campo en un insert).

- [ ] **Step 8: Commit**

```bash
git add src/views/trainer/RoutineAssignerView.jsx
git commit -m "$(cat <<'EOF'
feat(entrenador): elegir días de la semana al crear una rutina nueva

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

## Task 5: `ClientProfileView.jsx` — editar días de una rutina ya asignada

**Files:**
- Modify: `src/views/trainer/ClientProfileView.jsx`

- [ ] **Step 1: Importar `WEEKDAY_LABELS`**

Añadir junto a los demás imports de `lucide-react`/libs:

```js
import { WEEKDAY_LABELS, isRoutineScheduledForDay } from '../../lib/routineSchedule';
```

- [ ] **Step 2: Añadir el handler `handleToggleScheduledDay`**

Justo debajo de la función `handleReorderExercise` (termina con el `};` tras el `catch` que hace `console.error('Error reordering exercises:', error);`), añadir:

```js
    // Fase 3 (parte 1): qué días de la semana toca esta rutina. Optimista +
    // revierte en el catch, mismo criterio que handleToggleTemplate en
    // RoutineAssignerView.jsx (AssignExistingTab) para esta clase de toggle.
    const handleToggleScheduledDay = async (assignmentId, day) => {
        const assignment = assignedRoutines.find(a => a.id === assignmentId);
        if (!assignment) return;
        const current = assignment.routine.scheduled_days || [];
        const next = isRoutineScheduledForDay(current, day)
            ? current.filter(d => d !== day)
            : [...current, day].sort((a, b) => a - b);
        const nextOrNull = next.length > 0 ? next : null;

        setAssignedRoutines(prev => prev.map(a =>
            a.id === assignmentId ? { ...a, routine: { ...a.routine, scheduled_days: nextOrNull } } : a
        ));

        try {
            const { error } = await supabase.from('routines').update({ scheduled_days: nextOrNull }).eq('id', assignment.routine.id);
            if (error) throw error;
        } catch (error) {
            console.error('Error updating scheduled_days:', error);
            setAssignedRoutines(prev => prev.map(a =>
                a.id === assignmentId ? { ...a, routine: { ...a.routine, scheduled_days: current.length > 0 ? current : null } } : a
            ));
        }
    };
```

- [ ] **Step 3: Renderizar el selector en cada card de rutina asignada**

Busca, dentro de `assignedRoutines.map((assignment) => { ... })`, el bloque
`) : (` que renderiza el `<div className="flex justify-between items-center">`
con el nombre de la rutina y la fecha de asignación (el caso "no estoy
editando el nombre"). Justo después del `</div>` que cierra ese
`flex justify-between items-center` (y antes de `)}` que cierra el ternario
`editingRoutineNameId === assignment.id ? (...) : (...)`), añade:

```jsx
                                                <div className="flex items-center gap-1 mt-2" onClick={e => e.stopPropagation()}>
                                                    {WEEKDAY_LABELS.map(({ value, label }) => (
                                                        <button
                                                            key={value}
                                                            onClick={() => handleToggleScheduledDay(assignment.id, value)}
                                                            className={`w-6 h-6 rounded-full text-[10px] font-bold transition-colors ${isRoutineScheduledForDay(routine.scheduled_days, value) ? 'bg-primary text-black' : 'bg-surface-highlight text-text-secondary hover:text-text-primary'}`}
                                                        >
                                                            {label}
                                                        </button>
                                                    ))}
                                                </div>
```

(`routine` aquí es la misma variable ya desestructurada arriba en el `.map`,
`const { routine } = assignment;` — no hace falta volver a leerla.)

- [ ] **Step 4: Verificar lint**

Run: `npx eslint src/views/trainer/ClientProfileView.jsx`
Expected: sin errores nuevos.

- [ ] **Step 5: Ejecutar la suite**

Run: `npm test`
Expected: PASS, 97/97.

- [ ] **Step 6: Commit**

```bash
git add src/views/trainer/ClientProfileView.jsx
git commit -m "$(cat <<'EOF'
feat(entrenador): editar días de la semana de una rutina ya asignada

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

## Task 6: Verificación en navegador

**Files:** ninguno

- [ ] **Step 1: Arrancar la app (skill `run-rutinex`)**

- [ ] **Step 2: Flujo de entrenador**

Login `admin@gymtracker.com`. Ir a un cliente → asignar una rutina nueva → confirmar que aparece el selector de 7 días junto al nombre/color, marcar 2-3 días, guardar. Volver a la ficha del cliente, confirmar que la rutina recién creada muestra esos mismos días marcados en su card de "Rutinas Asignadas", y que se pueden cambiar ahí (marcar/desmarcar) sin recargar la página.

- [ ] **Step 3: Confirmar en BD (solo lectura)**

Con `mcp__supabase__execute_sql`:
```sql
select id, name, scheduled_days from routines where id = '<id de la rutina creada en el Step 2>';
```
Expected: `scheduled_days` refleja exactamente los días marcados en la UI, como array de enteros 0-6.

- [ ] **Step 4: Dashboard del cliente**

No hay cuenta de prueba de cliente en el repo — si el usuario puede probar con su cuenta real de cliente (Carlos), pedirle que confirme: la rutina con el día de hoy marcado aparece bajo "Hoy toca" arriba del todo; el resto de rutinas asignadas siguen apareciendo debajo bajo "Resto de tus rutinas"; si ninguna rutina tiene hoy marcado, aparece la card "💤 Hoy toca descanso". Si no se puede probar con esa cuenta en esta sesión, dejarlo anotado como pendiente de validar la próxima vez que el usuario abra la PWA como cliente — no bloquea el resto de la verificación.

- [ ] **Step 5: Revisar consola**

Sin errores nuevos de red o de JS en ninguna de las pantallas tocadas.

---

## Self-review

**Cobertura del spec:**
- Columna `scheduled_days smallint[]`, null = sin día fijo, convención `getDay()` → Task 1. ✓
- Dashboard destaca hoy y muestra el resto debajo, sin filtrar/ocultar → Task 3. ✓
- Card de descanso cuando hoy no toca nada (incluyendo el caso "ninguna rutina tiene scheduled_days") → Task 3, Step 4 (el `else` de `today.length > 0` cubre ambos casos por construcción, tal como decía el spec). ✓
- Una rutina admite varios días (multi-toggle, no radio) → Tasks 4 y 5 usan `filter`/`[...prev, value]`, nunca un único valor. ✓
- Solo el entrenador asigna/edita días (`RoutineAssignerView.jsx` al crear, `ClientProfileView.jsx` para ya asignadas) — ninguna pantalla de cliente se toca. ✓
- `WEEKDAY_LABELS` en orden L-M-X-J-V-S-D con valores `getDay()` → Task 2. ✓
- Sin tabla nueva, sin RLS nueva → Task 1 es solo `alter table`. ✓

**Placeholders:** ninguno — cada step trae el código completo, incluyendo dónde insertarlo con referencias exactas a bloques ya existentes en el archivo.

**Consistencia de tipos:** `scheduled_days` (BD, snake_case) vs `scheduledDays` (estado React, camelCase) es la misma convención que ya usa el resto del archivo (`ex.image_url` en BD/props vs variables locales camelCase) — no es una inconsistencia, es el patrón establecido. `isRoutineScheduledForDay`/`WEEKDAY_LABELS`/`splitRoutinesByToday` se importan con el mismo nombre en los tres archivos que los usan (Tasks 3, 4, 5) y ninguno los reimplementa por su cuenta.
