-- Add trainer_id to routines
alter table public.routines
  add column if not exists trainer_id uuid references auth.users(id);

-- Backfill: set trainer_id from assigned_routines.assigned_by where possible
update public.routines r
set trainer_id = (
  select ar.assigned_by
  from public.assigned_routines ar
  where ar.routine_id = r.id
    and ar.assigned_by is not null
  limit 1
)
where r.trainer_id is null;

-- Tighten DELETE: trainer can only delete their own routines
-- (NULL trainer_id = legacy system routine, any trainer can manage it)
drop policy if exists "Trainers can delete routines" on public.routines;
create policy "Trainers can delete routines"
on public.routines for delete
to authenticated
using (
  public.is_trainer()
  and (trainer_id is null or trainer_id = auth.uid())
);

-- Tighten UPDATE: same ownership check
drop policy if exists "Trainers can update routines" on public.routines;
create policy "Trainers can update routines"
on public.routines for update
to authenticated
using (
  public.is_trainer()
  and (trainer_id is null or trainer_id = auth.uid())
)
with check (
  public.is_trainer()
  and (trainer_id is null or trainer_id = auth.uid())
);
