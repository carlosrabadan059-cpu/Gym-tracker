-- Cuándo se fijó o cambió por última vez el peso objetivo de un ejercicio.
-- Lo usa el cliente para decidir qué precarga en las series: el objetivo del
-- entrenador si es posterior a la última sesión, y si no, el peso de esa
-- sesión. Solo añade una columna nullable y un trigger: no toca datos
-- existentes (filas antiguas quedan en null = "sin cambio conocido").

alter table public.exercises
    add column if not exists target_weight_updated_at timestamptz;

comment on column public.exercises.target_weight_updated_at is
    'Última vez que se fijó o cambió target_weight. Null = anterior a esta columna o sin objetivo.';

create or replace function public.touch_target_weight_updated_at()
returns trigger
language plpgsql
as $$
begin
    if new.target_weight is not null
       and (tg_op = 'INSERT' or new.target_weight is distinct from old.target_weight) then
        new.target_weight_updated_at := now();
    end if;
    return new;
end;
$$;

drop trigger if exists exercises_touch_target_weight on public.exercises;
create trigger exercises_touch_target_weight
    before insert or update of target_weight on public.exercises
    for each row execute function public.touch_target_weight_updated_at();
