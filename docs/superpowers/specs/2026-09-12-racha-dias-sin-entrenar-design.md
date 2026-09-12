# Fase 4 (parcial) — Racha y días sin entrenar

Parte de [docs/plan-trainer-improvements.md](../../plan-trainer-improvements.md), sección "Fase 4 — Seguimiento y feedback", sub-punto "Adherencia".

## Alcance

Solo esto de Fase 4: racha de días consecutivos con sesión, y días desde la
última sesión, visibles en el perfil del cliente para el entrenador. Fuera
de alcance en esta iteración:
- % de sesiones completadas sobre asignadas (necesita un "objetivo" de
  frecuencia que hoy no existe en ningún sitio — se hace cuando exista,
  vía Fase 3 o un campo simple).
- Alertas al entrenador ("X lleva 8 días sin entrenar") — depende de tener
  esto calculado primero.
- Comentarios bidireccionales por sesión/ejercicio.
- Ver RPE/RIR real del cliente — depende de v3 Fase A, no hecha.

## Cálculo

Todo en cliente, sin queries nuevas a Supabase: `ClientProfileView.jsx` ya
carga `workoutHistory` (últimas 20 sesiones de `workout_logs`, ordenadas por
`date` descendente, línea ~110-133 actual).

Nuevo módulo puro `src/lib/adherence.js`:

- `computeStreak(dates)`: recibe un array de fechas (ISO string o `Date`),
  las normaliza a día calendario (sin hora), las deduplica, las ordena
  descendente, y cuenta días consecutivos hacia atrás **empezando desde hoy
  o ayer** (si la sesión más reciente es de anteayer o antes, la racha es 0
  — no hay "racha muerta" que mostrar como si estuviera viva). Cada hueco de
  más de 1 día corta el conteo.
- `computeDaysSinceLastSession(dates)`: `hoy - fecha más reciente`, en días
  enteros. Devuelve `null` si `dates` está vacío (sin sesiones registradas).

**Limitación conocida y aceptada:** como se reusan las 20 sesiones ya
cargadas (sin límite ampliado ni query aparte), una racha real de más de 20
días consecutivos se subestimaría. Se acepta porque es un caso raro en este
dominio (entrenamiento de gimnasio, no hábito diario tipo Duolingo).

## UI

En `ClientProfileView.jsx`, el grid de stats (línea ~366, hoy 2 tarjetas:
Sesiones y Rutinas, `grid-cols-2`) pasa a 4 tarjetas, mismo grid a 2 filas:

- 🔥 **Racha** — valor `{streak}`, etiqueta "días seguidos".
- 📅 **Última sesión** — "Hoy" si 0 días, "Ayer" si 1, "Hace N días" si más,
  "Sin sesiones" si `daysSinceLastSession` es `null`.

Sin cambios en Supabase, sin migración, sin tocar ninguna otra vista.

## Fuera de alcance (explícito)

- No se toca `ClientsListView.jsx` (sin badge en la lista de clientes).
- No se amplía el límite de 20 sesiones de `workoutHistory`.
- No se añade ningún campo de "frecuencia objetivo" a `assigned_routines`
  ni `profiles`.
