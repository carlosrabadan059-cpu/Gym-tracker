-- Fix 1: Drop overpermissive UPDATE policies on routines and exercises
-- Added by 20260416_routines_update_policy.sql, never replaced by the trainer-only migration.
drop policy if exists "Authenticated users can update routines" on public.routines;
drop policy if exists "Authenticated users can update exercises" on public.exercises;

create policy "Trainers can update routines"
on public.routines for update
to authenticated
using ( public.is_trainer() )
with check ( public.is_trainer() );

create policy "Trainers can update exercises"
on public.exercises for update
to authenticated
using ( public.is_trainer() )
with check ( public.is_trainer() );

-- Fix 2: Restrict notifications INSERT so users can only notify themselves
-- (trainers can still notify anyone)
drop policy if exists "Authenticated users can insert notifications" on public.notifications;

create policy "Insert notifications"
on public.notifications for insert
to authenticated
with check (
  auth.uid() = user_id
  or public.is_trainer()
);
