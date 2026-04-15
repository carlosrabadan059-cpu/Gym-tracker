-- Permite a entrenadores y admins leer los logs de entrenamientos de sus clientes
create policy "Trainers can view client workout logs"
on public.workout_logs for select
to authenticated
using (
  auth.uid() = user_id
  OR EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.user_id = auth.uid()
    AND profiles.role IN ('trainer', 'admin')
  )
);
