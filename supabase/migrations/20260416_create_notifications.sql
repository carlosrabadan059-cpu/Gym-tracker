-- Tabla de notificaciones
create table if not exists public.notifications (
    id uuid primary key default gen_random_uuid(),
    user_id uuid not null references auth.users(id) on delete cascade,
    title text not null,
    message text,
    type text default 'info',
    read boolean not null default false,
    created_at timestamptz not null default now()
);

alter table public.notifications enable row level security;

create policy "Users can read own notifications"
on public.notifications for select
to authenticated
using (auth.uid() = user_id);

create policy "Users can update own notifications"
on public.notifications for update
to authenticated
using (auth.uid() = user_id);

create policy "Users can delete own notifications"
on public.notifications for delete
to authenticated
using (auth.uid() = user_id);

create policy "Authenticated users can insert notifications"
on public.notifications for insert
to authenticated
with check (true);

-- Índice para consultas por usuario ordenadas por fecha
create index if not exists notifications_user_id_created_at_idx
on public.notifications(user_id, created_at desc);
