-- The WITH CHECK of "Users can update own profile." queried public.profiles
-- from inside a profiles policy, which Postgres rejects with
-- "infinite recursion detected in policy for relation profiles": every
-- profile save (e.g. changing the goal) failed.
--
-- Role protection moves entirely to the prevent_role_escalation trigger.
-- The policy used to also stop trainers changing their own role, so the
-- trigger now only lets admins change a role.

drop policy if exists "Users can update own profile." on public.profiles;

create policy "Users can update own profile."
on public.profiles for update
to authenticated
using ( auth.uid() = user_id )
with check ( auth.uid() = user_id );

create or replace function public.prevent_role_escalation()
returns trigger language plpgsql security definer as $$
declare
  caller_role text;
begin
  select role into caller_role from public.profiles where user_id = auth.uid();
  if new.role <> old.role and caller_role <> 'admin' then
    raise exception 'No tienes permisos para cambiar el rol.';
  end if;
  return new;
end;
$$;
