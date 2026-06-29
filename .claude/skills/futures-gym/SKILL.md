---
name: futures-gym
description: Domain skill for the Rutinex gym tracker codebase (React 19 + Supabase PWA, UI in Spanish). Covers navigation patterns, adding views/exercises/routines, trainer-client workflows, and Supabase schema changes. Use when working on features, bug fixes, or schema migrations in this project.
---

# Rutinex Gym Tracker

## Quick orientation

- **Routing**: state-based via `view` string in `GymTrackerApp.jsx` — no React Router. Add a new view by adding a `case` there and a component in `src/views/`.
- **Auth**: `AuthContext.jsx` provides `user` (Supabase auth) + `profile` (DB row). Trainer features gate on `profile.role` in `TRAINER_ROLES`.
- **Data**: workout logs → `src/lib/utils.js`; calorie/MET calcs → `src/lib/routineUtils.js`; static routines/exercises → `src/data/routines.js`.
- **UI language**: Spanish throughout. Match existing copy tone.

## Workflows

### Add a new view

1. Create `src/views/MyView.jsx`
2. In `GymTrackerApp.jsx`, add `case 'my_view': return <MyView />;`
3. Add navigation entry (bottom nav or profile menu) pointing to `setView('my_view')`
4. If trainer-only, wrap with `if (!TRAINER_ROLES.includes(profile.role)) return null`

### Add a static exercise to a routine

Edit `src/data/routines.js` — each exercise needs `id` (unique int), `name` (Spanish), `series`, `reps`, `image` (URL or `/exercises/` path).

### Add a Supabase table or column

1. Write migration in `supabase/migrations/<timestamp>_description.sql`
2. Update relevant helpers in `src/lib/utils.js` or `src/lib/routineUtils.js`
3. If RLS needed, add policies in the migration

### Trainer → client assignment flow

`TrainerDashboardView` → `ClientsListView` → `ClientProfileView` → `RoutineAssignerView`. Data lives in `assigned_routines` table. Trainer library is `TrainerLibraryView`.

## Key files

| File | Purpose |
|------|---------|
| `src/GymTrackerApp.jsx` | View router + auth gate |
| `src/context/AuthContext.jsx` | User + profile state |
| `src/lib/utils.js` | `saveWorkoutLog`, `loadCompletedRoutines`, `loadLastExerciseLog` |
| `src/data/routines.js` | Static routine/exercise definitions |
| `supabase/migrations/` | SQL schema history |

## Styling rules

- Tailwind CSS + CSS variables (`src/index.css`) for light/dark theming
- Mobile-first; test with narrow viewport
- Safe area insets already handled globally — don't add extra padding manually
