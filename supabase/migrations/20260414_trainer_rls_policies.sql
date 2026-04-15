-- Políticas RLS para que los entrenadores puedan crear y asignar rutinas

-- ROUTINES: lectura pública para autenticados, escritura/borrado para autenticados
create policy "Authenticated users can read routines"
on public.routines for select
to authenticated
using (true);

create policy "Authenticated users can insert routines"
on public.routines for insert
to authenticated
with check (true);

create policy "Authenticated users can delete routines"
on public.routines for delete
to authenticated
using (true);

-- EXERCISES: lectura pública para autenticados, escritura/borrado para autenticados
create policy "Authenticated users can read exercises"
on public.exercises for select
to authenticated
using (true);

create policy "Authenticated users can insert exercises"
on public.exercises for insert
to authenticated
with check (true);

create policy "Authenticated users can delete exercises"
on public.exercises for delete
to authenticated
using (true);

-- ASSIGNED_ROUTINES: CRUD completo para autenticados
create policy "Authenticated users can read assigned_routines"
on public.assigned_routines for select
to authenticated
using (true);

create policy "Authenticated users can insert assigned_routines"
on public.assigned_routines for insert
to authenticated
with check (true);

create policy "Authenticated users can delete assigned_routines"
on public.assigned_routines for delete
to authenticated
using (true);
