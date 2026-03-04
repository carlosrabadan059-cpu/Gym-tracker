create table public.workout_logs (
    id uuid default gen_random_uuid() primary key,
    user_id uuid references auth.users not null,
    routine_id text not null,
    date timestamp with time zone default now() not null,
    logs jsonb not null
);

-- Enable RLS
alter table public.workout_logs enable row level security;

-- Policies
create policy "Users can view their own workout logs"
on public.workout_logs for select
to authenticated
using ( auth.uid() = user_id );

create policy "Users can insert their own workout logs"
on public.workout_logs for insert
to authenticated
with check ( auth.uid() = user_id );

create policy "Users can update their own workout logs"
on public.workout_logs for update
to authenticated
using ( auth.uid() = user_id )
with check ( auth.uid() = user_id );

create policy "Users can delete their own workout logs"
on public.workout_logs for delete
to authenticated
using ( auth.uid() = user_id );
