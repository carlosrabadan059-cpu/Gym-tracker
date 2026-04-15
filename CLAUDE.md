# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev       # Start dev server (Vite)
npm run build     # Production build
npm run lint      # ESLint
npm run preview   # Preview production build
```

No test suite is configured.

## Architecture Overview

**Gym Tracker** is a mobile-first React 19 PWA with Supabase (PostgreSQL) as the backend. The UI is entirely in Spanish.

### Routing

There is **no React Router**. Navigation is purely state-based inside [GymTrackerApp.jsx](src/GymTrackerApp.jsx): a `view` string controls which view renders. Trainer-specific views (`trainer`, `trainer_clients`, `trainer_client_profile`, `trainer_assign_routine`, `trainer_library`) are gated by checking `profile.role` against `TRAINER_ROLES = ['trainer', 'admin']`.

### Auth & Profile

[AuthContext.jsx](src/context/AuthContext.jsx) manages two objects: `user` (Supabase auth) and `profile` (row in `profiles` table). On first login the profile is created; subsequent logins fetch it. There's a one-time migration path that moves old localStorage data to Supabase.

### Data Layer

- [src/lib/supabase.js](src/lib/supabase.js) — Supabase client (anon key hardcoded; use env vars if extracting for production)
- [src/lib/utils.js](src/lib/utils.js) — Core workout helpers: `saveWorkoutLog`, `loadCompletedRoutines`, `loadLastExerciseLog`
- [src/lib/routineUtils.js](src/lib/routineUtils.js) — MET-based calorie calculations, routine icon mapping
- [src/data/routines.js](src/data/routines.js) — Static routine/exercise definitions (Day 1–4)

Workout completion data lives in the `workout_logs` Supabase table (JSONB `logs` field). The dashboard reads weekly completion state from there, not from localStorage.

### Key Supabase Tables

| Table | Purpose |
|-------|---------|
| `workout_logs` | Per-session exercise logs (user_id, routine_id, date, logs JSONB) |
| `profiles` | User data + `role` field for trainer gating |
| `exercises` | Exercise library |
| `assigned_routines` | Trainer → client routine assignments |
| `notifications` | Real-time notifications (Supabase Realtime subscription in [NotificationsContext.jsx](src/context/NotificationsContext.jsx)) |

SQL migrations are in [supabase/migrations/](supabase/migrations/).

### Views Structure

```
src/views/
├── DashboardView.jsx        # Weekly completion badges, pull-to-refresh
├── ChatView.jsx             # AI chat (markdown via react-markdown + remark-gfm)
├── StatisticsView.jsx       # Progress charts (Recharts)
├── OtherViews.jsx           # TrainingView (active workout logger), ProgressView
├── profile/                 # Settings, edit profile, notifications, privacy, help
└── trainer/                 # Multi-client management, routine assigner, exercise library
```

### Styling

Tailwind CSS with CSS variables for theming (light/dark). Theme state is in [ThemeContext.jsx](src/context/ThemeContext.jsx) and persisted to localStorage. Variables are defined in [src/index.css](src/index.css).

### PWA / Mobile Specifics

- Service worker registered in [src/main.jsx](src/main.jsx) for background timer notifications
- iOS-specific handling: shake-to-undo prevention, safe area insets, mobile viewport meta
- Pull-to-refresh on Dashboard is implemented with custom touch event handlers

Piensa antes de actuar. Lee los archivos antes de escribir código.

Edita solo lo que cambia, no reescribas archivos enteros.

No releas archivos que ya hayas leído salvo que hayan cambiado.

No repitas código sin cambios en tus respuestas.

Sin preámbulos, sin resúmenes al final, sin explicar lo obvio.

Testea antes de dar por terminado.