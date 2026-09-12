# Fase 4 (parcial) — Alerta de inactividad en la lista de clientes

Parte de [docs/plan-trainer-improvements.md](../../plan-trainer-improvements.md), sección "Fase 4 — Seguimiento y feedback", sub-punto "Alertas al entrenador".

## Alcance

Solo esto: un aviso visual "X días sin entrenar" (o "sin sesiones") junto a
cada cliente en `ClientsListView.jsx`, calculado al vuelo cuando el
entrenador abre la lista. Fuera de alcance en esta iteración:
- Alerta de PR ("X hizo PR").
- Alerta de series no completadas ("X no completó las series de ayer").
- Cualquier fila en la tabla `notifications` o notificación push/Realtime
  real — esto es un badge visual, no una notificación que llegue si el
  entrenador no abre la app.
- Comentarios bidireccionales (pieza separada de Fase 4).
- RPE/RIR real del cliente (depende de v3 Fase A, no hecha).

## Por qué al vuelo y no vía notifications/cron

El proyecto no tiene ningún mecanismo de job programado (ni `pg_cron` ni un
scheduler externo) — el único edge function existente
(`supabase/functions/send-timer-push`) se invoca bajo demanda, no en cron.
Montar uno solo para esta alerta sería la infraestructura nueva que el plan
explícitamente dice que no hace falta. Calcularlo al vuelo es cero
infraestructura, a costa de que el aviso solo se ve si el entrenador abre la
lista de clientes (no llega como notificación push).

## Cálculo

`src/lib/adherence.js` (ya existe, ya tiene `computeDaysSinceLastSession`)
gana una constante exportada:

```javascript
export const INACTIVITY_ALERT_DAYS = 7;
```

Así el umbral vive en un solo sitio, reusable por cualquier vista futura que
quiera el mismo criterio de "necesita atención".

## Datos

`ClientsListView.jsx` (`fetchClients`) hoy hace dos queries: `trainer_clients`
→ lista de `client_id`, y `profiles` con esos ids. Se añade una tercera
query, en paralelo: `workout_logs.select('user_id, date').in('user_id',
clientIds)`. Sin `.order()`/`.limit()` (se necesitan todas las fechas para
sacar la más reciente por cliente, no solo las últimas N globales). Se
reduce en JS a un mapa `{ [user_id]: fecha más reciente }` — una sola query,
sin N+1 por cliente.

`daysSinceLastSession` por cliente sale de pasarle a
`computeDaysSinceLastSession` un array de una sola fecha (la más reciente de
ese cliente) — o un array vacío si el cliente no tiene ninguna fila en
`workout_logs`.

## UI

En la tarjeta de cada cliente (el `<button>` que renderiza
`client.fullName || client.username`), un badge ⚠️ pequeño junto al nombre,
visible solo si `daysSinceLastSession === null` (nunca entrenó) o
`>= INACTIVITY_ALERT_DAYS`. Texto: "Sin sesiones" en el primer caso, "Hace N
días" en el segundo — mismo formato de etiqueta que ya usa la tarjeta
"Última sesión" de `ClientProfileView.jsx`, para no inventar una redacción
distinta para la misma idea.

## Fuera de alcance (explícito)

- No se toca la tabla `notifications` ni `NotificationsContext.jsx`.
- No se añade ningún cron/scheduler/edge function nuevo.
- No se filtra ni se reordena la lista de clientes por inactividad (Fase 5
  habla de una "lista priorizada" — eso es una vista distinta, no esto).
- No se calcula nada de esto en `ClientProfileView.jsx` más allá de lo que
  ya existe (la tarjeta "Última sesión" no cambia de color ni de
  comportamiento en esta iteración).
