-- Consentimiento del cliente para compartir datos de salud (peso corporal,
-- kcal reales de sesión) con su entrenador. Fase 5 del plan de entrenador.
-- Ver docs/superpowers/specs/2026-09-15-salud-consentimiento-design.md.
--
-- Las filas existentes quedan en 'pending' a propósito: hasta ahora el
-- entrenador veía esos datos sin haberlos pedido nunca, así que toda
-- relación ya creada también pasa por el consentimiento explícito.
alter table public.trainer_clients
    add column health_consent text not null default 'pending'
        check (health_consent in ('pending', 'granted', 'denied')),
    add column health_consent_updated_at timestamptz;

-- Único camino de escritura. No se añade una policy de UPDATE sobre
-- trainer_clients porque RLS no restringe por columna: con ella, un cliente
-- podría reescribir también su trainer_id y reasignarse a otro entrenador
-- saltándose el flujo normal. Esta función solo puede cambiar el
-- consentimiento de la propia fila de quien la llama.
create or replace function public.set_health_consent(new_status text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
    if new_status not in ('granted', 'denied') then
        raise exception 'invalid health_consent status: %', new_status;
    end if;

    update public.trainer_clients
    set health_consent = new_status,
        health_consent_updated_at = now()
    where client_id = auth.uid();
end;
$$;

-- Un `grant ... to authenticated` a secas no basta: Supabase deja la función
-- expuesta también a `anon` en /rest/v1/rpc (lo detecta su propio linter,
-- lint 0028). Sin sesión `auth.uid()` es null y el update no casaría ninguna
-- fila, pero no se deja la puerta abierta. Hay que revocar de `public` (grant
-- por defecto de Postgres) y de `anon` (grant explícito de Supabase).
revoke execute on function public.set_health_consent(text) from public;
revoke execute on function public.set_health_consent(text) from anon;
grant execute on function public.set_health_consent(text) to authenticated;
