# Mesociclo con progresión programada — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let a trainer define, per exercise of an already-assigned routine, a week-by-week progression (series/reps/target_weight/target_rir) that the app applies automatically based on a per-routine mesocycle start date, with no manual weekly re-editing.

**Architecture:** Two nullable columns (`routines.mesocycle_start_date`, `exercises.weekly_progression` jsonb) plus a new pure module `src/lib/mesocycle.js` that computes the active week and overlays it onto an exercise's base fields. The overlay is applied at exactly two read sites: `DashboardView.jsx` (client, covers both the dashboard cards and the object handed to the live workout) and `ClientProfileView.jsx` (trainer's own view of the routine). No cron, no batch writes — everything is computed live from `mesocycle_start_date` and "today".

**Tech Stack:** React 19, Supabase (Postgres), Vitest.

---

### Task 1: Migration — mesocycle columns

**Files:**
- Create: `supabase/migrations/20260915_add_mesocycle_progression.sql`

- [ ] **Step 1: Write the migration file**

```sql
-- Fase 3 (parte 2) del plan de entrenador: mesociclo con progresión
-- programada. Depende de la parte 1 (scheduled_days, ya aplicada) solo en
-- el orden de las fases, no en el esquema.
--
-- Decisiones (2026-09-15, ver docs/superpowers/specs/2026-09-15-mesociclo-progresion-design.md):
--  - mesocycle_start_date vive en `routines` (no en assigned_routines):
--    cada rutina asignada ya es una copia privada por cliente, así que es
--    1:1 con la rutina, no con la relación de asignación.
--  - weekly_progression es un array JSON de
--    {week, series, reps, target_weight, target_rir} por ejercicio. No hay
--    tabla aparte por el mismo motivo que scheduled_days: sobre-ingeniería
--    para, como mucho, un puñado de filas sin relaciones propias.
--  - No hay columna de "duración del mesociclo" ni de fecha de fin: la
--    duración es implícita en cuántas semanas tenga cada
--    weekly_progression. Al superar la última semana definida, la app se
--    congela ahí (lógica en src/lib/mesocycle.js, no en la base de datos).

alter table public.routines add column if not exists mesocycle_start_date date;
alter table public.exercises add column if not exists weekly_progression jsonb;

comment on column public.routines.mesocycle_start_date is
    'Fecha de inicio del mesociclo de esta rutina asignada. Null = sin mesociclo (Fase 3 parte 2).';
comment on column public.exercises.weekly_progression is
    'Array [{week, series, reps, target_weight, target_rir}] por semana. Null o [] = sin progresión, usa las columnas base (Fase 3 parte 2).';
```

- [ ] **Step 2: Apply the migration to the live Supabase project**

Use `mcp__supabase__apply_migration` with `name: "add_mesocycle_progression"` and the SQL body above (project `jqpyqqlkgisykgywilrf`). This is additive-only (two nullable columns) — allowed under the CLAUDE.md constraint on production data.

- [ ] **Step 3: Verify live**

Use `mcp__supabase__execute_sql`:

```sql
select column_name, data_type from information_schema.columns
where table_name = 'routines' and column_name = 'mesocycle_start_date'
union all
select column_name, data_type from information_schema.columns
where table_name = 'exercises' and column_name = 'weekly_progression';
```

Expected: two rows, `mesocycle_start_date` / `date`, `weekly_progression` / `jsonb`.

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/20260915_add_mesocycle_progression.sql
git commit -m "feat(db): añadir mesocycle_start_date y weekly_progression"
```

---

### Task 2: `src/lib/mesocycle.js` — pure functions + tests

**Files:**
- Create: `src/lib/mesocycle.js`
- Test: `src/lib/mesocycle.test.js`

- [ ] **Step 1: Write the failing tests**

```js
// src/lib/mesocycle.test.js
import { describe, it, expect } from 'vitest';
import { getCurrentMesocycleWeek, applyMesocycleWeek } from './mesocycle';

