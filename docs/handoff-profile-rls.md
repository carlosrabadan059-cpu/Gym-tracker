# Handoff: fixing the profile save in Rutinex (2026-09-17)

## State: done, nothing pending

The user could not save their profile goal ("Hipertrofia") in the native iOS app. Fixed and confirmed:
the production `profiles` row now has goal = Hipertrofia, saved from the iPhone after the fix.

## What happened

- Root cause (in the DB, not the client): the `with check` of the RLS policy "Users can update own profile." on
  `public.profiles` queried `profiles` itself, so Postgres raised `infinite recursion detected in policy
  for relation "profiles"`. Every profile save failed, not only the goal.
- Fix: migration `supabase/migrations/20260917_fix_profiles_update_policy_recursion.sql`, already applied
  to Supabase project `jqpyqqlkgisykgywilrf` ("Gym Tracker") via MCP `apply_migration`.
  - Policy is now `using/with check (auth.uid() = user_id)`.
  - Trigger `prevent_role_escalation` now only lets `admin` change a role (the old policy also blocked
    trainers from changing their own role).
- Documented in `CLAUDE.md` (RLS rule under "Key Supabase Tables"). Commit `9019171` on `main`,
  **not pushed**.
- Exercises, routines, `workout_logs`: not touched. The goal only feeds the AI chat context
  (`src/views/ChatView.jsx`) and the trainer's AI drafts and progression suggestions (`src/lib/trainerUtils.js`).

## Useful technique

To reproduce an RLS failure as a real user without writing data: `begin; select set_config('request.jwt.claims', '{"sub":"<uid>","role":"authenticated"}', true); set local role authenticated; <update>; rollback;` via `mcp__supabase__execute_sql`.

## Open threads (only if the user asks)

- Push `main` (user has not asked).
- Other policies on other tables could have the same self-reference pattern. Not audited.

## Constraints

- The project owner's account is the only real production user. Never modify their `exercises` or `workout_logs`
  (see CLAUDE.md "Producción real").
- Apply migrations to production only with explicit user approval.
- The user writes in Spanish. Reply in Spanish.

## Suggested skills

- `run-rutinex`: to run and drive the app locally.
- `systematic-debugging` or `mattpocock-skills:diagnosing-bugs`: for any new bug report.
- `caveman:migration`: before writing or applying another Supabase migration.
