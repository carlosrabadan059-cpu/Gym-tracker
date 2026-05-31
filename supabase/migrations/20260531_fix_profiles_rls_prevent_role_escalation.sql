-- Drop the permissive UPDATE policy
drop policy if exists "Users can update own profile." on public.profiles;

-- New policy: users can update their own profile but role must stay the same
create policy "Users can update own profile."
on public.profiles for update
to authenticated
using ( auth.uid() = user_id )
with check (
  auth.uid() = user_id
  and role = (select role from public.profiles where user_id = auth.uid())
);

-- Trigger as defense-in-depth: block role changes unless caller is a trainer/admin
create or replace function public.prevent_role_escalation()
returns trigger language plpgsql security definer as $$
declare
  caller_role text;
begin
  select role into caller_role from public.profiles where user_id = auth.uid();
  if new.role <> old.role and caller_role not in ('trainer', 'admin') then
    raise exception 'No tienes permisos para cambiar el rol.';
  end if;
  return new;
end;
$$;

drop trigger if exists trg_prevent_role_escalation on public.profiles;
create trigger trg_prevent_role_escalation
before update on public.profiles
for each row execute function public.prevent_role_escalation();