describe('getCurrentMesocycleWeek', () => {
    it('returns null without a start date', () => {
        expect(getCurrentMesocycleWeek(null, new Date('2026-09-15'))).toBeNull();
        expect(getCurrentMesocycleWeek(undefined, new Date('2026-09-15'))).toBeNull();
    });

    it('returns week 1 on the start date itself', () => {
        expect(getCurrentMesocycleWeek('2026-09-15', new Date('2026-09-15'))).toBe(1);
    });

    it('returns week 2 after exactly 7 days', () => {
        expect(getCurrentMesocycleWeek('2026-09-15', new Date('2026-09-22'))).toBe(2);
    });

    it('returns week 2 at 13 days and week 3 at 14 days', () => {
        expect(getCurrentMesocycleWeek('2026-09-15', new Date('2026-09-28'))).toBe(2);
        expect(getCurrentMesocycleWeek('2026-09-15', new Date('2026-09-29'))).toBe(3);
    });

    it('treats a future start date as week 1, never negative or zero', () => {
        expect(getCurrentMesocycleWeek('2026-10-01', new Date('2026-09-15'))).toBe(1);
    });
});

describe('applyMesocycleWeek', () => {
    const base = { id: 'ex1', series: '3', reps: '10', target_weight: 40, target_rir: 3, rest_seconds: 90 };

    it('returns the exercise unchanged without a week number', () => {
        expect(applyMesocycleWeek({ ...base, weekly_progression: [{ week: 1, series: 4, reps: 8, target_weight: 60, target_rir: 2 }] }, null)).toEqual(
            { ...base, weekly_progression: [{ week: 1, series: 4, reps: 8, target_weight: 60, target_rir: 2 }] }
        );
    });

    it('returns the exercise unchanged without weekly_progression', () => {
        expect(applyMesocycleWeek(base, 2)).toEqual(base);
        expect(applyMesocycleWeek({ ...base, weekly_progression: [] }, 2)).toEqual({ ...base, weekly_progression: [] });
    });

    it('applies the exact week when it exists', () => {
        const ex = {
            ...base,
            weekly_progression: [
                { week: 1, series: 4, reps: 8, target_weight: 60, target_rir: 3 },
                { week: 2, series: 4, reps: 6, target_weight: 65, target_rir: 2 },
            ],
        };
        const result = applyMesocycleWeek(ex, 2);
        expect(result.series).toBe(4);
        expect(result.reps).toBe(6);
        expect(result.target_weight).toBe(65);
        expect(result.target_rir).toBe(2);
        expect(result.rest_seconds).toBe(90);
    });

    it('freezes at the last defined week once the current week exceeds it', () => {
        const ex = {
            ...base,
            weekly_progression: [
                { week: 1, series: 4, reps: 8, target_weight: 60, target_rir: 3 },
                { week: 2, series: 4, reps: 6, target_weight: 65, target_rir: 2 },
            ],
        };
        const result = applyMesocycleWeek(ex, 5);
        expect(result.target_weight).toBe(65);
        expect(result.reps).toBe(6);
    });

    it('sorts unordered entries before picking', () => {
        const ex = {
            ...base,
            weekly_progression: [
                { week: 2, series: 4, reps: 6, target_weight: 65, target_rir: 2 },
                { week: 1, series: 4, reps: 8, target_weight: 60, target_rir: 3 },
            ],
        };
        expect(applyMesocycleWeek(ex, 1).target_weight).toBe(60);
        expect(applyMesocycleWeek(ex, 2).target_weight).toBe(65);
    });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `TZ=UTC npx vitest run src/lib/mesocycle.test.js`
Expected: FAIL — `Failed to resolve import "./mesocycle"`.

- [ ] **Step 3: Write the implementation**

```js
// src/lib/mesocycle.js
// Fase 3 (parte 2) del plan de entrenador: mesociclo con progresión
// programada. Ver docs/superpowers/specs/2026-09-15-mesociclo-progresion-design.md.
// Funciones puras: `today` siempre se pasa como parámetro, nunca se llama
// a `new Date()` dentro, para que sean testeables con cualquier fecha fija.

/**
 * Semana activa del mesociclo (1, 2, 3...) según la fecha de inicio y hoy.
 * Sin `startDate`, no hay mesociclo activo — null, nunca 0 ni negativo.
 * Una fecha de inicio futura se trata como semana 1: no existe un estado
 * intermedio de "aún no ha empezado".
 */
export function getCurrentMesocycleWeek(startDate, today) {
    if (!startDate) return null;
    const start = new Date(startDate);
    const diffDays = Math.floor((today.getTime() - start.getTime()) / 86400000);
    return Math.max(1, Math.floor(diffDays / 7) + 1);
}

/**
 * Devuelve el ejercicio con series/reps/target_weight/target_rir
 * sustituidos por los de la semana activa. Sin `weekNumber` o sin
 * `weekly_progression` (null o vacío), devuelve el ejercicio sin cambios.
 * Si `weekNumber` supera la última semana definida, usa la última
 * (congelado, decisión de diseño: nunca vuelve a un estado "vacío").
 */
export function applyMesocycleWeek(exercise, weekNumber) {
    const progression = exercise.weekly_progression;
    if (!weekNumber || !Array.isArray(progression) || progression.length === 0) {
        return exercise;
    }
    const sorted = [...progression].sort((a, b) => a.week - b.week);
    const eligible = sorted.filter(w => w.week <= weekNumber);
    const entry = eligible.length > 0 ? eligible[eligible.length - 1] : sorted[0];
    return {
        ...exercise,
        series: entry.series,
        reps: entry.reps,
        target_weight: entry.target_weight,
        target_rir: entry.target_rir,
    };
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `TZ=UTC npx vitest run src/lib/mesocycle.test.js`
Expected: PASS, 9 tests.

- [ ] **Step 5: Commit**

```bash
git add src/lib/mesocycle.js src/lib/mesocycle.test.js
git commit -m "feat(mesociclo): funciones puras de progresión semanal"
```

---

### Task 3: `DashboardView.jsx` — aplicar la semana activa en el lado cliente

**Files:**
- Modify: `src/views/DashboardView.jsx:9` (import), `src/views/DashboardView.jsx:230-233` (mergedRoutines construction)

**Context:** `fetchRoutines` builds `mergedRoutines` by attaching each routine's `exercises` array (lines 230-233 today):

```js
const mergedRoutines = routinesData.map(routine => ({
    ...routine,
    exercises: exercisesData.filter(ex => ex.routine_id === routine.id)
}));
```

This same `mergedRoutines` array is what both the Dashboard's cards render (via `splitRoutinesByToday`) and what `handleStartRoutine` passes on to `handleStartWorkout` → `TrainingView` → `ExerciseDetailModal` (traced: `ExerciseDetailModal.jsx` reads `exercise.target_weight`/`.target_rir`/`.rest_seconds` directly off whatever object it's given, no further Supabase fetch in between). So applying the mesocycle overlay once here, at construction time, is enough to cover the entire client-side path with no other file changes.

- [ ] **Step 1: Add the import**

In `src/views/DashboardView.jsx`, change line 9:

```js
import { splitRoutinesByToday } from '../lib/routineSchedule';
```

to:

```js
import { splitRoutinesByToday } from '../lib/routineSchedule';
import { getCurrentMesocycleWeek, applyMesocycleWeek } from '../lib/mesocycle';
```

- [ ] **Step 2: Apply the overlay when building `mergedRoutines`**

Replace:

```js
            const mergedRoutines = routinesData.map(routine => ({
                ...routine,
                exercises: exercisesData.filter(ex => ex.routine_id === routine.id)
            }));
```

with:

```js
            const today = new Date();
            const mergedRoutines = routinesData.map(routine => {
                const week = getCurrentMesocycleWeek(routine.mesocycle_start_date, today);
                const exercises = exercisesData
                    .filter(ex => ex.routine_id === routine.id)
                    .map(ex => applyMesocycleWeek(ex, week));
                return { ...routine, exercises };
            });
```

- [ ] **Step 3: Verify existing tests still pass**

Run: `TZ=UTC npm test`
Expected: 106 tests passed (97 existing + 9 new from Task 2), no failures. `DashboardView.jsx` has no dedicated test file (component, not pure logic — same convention as the rest of the file), so this step only confirms nothing else broke.

- [ ] **Step 4: Commit**

```bash
git add src/views/DashboardView.jsx
git commit -m "feat(mesociclo): aplicar semana activa a los ejercicios del cliente"
```

---

### Task 4: `ClientProfileView.jsx` — fecha de inicio de mesociclo + badge de semana

**Files:**
- Modify: `src/views/trainer/ClientProfileView.jsx`

**Context:** This task adds only the start-date control and the week badge — not the per-exercise weekly table (that's Task 5). It follows the exact same optimistic-update-with-re-fetch-on-failure pattern already used by `handleToggleScheduledDay` (lines 211-247), including its bug-fix history (never revert to a stale local snapshot; re-read the true value from Supabase on failure).

- [ ] **Step 1: Add the import**

Change line 7:

```js
import { WEEKDAY_LABELS, isRoutineScheduledForDay } from '../../lib/routineSchedule';
```

to:

```js
import { WEEKDAY_LABELS, isRoutineScheduledForDay } from '../../lib/routineSchedule';
import { getCurrentMesocycleWeek } from '../../lib/mesocycle';
```

- [ ] **Step 2: Add `handleSetMesocycleStart`, right after `handleToggleScheduledDay` (after line 247)**

```js
    // Fase 3 (parte 2): fecha de inicio del mesociclo de esta rutina.
    // Mismo patrón optimista + re-fetch-en-el-catch que
    // handleToggleScheduledDay — no revertir a un snapshot local obsoleto.
    const handleSetMesocycleStart = async (assignmentId, dateOrNull) => {
        const assignment = assignedRoutines.find(a => a.id === assignmentId);
        if (!assignment) return;

        setAssignedRoutines(prev => prev.map(a =>
            a.id === assignmentId ? { ...a, routine: { ...a.routine, mesocycle_start_date: dateOrNull } } : a
        ));

        try {
            const { error } = await supabase.from('routines').update({ mesocycle_start_date: dateOrNull }).eq('id', assignment.routine.id);
            if (error) throw error;
        } catch (error) {
            console.error('Error updating mesocycle_start_date:', error);
            try {
                const { data, error: refetchError } = await supabase
                    .from('routines')
                    .select('mesocycle_start_date')
                    .eq('id', assignment.routine.id)
                    .single();
                if (refetchError) throw refetchError;
                setAssignedRoutines(prev => prev.map(a =>
                    a.id === assignmentId ? { ...a, routine: { ...a.routine, mesocycle_start_date: data.mesocycle_start_date } } : a
                ));
            } catch (refetchErr) {
                console.error('Error re-fetching mesocycle_start_date after failed update:', refetchErr);
            }
        }
    };
```

- [ ] **Step 3: Render the date input and week badge**

In the non-renaming branch of the routine card, right after the weekday-toggle row (the block ending at line 587, `</div>` closing the `flex items-center gap-1 mt-2` div), add a new row. Replace:

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
                                                </>
```

with:

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
                                                <div className="flex items-center gap-2 mt-2" onClick={e => e.stopPropagation()}>
                                                    <label className="text-[10px] uppercase tracking-wide text-text-secondary flex items-center gap-1.5">
                                                        Mesociclo
                                                        <input
                                                            type="date"
                                                            value={routine.mesocycle_start_date || ''}
                                                            onChange={(e) => handleSetMesocycleStart(assignment.id, e.target.value || null)}
                                                            className="bg-surface-highlight border border-transparent rounded-lg px-2 py-1 text-xs text-text-primary focus:outline-none focus:border-primary"
                                                        />
                                                    </label>
                                                    {routine.mesocycle_start_date && (
                                                        <span className="text-[10px] font-bold text-primary bg-primary/10 px-2 py-1 rounded-full">
                                                            Semana {getCurrentMesocycleWeek(routine.mesocycle_start_date, new Date())}
                                                        </span>
                                                    )}
                                                </div>
                                                </>
```

- [ ] **Step 4: Verify no test regressions**

Run: `TZ=UTC npm test`
Expected: same 106 passing as after Task 3 — this task is UI-only, no new pure-function tests (consistent with `handleToggleScheduledDay` having none either).

- [ ] **Step 5: Commit**

```bash
git add src/views/trainer/ClientProfileView.jsx
git commit -m "feat(mesociclo): fecha de inicio y badge de semana activa en ficha de cliente"
```

---

### Task 5: `ClientProfileView.jsx` — editor de progresión semanal por ejercicio

**Files:**
- Modify: `src/views/trainer/ClientProfileView.jsx`

**Context:** This is the last piece: the per-exercise "Progresión por semanas" checkbox + table inside the existing exercise editor (`editingExercise`/`startEditExercise`/`handleSaveEdit`), and showing the *effective* (current-week) values on the collapsed exercise row instead of the raw base ones.

- [ ] **Step 1: Import `applyMesocycleWeek` alongside `getCurrentMesocycleWeek`**

Change the import added in Task 4:

```js
import { getCurrentMesocycleWeek } from '../../lib/mesocycle';
```

to:

```js
import { getCurrentMesocycleWeek, applyMesocycleWeek } from '../../lib/mesocycle';
```

- [ ] **Step 2: Extend `startEditExercise` to seed the weekly-progression state**

Replace (lines 289-303):

```js
    const startEditExercise = (e, ex, assignmentId) => {
        e.stopPropagation();
        setEditingExercise({
            id: ex.id,
            assignmentId,
            series: Number(ex.series) || 3,
            reps: Number(ex.reps) || 10,
            // Prescripción (Fase 1). Cadenas vacías = sin prescribir.
            target_weight: ex.target_weight ?? '',
            target_rir: ex.target_rir ?? '',
            rest_seconds: ex.rest_seconds ?? '',
            tempo: ex.tempo ?? '',
            notes: ex.notes ?? '',
        });
    };
```

with:

```js
    const startEditExercise = (e, ex, assignmentId) => {
        e.stopPropagation();
        const hasProgression = Array.isArray(ex.weekly_progression) && ex.weekly_progression.length > 0;
        setEditingExercise({
            id: ex.id,
            assignmentId,
            series: Number(ex.series) || 3,
            reps: Number(ex.reps) || 10,
            // Prescripción (Fase 1). Cadenas vacías = sin prescribir.
            target_weight: ex.target_weight ?? '',
            target_rir: ex.target_rir ?? '',
            rest_seconds: ex.rest_seconds ?? '',
            tempo: ex.tempo ?? '',
            notes: ex.notes ?? '',
            // Progresión por semanas (Fase 3 parte 2).
            useWeeklyProgression: hasProgression,
            weeklyProgression: hasProgression
                ? [...ex.weekly_progression].sort((a, b) => a.week - b.week)
                : [{ week: 1, series: Number(ex.series) || 3, reps: Number(ex.reps) || 10, target_weight: ex.target_weight ?? '', target_rir: ex.target_rir ?? '' }],
        });
    };
```

- [ ] **Step 3: Add row-management helpers, right after `startEditExercise`**

```js
    const addProgressionWeek = () => {
        setEditingExercise(prev => {
            const rows = prev.weeklyProgression;
            const last = rows[rows.length - 1];
            return { ...prev, weeklyProgression: [...rows, { ...last, week: last.week + 1 }] };
        });
    };

    const removeProgressionWeek = (week) => {
        setEditingExercise(prev => ({
            ...prev,
            weeklyProgression: prev.weeklyProgression.length > 1
                ? prev.weeklyProgression.filter(row => row.week !== week)
                : prev.weeklyProgression,
        }));
    };

    const updateProgressionRow = (week, field, value) => {
        setEditingExercise(prev => ({
            ...prev,
            weeklyProgression: prev.weeklyProgression.map(row =>
                row.week === week ? { ...row, [field]: value } : row
            ),
        }));
    };
```

- [ ] **Step 4: Extend `handleSaveEdit` to persist `weekly_progression`**

Replace (lines 305-343):

```js
    const handleSaveEdit = async (e) => {
        e.stopPropagation();
        if (!editingExercise) return;
        setSavingEdit(true);
        try {
            const numOrNull = (v) => (v === '' || v == null ? null : Number(v));
            const strOrNull = (v) => (v?.trim() ? v.trim() : null);
            const patch = {
                series: String(editingExercise.series),
                reps: String(editingExercise.reps),
                target_weight: numOrNull(editingExercise.target_weight),
                target_rir: numOrNull(editingExercise.target_rir),
                rest_seconds: numOrNull(editingExercise.rest_seconds),
                tempo: strOrNull(editingExercise.tempo),
                notes: strOrNull(editingExercise.notes),
            };

            const { error } = await supabase.from('exercises').update(patch).eq('id', editingExercise.id);
            if (error) throw error;

            setAssignedRoutines(prev => prev.map(a => {
                if (a.id !== editingExercise.assignmentId) return a;
                return {
                    ...a,
                    routine: {
                        ...a.routine,
                        exercises: a.routine.exercises.map(ex =>
                            ex.id === editingExercise.id ? { ...ex, ...patch } : ex
                        )
                    }
                };
            }));
            setEditingExercise(null);
        } catch (err) {
            console.error('Error updating exercise:', err);
        } finally {
            setSavingEdit(false);
        }
    };
```

with:

```js
    const handleSaveEdit = async (e) => {
        e.stopPropagation();
        if (!editingExercise) return;
        setSavingEdit(true);
        try {
            const numOrNull = (v) => (v === '' || v == null ? null : Number(v));
            const strOrNull = (v) => (v?.trim() ? v.trim() : null);

            let patch;
            if (editingExercise.useWeeklyProgression) {
                const weeklyProgression = editingExercise.weeklyProgression.map(row => ({
                    week: row.week,
                    series: Number(row.series),
                    reps: Number(row.reps),
                    target_weight: numOrNull(row.target_weight),
                    target_rir: numOrNull(row.target_rir),
                }));
                const firstWeek = weeklyProgression[0];
                patch = {
                    series: String(firstWeek.series),
                    reps: String(firstWeek.reps),
                    target_weight: firstWeek.target_weight,
                    target_rir: firstWeek.target_rir,
                    rest_seconds: numOrNull(editingExercise.rest_seconds),
                    tempo: strOrNull(editingExercise.tempo),
                    notes: strOrNull(editingExercise.notes),
                    weekly_progression: weeklyProgression,
                };
            } else {
                patch = {
                    series: String(editingExercise.series),
                    reps: String(editingExercise.reps),
                    target_weight: numOrNull(editingExercise.target_weight),
                    target_rir: numOrNull(editingExercise.target_rir),
                    rest_seconds: numOrNull(editingExercise.rest_seconds),
                    tempo: strOrNull(editingExercise.tempo),
                    notes: strOrNull(editingExercise.notes),
                    weekly_progression: null,
                };
            }

            const { error } = await supabase.from('exercises').update(patch).eq('id', editingExercise.id);
            if (error) throw error;

            setAssignedRoutines(prev => prev.map(a => {
                if (a.id !== editingExercise.assignmentId) return a;
                return {
                    ...a,
                    routine: {
                        ...a.routine,
                        exercises: a.routine.exercises.map(ex =>
                            ex.id === editingExercise.id ? { ...ex, ...patch } : ex
                        )
                    }
                };
            }));
            setEditingExercise(null);
        } catch (err) {
            console.error('Error updating exercise:', err);
        } finally {
            setSavingEdit(false);
        }
    };
```

- [ ] **Step 5: Compute the effective exercise once per routine, before the exercises list**

The exercises `.map` starts at line 596 (`routine.exercises.map((ex, idx) => {`), inside the `isExpanded` block that starts at line 592. Add the active-week computation right before that block starts. Replace:

```jsx
                                            {isExpanded && (
                                                <div className="mt-4 space-y-2 pt-4 border-t border-surface-highlight">
                                                    {routine.exercises.length === 0 ? (
                                                        <p className="text-xs text-text-secondary">Sin ejercicios.</p>
                                                    ) : (
                                                        routine.exercises.map((ex, idx) => {
                                                            const isEditing = editingExercise?.id === ex.id;
                                                            return (
```

with:

```jsx
                                            {isExpanded && (() => {
                                                const activeWeek = getCurrentMesocycleWeek(routine.mesocycle_start_date, new Date());
                                                return (
                                                <div className="mt-4 space-y-2 pt-4 border-t border-surface-highlight">
                                                    {routine.exercises.length === 0 ? (
                                                        <p className="text-xs text-text-secondary">Sin ejercicios.</p>
                                                    ) : (
                                                        routine.exercises.map((ex, idx) => {
                                                            const isEditing = editingExercise?.id === ex.id;
                                                            const effectiveEx = applyMesocycleWeek(ex, activeWeek);
                                                            return (
```

And close the new wrapping IIFE + fragment. The `isExpanded && (...)` block currently closes at line 738 with:

```jsx
                                                </div>
                                            )}
```

Change it to:

```jsx
                                                </div>
                                                );
                                            })()}
```

- [ ] **Step 6: Show effective values on the collapsed row**

Replace (lines 661-666):

```jsx
                                                        <div className="flex items-center gap-1 flex-shrink-0">
                                                            <span className="text-xs text-text-secondary font-mono bg-surface px-2 py-1 rounded-md">
                                                                {ex.series}×{ex.reps}{isTimeBasedExercise(ex) ? 'm' : ''}
                                                                {ex.target_weight != null && ` · ${String(ex.target_weight).replace('.', ',')}kg`}
                                                                {ex.target_rir != null && ` · RIR${ex.target_rir}`}
                                                            </span>
```

with:

```jsx
                                                        <div className="flex items-center gap-1 flex-shrink-0">
                                                            <span className="text-xs text-text-secondary font-mono bg-surface px-2 py-1 rounded-md">
                                                                {effectiveEx.series}×{effectiveEx.reps}{isTimeBasedExercise(ex) ? 'm' : ''}
                                                                {effectiveEx.target_weight != null && ` · ${String(effectiveEx.target_weight).replace('.', ',')}kg`}
                                                                {effectiveEx.target_rir != null && ` · RIR${effectiveEx.target_rir}`}
                                                            </span>
```

(`isTimeBasedExercise(ex)` stays on the raw `ex` — it inspects the exercise's category/unit, not its weekly values, so it's unaffected by the overlay.)

- [ ] **Step 7: Add the "Progresión por semanas" checkbox and table to the edit form**

Replace the `Peso objetivo` / `RIR` labels inside the edit-form grid (lines 685-696):

```jsx
                                                                        <label className="flex flex-col gap-1 text-[10px] uppercase tracking-wide text-text-secondary">
                                                                            Peso objetivo (kg)
                                                                            <input type="number" inputMode="decimal" value={editingExercise.target_weight}
                                                                                onChange={(e) => setEditingExercise(p => ({ ...p, target_weight: e.target.value }))}
                                                                                className="bg-surface border border-surface-highlight rounded-lg px-2 py-1.5 text-sm text-text-primary focus:outline-none focus:border-primary" placeholder="—" />
                                                                        </label>
                                                                        <label className="flex flex-col gap-1 text-[10px] uppercase tracking-wide text-text-secondary">
                                                                            RIR (0-5)
                                                                            <input type="number" min="0" max="5" value={editingExercise.target_rir}
                                                                                onChange={(e) => setEditingExercise(p => ({ ...p, target_rir: e.target.value }))}
                                                                                className="bg-surface border border-surface-highlight rounded-lg px-2 py-1.5 text-sm text-text-primary focus:outline-none focus:border-primary" placeholder="—" />
                                                                        </label>
```

with:

```jsx
                                                                        <label className="col-span-2 flex items-center gap-2 text-[10px] uppercase tracking-wide text-text-secondary">
                                                                            <input
                                                                                type="checkbox"
                                                                                checked={editingExercise.useWeeklyProgression}
                                                                                onChange={(e) => setEditingExercise(p => ({ ...p, useWeeklyProgression: e.target.checked }))}
                                                                                className="accent-primary"
                                                                            />
                                                                            Progresión por semanas
                                                                        </label>
                                                                        {editingExercise.useWeeklyProgression ? (
                                                                            <div className="col-span-2 space-y-1.5">
                                                                                {editingExercise.weeklyProgression.map((row) => (
                                                                                    <div key={row.week} className="flex items-center gap-1.5">
                                                                                        <span className="w-14 flex-shrink-0 text-[10px] text-text-secondary">Sem. {row.week}</span>
                                                                                        <input type="number" min="1" value={row.series}
                                                                                            onChange={(e) => updateProgressionRow(row.week, 'series', e.target.value)}
                                                                                            className="w-12 bg-surface border border-surface-highlight rounded-lg px-1.5 py-1 text-xs text-text-primary focus:outline-none focus:border-primary" placeholder="Ser." />
                                                                                        <input type="number" min="1" value={row.reps}
                                                                                            onChange={(e) => updateProgressionRow(row.week, 'reps', e.target.value)}
                                                                                            className="w-12 bg-surface border border-surface-highlight rounded-lg px-1.5 py-1 text-xs text-text-primary focus:outline-none focus:border-primary" placeholder="Reps" />
                                                                                        <input type="number" inputMode="decimal" value={row.target_weight}
                                                                                            onChange={(e) => updateProgressionRow(row.week, 'target_weight', e.target.value)}
                                                                                            className="w-16 bg-surface border border-surface-highlight rounded-lg px-1.5 py-1 text-xs text-text-primary focus:outline-none focus:border-primary" placeholder="Kg" />
                                                                                        <input type="number" min="0" max="5" value={row.target_rir}
                                                                                            onChange={(e) => updateProgressionRow(row.week, 'target_rir', e.target.value)}
                                                                                            className="w-12 bg-surface border border-surface-highlight rounded-lg px-1.5 py-1 text-xs text-text-primary focus:outline-none focus:border-primary" placeholder="RIR" />
                                                                                        <button
                                                                                            onClick={() => removeProgressionWeek(row.week)}
                                                                                            disabled={editingExercise.weeklyProgression.length === 1}
                                                                                            className="w-6 h-6 flex-shrink-0 rounded-md hover:bg-red-500/10 flex items-center justify-center disabled:opacity-20"
                                                                                        >
                                                                                            <X size={11} className="text-text-secondary hover:text-red-500" />
                                                                                        </button>
                                                                                    </div>
                                                                                ))}
                                                                                <button
                                                                                    onClick={addProgressionWeek}
                                                                                    className="text-[10px] font-bold text-primary flex items-center gap-1"
                                                                                >
                                                                                    <Plus size={11} /> Semana
                                                                                </button>
                                                                            </div>
                                                                        ) : (
                                                                            <>
                                                                                <label className="flex flex-col gap-1 text-[10px] uppercase tracking-wide text-text-secondary">
                                                                                    Peso objetivo (kg)
                                                                                    <input type="number" inputMode="decimal" value={editingExercise.target_weight}
                                                                                        onChange={(e) => setEditingExercise(p => ({ ...p, target_weight: e.target.value }))}
                                                                                        className="bg-surface border border-surface-highlight rounded-lg px-2 py-1.5 text-sm text-text-primary focus:outline-none focus:border-primary" placeholder="—" />
                                                                                </label>
                                                                                <label className="flex flex-col gap-1 text-[10px] uppercase tracking-wide text-text-secondary">
                                                                                    RIR (0-5)
                                                                                    <input type="number" min="0" max="5" value={editingExercise.target_rir}
                                                                                        onChange={(e) => setEditingExercise(p => ({ ...p, target_rir: e.target.value }))}
                                                                                        className="bg-surface border border-surface-highlight rounded-lg px-2 py-1.5 text-sm text-text-primary focus:outline-none focus:border-primary" placeholder="—" />
                                                                                </label>
                                                                            </>
                                                                        )}
```

- [ ] **Step 8: Run full test suite**

Run: `TZ=UTC npm test`
Expected: 106 passed, 0 failed (no new pure-function tests in this task — same convention as the rest of this file's JSX/Supabase-wrapper code).

- [ ] **Step 9: Run lint**

Run: `npm run lint`
Expected: same 2 pre-existing errors as on `main` (`onSeeAll` in `DashboardView.jsx`, `onBack` in `RoutineAssignerView.jsx`), no new ones introduced by this task's changes to `ClientProfileView.jsx`.

- [ ] **Step 10: Commit**

```bash
git add src/views/trainer/ClientProfileView.jsx
git commit -m "feat(mesociclo): editor de progresión semanal por ejercicio"
```

---

### Task 6: Verificación en navegador

**Files:** none (verification only, throwaway script)

**Context:** Same constraint as every prior verification pass in this project (CLAUDE.md): only navigate and capture, never click Guardar/Asignar/Terminar against Carlos's real account. Use the `run-rutinex` skill for the startup sequence.

- [ ] **Step 1: Start the dev server**

```bash
[ -d node_modules ] || npm install
nohup npm run dev > /tmp/rutinex-dev.log 2>&1 & disown
for i in $(seq 1 20); do curl -sf http://localhost:5173 >/dev/null 2>&1 && break; sleep 1; done
```

- [ ] **Step 2: Write a throwaway Playwright script at `tools/verify-mesociclo.local.mjs`**

Log in as `admin@gymtracker.com` / `admin123$$`, navigate to Carlos's client profile, expand one of his real assigned routines, and screenshot:
1. The new "Mesociclo" date input and weekday row rendering side by side.
2. One exercise's edit form opened with the "Progresión por semanas" checkbox visible (toggle it on to confirm the table renders with an "+ Semana" button and week rows), **without saving**.

Do not set an actual mesocycle start date on any of Carlos's real routines, and do not save any exercise edit — only navigate, toggle the local checkbox to see the table render, and screenshot. This mirrors exactly how the calendario semanal verification (Task 6 of the previous plan) avoided writing to Carlos's real data: click to *see* the UI, never click the final Guardar/save action.

- [ ] **Step 3: Review the screenshots and console output**

Confirm no console errors, the date input and badge render correctly, and the progression table appears correctly when the checkbox is toggled.

- [ ] **Step 4: Clean up**

```bash
rm tools/verify-mesociclo.local.mjs
lsof -ti:5173 -sTCP:LISTEN | xargs -r kill
git status
```

Expected: clean working tree (the throwaway script was never committed).

---

## Notes for the reviewer

- `WorkoutDetailPanel.jsx` is intentionally untouched — it shows historical, already-logged sessions and reads `target_rir` straight from `exercises`, not through `applyMesocycleWeek`. This is explicit in the spec's "Fuera de alcance" section.
- `RoutineAssignerView.jsx` (routine creation) is intentionally untouched — mesocycles are only defined after a routine is assigned, from `ClientProfileView.jsx`.
- Task 5's Step 5 wraps the exercises list in an IIFE only to compute `activeWeek` once per routine before the `.map` — if a reviewer flags this as avoidable (same class of note as the IIFE removed from `DashboardView.jsx` in the calendario semanal plan), the alternative is hoisting `activeWeek` as a `const` computed inline right before the `return` of the `.map` callback (it needs `routine`, which is already in scope) — either is acceptable, prefer whichever the code-quality reviewer considers more idiomatic for this file.
