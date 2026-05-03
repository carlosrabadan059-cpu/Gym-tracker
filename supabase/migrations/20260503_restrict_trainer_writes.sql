-- Restringe escrituras en routines, exercises y assigned_routines a trainers/admins.
-- Corrige el SELECT de assigned_routines que exponía asignaciones de todos los usuarios.
-- Añade política de lectura en profiles para que trainers puedan listar clientes.

-- ============================================================
-- Función auxiliar (security definer): verifica si el usuario
-- autenticado es trainer o admin sin causar recursión en profiles.
-- ============================================================
create or replace function public.is_trainer()
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from public.profiles
    where user_id = auth.uid()
    and role in ('trainer', 'admin')
  )
$$;

-- ============================================================
-- ROUTINES
-- ============================================================
drop policy if exists "Authenticated users can insert routines" on public.routines;
drop policy if exists "Authenticated users can update routines" on public.routines;
drop policy if exists "Authenticated users can delete routines" on public.routines;

create policy "Trainers can insert routines"
on public.routines for insert
to authenticated
with check ( public.is_trainer() );

create policy "Trainers can update routines"
on public.routines for update
to authenticated
using ( public.is_trainer() )
with check ( public.is_trainer() );

create policy "Trainers can delete routines"
on public.routines for delete
to authenticated
using ( public.is_trainer() );

-- ============================================================
-- EXERCISES
-- ============================================================
drop policy if exists "Authenticated users can insert exercises" on public.exercises;
drop policy if exists "Authenticated users can update exercises" on public.exercises;
drop policy if exists "Authenticated users can delete exercises" on public.exercises;

create policy "Trainers can insert exercises"
on public.exercises for insert
to authenticated
with check ( public.is_trainer() );

create policy "Trainers can update exercises"
on public.exercises for update
to authenticated
using ( public.is_trainer() )
with check ( public.is_trainer() );

create policy "Trainers can delete exercises"
on public.exercises for delete
to authenticated
using ( public.is_trainer() );

-- ============================================================
-- ASSIGNED_ROUTINES
-- SELECT: cada cliente solo ve sus propias asignaciones; trainers ven todas.
-- INSERT/DELETE: solo trainers/admins.
-- ============================================================
drop policy if exists "Authenticated users can read assigned_routines" on public.assigned_routines;
drop policy if exists "Authenticated users can insert assigned_routines" on public.assigned_routines;
drop policy if exists "Authenticated users can delete assigned_routines" on public.assigned_routines;

create policy "Users can read own assigned_routines"
on public.assigned_routines for select
to authenticated
using (
  client_id = auth.uid()
  or public.is_trainer()
);

create policy "Trainers can insert assigned_routines"
on public.assigned_routines for insert
to authenticated
with check ( public.is_trainer() );

create policy "Trainers can delete assigned_routines"
on public.assigned_routines for delete
to authenticated
using ( public.is_trainer() );

-- ============================================================
-- PROFILES
-- Trainers necesitan leer todos los perfiles para listar clientes.
-- Se añade sin eliminar políticas existentes (aditivas con OR).
-- ============================================================
drop policy if exists "Trainers can read all profiles" on public.profiles;

create policy "Trainers can read all profiles"
on public.profiles for select
to authenticated
using (
  user_id = auth.uid()
  or public.is_trainer()
);
