-- Trazabilidad de los avisos de fin de descanso.
--
-- Motivo: la Edge Function send-timer-push falla de forma intermitente y hoy
-- no hay forma de saber por qué. Sus errores solo van a console.error dentro
-- de una background task que ya devolvió la respuesta HTTP, así que ni el
-- cliente ni nadie los ve. Sin esta tabla, cada fallo es irreproducible.
create table if not exists public.push_log (
    id uuid primary key default gen_random_uuid(),
    user_id uuid not null references auth.users(id) on delete cascade,

    -- cuándo se pidió el aviso y para cuándo estaba previsto
    scheduled_at timestamptz not null default now(),
    target_time  timestamptz not null,

    -- cuándo se envió de verdad; null si nunca llegó a enviarse
    fired_at timestamptz,

    -- scheduled | sent | failed | subscription_gone | too_long
    status text not null default 'scheduled',

    attempts   integer not null default 0,
    status_code integer,
    error      text,

    -- desfase real entre target_time y fired_at, en ms (negativo = se adelantó)
    delay_ms integer
);

alter table public.push_log enable row level security;

-- El usuario puede ver sus propios avisos; escribe siempre la Edge Function
-- con la service role key, que se salta RLS.
create policy "Users can read own push log"
on public.push_log for select
to authenticated
using (auth.uid() = user_id);

create index if not exists push_log_user_id_scheduled_at_idx
on public.push_log(user_id, scheduled_at desc);

-- Para responder "¿qué porcentaje de avisos falla, y correlaciona con la
-- duración del descanso?" de un vistazo.
create index if not exists push_log_status_idx
on public.push_log(status)
where status <> 'sent';
