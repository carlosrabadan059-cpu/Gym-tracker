-- Drop the open INSERT policy (left over from initial data population)
drop policy if exists "Allow insert for initial population" on public.exercise_catalog;

-- Trainers only can insert
create policy "Trainers can insert exercise_catalog"
on public.exercise_catalog for insert
to authenticated
with check ( public.is_trainer() );

-- Remove duplicate SELECT policy
drop policy if exists "Anyone can view the exercise catalog" on public.exercise_catalog;
