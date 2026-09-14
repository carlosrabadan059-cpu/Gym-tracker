# Dashboard de entrenador priorizado — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the trainer dashboard's two static buttons with a prioritized client list — who needs attention today, who's progressing, everyone else — computed from data that already exists (adherence + weekly schedule), with a "Librería" button and a "Todos los clientes" link kept below it.

**Architecture:** One new pure module (`src/lib/trainerPriority.js`) that categorizes a client from precomputed signals. `TrainerDashboardView.jsx` gains its own Supabase fetch (mirroring `ClientsListView.jsx`'s two-step pattern for tables without direct foreign keys), computes the signals per client, groups them via the new pure function, and renders three sections. `GymTrackerApp.jsx` wires a new `onOpenClient` prop so a card click jumps straight to that client's profile.

**Tech Stack:** React 19, Supabase (Postgres), Vitest.

---

### Task 1: `src/lib/trainerPriority.js` — pure categorization + tests

**Files:**
- Create: `src/lib/trainerPriority.js`
- Test: `src/lib/trainerPriority.test.js`

**Context:** `src/lib/adherence.js` already exports `INACTIVITY_ALERT_DAYS` (currently `7`) and is used by `src/views/trainer/ClientsListView.jsx` to flag inactive clients. This task adds a new pure function that combines that inactivity signal with two new signals (today's schedule + today's training) into a single category.

- [ ] **Step 1: Write the failing tests**

```js
// src/lib/trainerPriority.test.js
import { describe, it, expect } from 'vitest';
import { categorizeClient } from './trainerPriority';

describe('categorizeClient', () => {
    it('flags attention when the client has never trained', () => {
        expect(categorizeClient({
            daysSinceLastSession: null,
            streak: 0,
            hasRoutineScheduledToday: false,
            trainedToday: false,
        })).toBe('attention');
    });

    it('flags attention when inactive for 7+ days, even with signals that look fine otherwise', () => {
        expect(categorizeClient({
            daysSinceLastSession: 7,
            streak: 0,
            hasRoutineScheduledToday: false,
            trainedToday: false,
        })).toBe('attention');
        expect(categorizeClient({
            daysSinceLastSession: 10,
            streak: 0,
            hasRoutineScheduledToday: false,
            trainedToday: false,
        })).toBe('attention');
    });

    it('does not flag attention for inactivity below the threshold', () => {
        expect(categorizeClient({
            daysSinceLastSession: 6,
            streak: 0,
            hasRoutineScheduledToday: false,
            trainedToday: false,
        })).not.toBe('attention');
    });

    it('flags attention when a routine is scheduled today and has not been trained, even if recently active', () => {
        expect(categorizeClient({
            daysSinceLastSession: 1,
            streak: 3,
            hasRoutineScheduledToday: true,
            trainedToday: false,
        })).toBe('attention');
    });

    it('does not flag attention for a scheduled routine already trained today', () => {
        expect(categorizeClient({
            daysSinceLastSession: 0,
            streak: 3,
            hasRoutineScheduledToday: true,
            trainedToday: true,
        })).toBe('progressing');
    });

    it('flags progressing when streak is alive and no attention signal applies', () => {
        expect(categorizeClient({
            daysSinceLastSession: 0,
            streak: 5,
            hasRoutineScheduledToday: false,
            trainedToday: true,
        })).toBe('progressing');
    });

    it('attention wins over progressing when both signals apply', () => {
        expect(categorizeClient({
            daysSinceLastSession: 1,
            streak: 4,
            hasRoutineScheduledToday: true,
            trainedToday: false,
        })).toBe('attention');
    });

    it('flags neutral when no signal applies', () => {
        expect(categorizeClient({
            daysSinceLastSession: 3,
            streak: 0,
            hasRoutineScheduledToday: false,
            trainedToday: false,
        })).toBe('neutral');
    });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `TZ=UTC npx vitest run src/lib/trainerPriority.test.js`
Expected: FAIL — `Failed to resolve import "./trainerPriority"`.

- [ ] **Step 3: Write the implementation**

```js
// src/lib/trainerPriority.js
// Fase 5 (parte 1) del plan de entrenador: dashboard priorizado. Ver
// docs/superpowers/specs/2026-09-15-dashboard-entrenador-design.md.

import { INACTIVITY_ALERT_DAYS } from './adherence';

/**
 * Categoriza a un cliente para el dashboard del entrenador. Puro: todas las
 * señales se pasan ya calculadas (no hace fetch, no llama a `new Date()`).
 *
 * @param {object} signals
 * @param {number|null} signals.daysSinceLastSession - de computeDaysSinceLastSession
 * @param {number} signals.streak - de computeStreak
 * @param {boolean} signals.hasRoutineScheduledToday - alguna rutina asignada
 *   tiene scheduled_days que incluye el día de hoy
 * @param {boolean} signals.trainedToday - hay al menos un workout_log de hoy
 *   para este cliente (cualquier rutina)
 * @returns {'attention'|'progressing'|'neutral'}
 */
export function categorizeClient({ daysSinceLastSession, streak, hasRoutineScheduledToday, trainedToday }) {
    const isInactive = daysSinceLastSession === null || daysSinceLastSession >= INACTIVITY_ALERT_DAYS;
    const missedToday = hasRoutineScheduledToday && !trainedToday;
    if (isInactive || missedToday) return 'attention';
    if (streak > 0) return 'progressing';
    return 'neutral';
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `TZ=UTC npx vitest run src/lib/trainerPriority.test.js`
Expected: PASS, 8 tests.

- [ ] **Step 5: Commit**

```bash
git add src/lib/trainerPriority.js src/lib/trainerPriority.test.js
git commit -m "feat(dashboard-entrenador): categorizacion pura de clientes"
```

---

### Task 2: `GymTrackerApp.jsx` — wire `onOpenClient`

**Files:**
- Modify: `src/GymTrackerApp.jsx` (the `TrainerDashboardView` usage, currently around line 340)

**Context:** Today `TrainerDashboardView` only receives `onNavigate`. `TrainerClientsView` (used for `trainer_clients`/`trainer_client_profile`) already receives `onSelectClient={setCurrentClient}` plus a separate `onOpenProfile` that flips the view. `TrainerDashboardView` needs the equivalent, but combined into one call (it goes straight to a client's profile, never to the intermediate list), so it can be passed as a single prop.

- [ ] **Step 1: Read the current block to confirm exact placement**

The block looks like:

```jsx
                    {view === 'trainer' && (
                        <TrainerDashboardView onNavigate={handleNavigate} />
                    )}
```

- [ ] **Step 2: Add the `onOpenClient` prop**

Replace with:

```jsx
                    {view === 'trainer' && (
                        <TrainerDashboardView
                            onNavigate={handleNavigate}
                            onOpenClient={(client) => { setCurrentClient(client); setView('trainer_client_profile'); }}
                        />
                    )}
```

(`setCurrentClient` and `setView` are already in scope in this component — confirmed by their use two blocks below for `TrainerClientsView`.)

- [ ] **Step 3: Run the full test suite**

Run: `TZ=UTC npm test`
Expected: all passing (no new pure-function tests for this task — it's a one-line prop wiring change in a component file, same convention as the rest of `GymTrackerApp.jsx`, which has no dedicated test file).

- [ ] **Step 4: Commit**

```bash
git add src/GymTrackerApp.jsx
git commit -m "feat(dashboard-entrenador): pasar onOpenClient al dashboard"
```

---

### Task 3: `TrainerDashboardView.jsx` — fetch, categorize, render

**Files:**
- Modify: `src/views/trainer/TrainerDashboardView.jsx` (full rewrite of the component body — current file is 49 lines, static JSX only)

**Context — read before starting:**

The current file:

```jsx
import React from 'react';
import { useAuth } from '../../context/AuthContext';
import { Users, LayoutDashboard, LogOut } from 'lucide-react';

export function TrainerDashboardView({ onNavigate }) {
    const { profile, signOut } = useAuth();

    return (
        <div className="flex flex-col h-full bg-background pb-20">
            <header className="mb-8 p-4">
                <h2 className="text-3xl font-bold text-text-primary">Hola, Entrenador</h2>
                <p className="text-text-secondary">Gestiona a tus clientes desde aquí.</p>
            </header>

            <div className="flex-1 px-4 space-y-4">
                <div className="grid grid-cols-2 gap-4">
                    <button
                        onClick={() => onNavigate('trainer_clients')}
                        className="bg-surface p-6 rounded-2xl border border-surface-highlight hover:border-primary transition-all flex flex-col items-center justify-center gap-4 text-center group"
                    >
                        <Users size={32} className="text-primary group-hover:scale-110 transition-transform" />
                        <h3 className="font-bold text-lg">Clientes</h3>
                        <p className="text-xs text-text-secondary">Ver lista y rutinas</p>
                    </button>

                    <button
                        onClick={() => onNavigate('trainer_library')}
                        className="bg-surface p-6 rounded-2xl border border-surface-highlight hover:border-primary transition-all flex flex-col items-center justify-center gap-4 text-center group"
                    >
                        <LayoutDashboard size={32} className="text-orange-500 group-hover:scale-110 transition-transform" />
                        <h3 className="font-bold text-lg">Librería</h3>
                        <p className="text-xs text-text-secondary">Ejercicios y bloques</p>
                    </button>
                </div>

                <div className="mt-8 pt-8 border-t border-surface-highlight">
                    <button
                        onClick={signOut}
                        className="w-full bg-red-500/10 text-red-500 rounded-xl py-4 flex items-center justify-center gap-2 font-bold hover:bg-red-500/20 transition-colors"
                    >
                        <LogOut size={20} />
                        Cerrar Sesión
                    </button>
                </div>
            </div>
        </div>
    );
}
```

For reference, `src/views/trainer/ClientsListView.jsx` already does the two-step `trainer_clients` → `profiles`/`workout_logs` fetch (there is no direct FK from `trainer_clients.client_id` or `workout_logs.user_id` to `profiles`, both reference `auth.users`, so PostgREST can't embed automatically):

```js
const { data: links } = await supabase.from('trainer_clients').select('client_id').eq('trainer_id', user.id);
const clientIds = (links || []).map(l => l.client_id);
const [{ data: profiles }, { data: logs }] = await Promise.all([
    supabase.from('profiles').select('*').in('user_id', clientIds),
    supabase.from('workout_logs').select('user_id, date').in('user_id', clientIds),
]);
```

This task follows the same shape, adding a third and fourth query for the weekly-schedule signal: `assigned_routines` (`client_id, routine_id`) and `routines` (`id, scheduled_days`) for the `routine_id`s returned. `src/lib/routineSchedule.js` already exports `isRoutineScheduledForDay(scheduledDays, dayOfWeek)`. `src/lib/adherence.js` already exports `computeStreak(dates)`, `computeDaysSinceLastSession(dates)`, `INACTIVITY_ALERT_DAYS`.

- [ ] **Step 1: Write the new component**

Replace the entire contents of `src/views/trainer/TrainerDashboardView.jsx` with:

```jsx
import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';
import { computeStreak, computeDaysSinceLastSession, INACTIVITY_ALERT_DAYS } from '../../lib/adherence';
import { isRoutineScheduledForDay } from '../../lib/routineSchedule';
import { categorizeClient } from '../../lib/trainerPriority';
import { Users, LayoutDashboard, LogOut, ChevronRight, Flame, AlertTriangle } from 'lucide-react';

// Compara dos fechas por día calendario local, ignorando la hora — igual
// criterio que src/lib/adherence.js usa internamente para "hoy"/"ayer",
// reimplementado aquí en vez de exportado desde allí porque es una sola
// comparación de una línea, no justifica una función nueva compartida.
function isSameLocalDay(dateInput, reference) {
    const d = new Date(dateInput);
    return d.getFullYear() === reference.getFullYear()
        && d.getMonth() === reference.getMonth()
        && d.getDate() === reference.getDate();
}

function ClientRow({ client, onClick, subtitle, subtitleIcon: SubtitleIcon, subtitleClassName }) {
    return (
        <button
            onClick={onClick}
            className="w-full bg-surface rounded-2xl border border-surface-highlight hover:border-primary transition-all flex items-center justify-between p-3 text-left group"
        >
            <div className="flex items-center gap-3 min-w-0">
                <div className="w-10 h-10 rounded-full bg-surface-highlight overflow-hidden flex-shrink-0">
                    <img
                        src={client.avatar_url || `https://ui-avatars.com/api/?name=${client.username}&background=random&color=fff`}
                        alt={client.username}
                        loading="lazy"
                        className="w-full h-full object-cover"
                    />
                </div>
                <div className="min-w-0">
                    <h4 className="font-bold text-text-primary text-sm truncate">{client.fullName || client.username}</h4>
                    {subtitle && (
                        <span className={`inline-flex items-center gap-1 text-[10px] font-bold px-1.5 py-0.5 rounded-full mt-1 ${subtitleClassName}`}>
                            {SubtitleIcon && <SubtitleIcon size={10} />}
                            {subtitle}
                        </span>
                    )}
                </div>
            </div>
            <ChevronRight size={18} className="text-text-secondary group-hover:text-primary transition-colors flex-shrink-0" />
        </button>
    );
}

export function TrainerDashboardView({ onNavigate, onOpenClient }) {
    const { user, signOut } = useAuth();
    const [clients, setClients] = useState([]);
    const [loading, setLoading] = useState(true);

    const fetchClients = useCallback(async () => {
        try {
            const { data: links, error: linksError } = await supabase
                .from('trainer_clients')
                .select('client_id')
                .eq('trainer_id', user.id);
            if (linksError) throw linksError;

            const clientIds = (links || []).map(l => l.client_id);
            if (clientIds.length === 0) {
                setClients([]);
                return;
            }

            const [
                { data: profiles, error: profilesError },
                { data: logs, error: logsError },
                { data: assigned, error: assignedError },
            ] = await Promise.all([
                supabase.from('profiles').select('*').in('user_id', clientIds),
                supabase.from('workout_logs').select('user_id, date').in('user_id', clientIds),
                supabase.from('assigned_routines').select('client_id, routine_id').in('client_id', clientIds),
            ]);
            if (profilesError) throw profilesError;
            if (logsError) throw logsError;
            if (assignedError) throw assignedError;

            const routineIds = [...new Set((assigned || []).map(a => a.routine_id))];
            let scheduledDaysByRoutineId = {};
            if (routineIds.length > 0) {
                const { data: routinesData, error: routinesError } = await supabase
                    .from('routines')
                    .select('id, scheduled_days')
                    .in('id', routineIds);
                if (routinesError) throw routinesError;
                scheduledDaysByRoutineId = Object.fromEntries((routinesData || []).map(r => [r.id, r.scheduled_days]));
            }

            const logsByClient = {};
            (logs || []).forEach((log) => {
                if (!logsByClient[log.user_id]) logsByClient[log.user_id] = [];
                logsByClient[log.user_id].push(log.date);
            });

            const routineIdsByClient = {};
            (assigned || []).forEach((a) => {
                if (!routineIdsByClient[a.client_id]) routineIdsByClient[a.client_id] = [];
                routineIdsByClient[a.client_id].push(a.routine_id);
            });

            const today = new Date();
            const todayDayOfWeek = today.getDay();

            const categorized = (profiles || []).map((profile) => {
                const dates = logsByClient[profile.user_id] || [];
                const daysSinceLastSession = computeDaysSinceLastSession(dates);
                const streak = computeStreak(dates);
                const trainedToday = dates.some((d) => isSameLocalDay(d, today));
                const hasRoutineScheduledToday = (routineIdsByClient[profile.user_id] || []).some((routineId) =>
                    isRoutineScheduledForDay(scheduledDaysByRoutineId[routineId], todayDayOfWeek)
                );

                return {
                    ...profile,
                    daysSinceLastSession,
                    streak,
                    category: categorizeClient({ daysSinceLastSession, streak, hasRoutineScheduledToday, trainedToday }),
                    missedToday: hasRoutineScheduledToday && !trainedToday,
                };
            });

            setClients(categorized);
        } catch (error) {
            console.error('Error fetching trainer dashboard clients:', error);
            setClients([]);
        } finally {
            setLoading(false);
        }
    }, [user.id]);

    useEffect(() => { fetchClients(); }, [fetchClients]);

    const attentionClients = clients.filter(c => c.category === 'attention');
    const progressingClients = clients.filter(c => c.category === 'progressing');
    const neutralClients = clients.filter(c => c.category === 'neutral');
    const hasHighlightedSections = attentionClients.length > 0 || progressingClients.length > 0;

    const attentionSubtitle = (client) => {
        if (client.daysSinceLastSession === null) return 'Sin sesiones';
        if (client.daysSinceLastSession >= INACTIVITY_ALERT_DAYS) return `Hace ${client.daysSinceLastSession} días`;
        return 'Rutina de hoy sin hacer';
    };

    return (
        <div className="flex flex-col h-full bg-background pb-20">
            <header className="mb-6 p-4">
                <h2 className="text-3xl font-bold text-text-primary">Hola, Entrenador</h2>
                <p className="text-text-secondary">Así están tus clientes hoy.</p>
            </header>

            <div className="flex-1 px-4 space-y-6 overflow-y-auto">
                {loading ? (
                    <p className="text-sm text-text-secondary">Cargando clientes...</p>
                ) : (
                    <>
                        {attentionClients.length > 0 && (
                            <div>
                                <h3 className="font-bold text-sm text-orange-500 mb-2 uppercase tracking-wide">Necesitan atención</h3>
                                <div className="space-y-2">
                                    {attentionClients.map((client) => (
                                        <ClientRow
                                            key={client.user_id}
                                            client={client}
                                            onClick={() => onOpenClient(client)}
                                            subtitle={attentionSubtitle(client)}
                                            subtitleIcon={AlertTriangle}
                                            subtitleClassName="text-orange-500 bg-orange-500/10"
                                        />
                                    ))}
                                </div>
                            </div>
                        )}

                        {progressingClients.length > 0 && (
                            <div>
                                <h3 className="font-bold text-sm text-primary mb-2 uppercase tracking-wide">Progresando</h3>
                                <div className="space-y-2">
                                    {progressingClients.map((client) => (
                                        <ClientRow
                                            key={client.user_id}
                                            client={client}
                                            onClick={() => onOpenClient(client)}
                                            subtitle={`Racha de ${client.streak} días`}
                                            subtitleIcon={Flame}
                                            subtitleClassName="text-primary bg-primary/10"
                                        />
                                    ))}
                                </div>
                            </div>
                        )}

                        {neutralClients.length > 0 && (
                            <div>
                                {hasHighlightedSections && (
                                    <h3 className="font-bold text-sm text-text-secondary mb-2 uppercase tracking-wide">Resto de tus clientes</h3>
                                )}
                                <div className="space-y-2">
                                    {neutralClients.map((client) => (
                                        <ClientRow key={client.user_id} client={client} onClick={() => onOpenClient(client)} />
                                    ))}
                                </div>
                            </div>
                        )}

                        {clients.length === 0 && (
                            <p className="text-sm text-text-secondary">Aún no tienes clientes asignados.</p>
                        )}
                    </>
                )}

                <div className="grid grid-cols-2 gap-4 pt-2">
                    <button
                        onClick={() => onNavigate('trainer_clients')}
                        className="bg-surface p-4 rounded-2xl border border-surface-highlight hover:border-primary transition-all flex flex-col items-center justify-center gap-2 text-center group"
                    >
                        <Users size={24} className="text-primary group-hover:scale-110 transition-transform" />
                        <h3 className="font-bold text-sm">Todos los clientes</h3>
                    </button>

                    <button
                        onClick={() => onNavigate('trainer_library')}
                        className="bg-surface p-4 rounded-2xl border border-surface-highlight hover:border-primary transition-all flex flex-col items-center justify-center gap-2 text-center group"
                    >
                        <LayoutDashboard size={24} className="text-orange-500 group-hover:scale-110 transition-transform" />
                        <h3 className="font-bold text-sm">Librería</h3>
                    </button>
                </div>

                <div className="pt-4 border-t border-surface-highlight">
                    <button
                        onClick={signOut}
                        className="w-full bg-red-500/10 text-red-500 rounded-xl py-4 flex items-center justify-center gap-2 font-bold hover:bg-red-500/20 transition-colors"
                    >
                        <LogOut size={20} />
                        Cerrar Sesión
                    </button>
                </div>
            </div>
        </div>
    );
}
```

Note: `useAuth()` here now destructures `user` (needed for the `trainer_id` filter) in addition to `signOut` — the previous version destructured `profile` but never used it for anything other than being available; check that removing `profile` doesn't break anything else in this file (it doesn't — it was unused in the original body shown above beyond the destructure itself).

- [ ] **Step 2: Run the full test suite**

Run: `TZ=UTC npm test`
Expected: all passing (117 total: 109 from before + 8 new in `trainerPriority.test.js`). No new tests for this task itself — component/Supabase-wrapper code, same convention as `ClientsListView.jsx`.

- [ ] **Step 3: Run lint**

Run: `npm run lint`
Expected: no NEW errors in `TrainerDashboardView.jsx` compared to `main` (the repo has pre-existing unrelated lint errors elsewhere — not a regression to fix here).

- [ ] **Step 4: Commit**

```bash
git add src/views/trainer/TrainerDashboardView.jsx
git commit -m "feat(dashboard-entrenador): lista priorizada de clientes"
```

---

### Task 4: Verificación en navegador

**Files:** none (verification only, throwaway script)

**Context:** Same constraint as every prior verification pass in this project (CLAUDE.md): only navigate and capture, never click anything that writes to Carlos's real account. This task is read-only by nature (the dashboard has no save/write actions of its own), so there's no "don't click Guardar" concern here — just confirm it renders correctly against Carlos's real data and that clicking a client card navigates to the right profile.

- [ ] **Step 1: Start the dev server**

```bash
[ -d node_modules ] || npm install
nohup npm run dev > /tmp/rutinex-dev.log 2>&1 & disown
for i in $(seq 1 20); do curl -sf http://localhost:5173 >/dev/null 2>&1 && break; sleep 1; done
```

- [ ] **Step 2: Write a throwaway Playwright script at `tools/verify-dashboard-entrenador.local.mjs`**

Log in as `admin@gymtracker.com` / `admin123$$`. The trainer dashboard (`view === 'trainer'`) is the landing view after login for a trainer account — screenshot it directly. Confirm:
1. No console errors.
2. Carlos appears in exactly one of the three sections (given his real current data — check which section by reading the screenshot, don't assume).
3. Clicking his card navigates to his client profile (`ClientProfileView`) — screenshot after the click to confirm.
4. "Todos los clientes" and "Librería" buttons still work as before (unchanged behavior).

- [ ] **Step 3: Review the screenshots and console output**

Confirm no console errors, sections render with the correct client, click navigation works.

- [ ] **Step 4: Clean up**

```bash
rm tools/verify-dashboard-entrenador.local.mjs
lsof -ti:5173 -sTCP:LISTEN | xargs -r kill
git status
```

Expected: clean working tree.

---

## Notes for the reviewer

- `ClientsListView.jsx` is intentionally untouched — it remains the full searchable/addable client list, reachable now via "Todos los clientes" instead of "Clientes".
- The `ClientRow` component in `TrainerDashboardView.jsx` duplicates some JSX from `ClientsListView.jsx`'s client row rather than extracting a shared component — the spec explicitly leaves this decision to implementation judgment ("se extrae a un componente compartido si la duplicación resulta molesta"). This plan keeps them separate since the two rows differ enough (one shows a category-specific subtitle badge, the other shows only the inactivity warning) that a shared component would need a handful of conditional props anyway. If the code-quality reviewer feels otherwise, extracting a shared `ClientListRow` into a new file (e.g. `src/components/trainer/ClientListRow.jsx`) used by both views is an acceptable follow-up, not a blocker.
- `isSameLocalDay` duplicates a comparison style already used internally (but not exported) by `src/lib/adherence.js`'s `toDayKey`. This is a deliberate, spec-documented choice (see spec section 2) to avoid growing `adherence.js`'s public API for a one-line comparison used in exactly one place.
