-- Política UPDATE para routines y exercises (faltaba en migración anterior)
create policy "Authenticated users can update routines"
on public.routines for update
to authenticated
using (true)
with check (true);

create policy "Authenticated users can update exercises"
on public.exercises for update
to authenticated
using (true)
with check (true);
