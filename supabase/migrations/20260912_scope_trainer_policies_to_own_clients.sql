-- Hallazgo al revisar la Fase 4 (alerta de inactividad, workout_logs): el
-- mismo agujero que ya se cerró para `profiles` en
-- 20260908_create_trainer_clients_and_fix_profiles_rls.sql (auth.is_trainer()
-- sin comprobar trainer_clients, así que CUALQUIER entrenador ve/edita
-- CUALQUIER cliente, no solo los suyos) sigue abierto en:
--   - workout_logs (SELECT)      — 20260415_trainer_workout_logs_policy.sql
--   - assigned_routines (SELECT) — 20260503_restrict_trainer_writes.sql
--   - routines (INSERT/UPDATE/DELETE)  — idem
--   - exercises (INSERT/UPDATE/DELETE) — idem
--
-- Verificado contra datos reales antes de escribir esto: toda rutina
-- realmente asignada tiene trainer_id = el entrenador que la creó (las
-- filas legado day1-day4, con trainer_id null, no están asignadas a nadie
-- — n_assigned = 0 — así que restringir por trainer_id no rompe nada vivo).

-- ============================================================
-- WORKOUT_LOGS — SELECT
-- ============================================================
drop policy if exists "Trainers can view client workout logs" on public.workout_logs;

create policy "Trainers can view own clients workout logs"
on public.workout_logs for select
to authenticated
using (
  auth.uid() = user_id
  or exists (
    select 1 from public.trainer_clients tc
    where tc.trainer_id = auth.uid() and tc.client_id = workout_logs.user_id
  )
);

-- ============================================================
-- ASSIGNED_ROUTINES — SELECT/INSERT/DELETE
-- ============================================================
drop policy if exists "Users can read own assigned_routines" on public.assigned_routines;
drop policy if exists "Trainers can insert assigned_routines" on public.assigned_routines;
drop policy if exists "Trainers can delete assigned_routines" on public.assigned_routines;

create policy "Users can read own or own clients assigned_routines"
on public.assigned_routines for select
to authenticated
using (
  client_id = auth.uid()
  or exists (
    select 1 from public.trainer_clients tc
    where tc.trainer_id = auth.uid() and tc.client_id = assigned_routines.client_id
  )
);

create policy "Trainers can insert assigned_routines for own clients"
on public.assigned_routines for insert
to authenticated
with check (
  public.is_trainer()
  and exists (
    select 1 from public.trainer_clients tc
    where tc.trainer_id = auth.uid() and tc.client_id = assigned_routines.client_id
  )
);

create policy "Trainers can delete assigned_routines of own clients"
on public.assigned_routines for delete
to authenticated
using (
  exists (
    select 1 from public.trainer_clients tc
    where tc.trainer_id = auth.uid() and tc.client_id = assigned_routines.client_id
  )
);

-- ============================================================
-- ROUTINES — INSERT/UPDATE/DELETE
-- Una rutina nueva se marca como propia del entrenador que la crea
-- (trainer_id = auth.uid()); editar/borrar solo la propia.
-- ============================================================
drop policy if exists "Trainers can insert routines" on public.routines;
drop policy if exists "Trainers can update routines" on public.routines;
drop policy if exists "Trainers can delete routines" on public.routines;

create policy "Trainers can insert own routines"
on public.routines for insert
to authenticated
with check ( public.is_trainer() and trainer_id = auth.uid() );

create policy "Trainers can update own routines"
on public.routines for update
to authenticated
using ( trainer_id = auth.uid() )
with check ( trainer_id = auth.uid() );

create policy "Trainers can delete own routines"
on public.routines for delete
to authenticated
using ( trainer_id = auth.uid() );

-- ============================================================
-- EXERCISES — INSERT/UPDATE/DELETE
-- exercises no tiene trainer_id propio; la propiedad se hereda de la
-- rutina a la que pertenece (routines.trainer_id).
-- ============================================================
drop policy if exists "Trainers can insert exercises" on public.exercises;
drop policy if exists "Trainers can update exercises" on public.exercises;
drop policy if exists "Trainers can delete exercises" on public.exercises;

create policy "Trainers can insert exercises on own routines"
on public.exercises for insert
to authenticated
with check (
  exists (
    select 1 from public.routines r
    where r.id = exercises.routine_id and r.trainer_id = auth.uid()
  )
);

create policy "Trainers can update exercises on own routines"
on public.exercises for update
to authenticated
using (
  exists (
    select 1 from public.routines r
    where r.id = exercises.routine_id and r.trainer_id = auth.uid()
  )
)
with check (
  exists (
    select 1 from public.routines r
    where r.id = exercises.routine_id and r.trainer_id = auth.uid()
  )
);

create policy "Trainers can delete exercises on own routines"
on public.exercises for delete
to authenticated
using (
  exists (
    select 1 from public.routines r
    where r.id = exercises.routine_id and r.trainer_id = auth.uid()
  )
);
