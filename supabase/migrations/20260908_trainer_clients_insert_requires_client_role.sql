-- Hallazgo de code review: la política de insert en trainer_clients no
-- comprobaba que client_id fuera de verdad el perfil de un cliente
-- (role='client'). Solo lo filtraba search_addable_clients, pero cualquier
-- insert directo que no pasara por ahí podía vincular a un entrenador o
-- admin como si fuera cliente, sin que nada lo detectase — el filtro que
-- antes existía en el cliente (TRAINER_ROLES) no tenía equivalente en la
-- base de datos.
drop policy if exists "Trainers can add clients" on public.trainer_clients;

create policy "Trainers can add clients"
on public.trainer_clients for insert
to authenticated
with check (
    trainer_id = auth.uid()
    and is_trainer()
    and exists (
        select 1 from public.profiles p
        where p.user_id = client_id and p.role = 'client'
    )
);
