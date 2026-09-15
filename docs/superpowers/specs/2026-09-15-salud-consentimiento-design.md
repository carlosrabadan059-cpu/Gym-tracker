# Salud del cliente con consentimiento explícito

**Fecha:** 2026-09-15
**Alcance:** `docs/plan-trainer-improvements.md`, Fase 5, primer punto
("Datos de salud del cliente con su consentimiento"). El punto original
mencionaba peso corporal, FC en reposo, pasos y kcal reales — pero al
revisar el código, **peso corporal y kcal reales ya son visibles hoy para
el entrenador sin ningún consentimiento** (`client.weight` en
`ClientProfileView.jsx:605`, kcal reales de sesión en
`WorkoutDetailPanel.jsx`). FC en reposo y pasos, en cambio, no existen en
ningún sitio que el entrenador pueda leer — se leen en vivo de HealthKit
solo en el dispositivo del cliente (`getWeeklyHealthSummary`,
`getRestingHrHistory` en `src/lib/appleHealth.js`), y el entrenador trabaja
en web/iPad sin acceso a HealthKit.

**Decisión de alcance:** esta pieza solo gatea lo que YA existe (peso
corporal, kcal reales de sesión) detrás de un consentimiento revocable. No
construye sincronización nueva de FC en reposo ni pasos — eso exigiría
tocar la app nativa (Capacitor/HealthKit) para escribir esas métricas a una
tabla nueva de Supabase, un proyecto bastante mayor que queda fuera y sin
fecha.

## Decisiones tomadas (brainstorming, no reabrir)

1. **Un solo interruptor**, no uno por tipo de dato. "Compartir peso y
   calorías reales con mi entrenador" — YAGNI, nadie ha pedido granularidad
   por métrica y las dos son datos de sesión/perfil ya mezclados en la UI
   del entrenador.
2. **Se pide al vincularse, pero de forma asíncrona.** Hoy vincular
   cliente-entrenador lo hace solo el entrenador (busca y añade en
   `ClientsListView.jsx`); el cliente no está presente en ese momento. Al
   crear la fila en `trainer_clients` se dispara una notificación (mismo
   mecanismo que `exercise_comments.js` ya usa) y un banner no bloqueante
   en Dashboard/Perfil hasta que el cliente responda.
3. **Denegado por defecto mientras está pendiente.** El entrenador no ve
   peso ni kcal reales hasta que el cliente diga explícitamente que sí —
   es la única forma de que esto sea una protección real y no cosmética.
4. **Las relaciones ya existentes también empiezan en `pending`.** Incluida
   la de Carlos con su entrenador de prueba, que hoy ve su peso sin
   preguntar. Se le pide consentimiento igual que a cualquier vinculación
   nueva, la próxima vez que abra la app — consistente con la regla 3, no
   se hace una excepción por antigüedad.
5. **Revocable en cualquier momento** desde `PrivacyView.jsx` (Perfil →
   Privacidad y Seguridad), con un toggle real. Esa vista ya tiene dos
   toggles (`Perfil Público`, `Verificación en dos pasos`) que son
   completamente decorativos — sin estado, sin `onClick`, sin backend. No
   se tocan; el nuevo toggle es el único funcional de la vista.

## Modelo de datos

Dos columnas nuevas en `trainer_clients` (migración aditiva, no rompe
nada existente):

```sql
alter table public.trainer_clients
  add column health_consent text not null default 'pending'
    check (health_consent in ('pending', 'granted', 'denied')),
  add column health_consent_updated_at timestamptz;
```

No hace falta tabla aparte: `trainer_clients` ya es una fila por cliente
(`unique(client_id)`, un cliente tiene un único entrenador), así que el
consentimiento vive naturalmente ahí, igual de bien scopeado que el resto
de la relación.

**RLS:** el cliente puede hacer `update` de `health_consent` /
`health_consent_updated_at` solo sobre su propia fila
(`client_id = auth.uid()`); el entrenador puede leer la columna pero no
escribirla. Mismo patrón estricto que el fix de seguridad de la Fase 4
(nunca un `is_trainer()` a secas sin comprobar además que el cliente sea
suyo).

## Flujo

1. **Trainer vincula cliente** (sin cambios en `ClientsListView.jsx` más
   allá de un insert extra): al crear la fila en `trainer_clients`
   (`health_consent` queda en su default `'pending'`), se inserta una
   notificación al cliente — `type: 'health_consent_request'`, mismo
   patrón que `exerciseComments.js`.
2. **Cliente ve un banner** no bloqueante en `DashboardView.jsx` y/o
   `ProfileView.jsx` mientras `health_consent === 'pending'`, con dos
   botones — "Permitir" / "No permitir" — que hacen un `update` directo
   sobre su fila de `trainer_clients` (`granted` o `denied`,
   `health_consent_updated_at = now()`). El banner desaparece en cuanto
   deja de estar `pending`.
3. **Cliente cambia de opinión después** desde `PrivacyView.jsx`: nuevo
   toggle "Compartir peso y calorías con mi entrenador", refleja el estado
   actual (`granted`/`denied`; si sigue `pending` se muestra como
   desactivado con una nota "pendiente de responder" en vez de un tercer
   estado visual confuso) y hace el mismo `update`.
4. **`ClientProfileView.jsx`** (lado entrenador): la línea actual
   (`client.weight ? '${client.weight} kg' : 'Sin peso registrado'`) pasa a
   comprobar el consentimiento primero — si `health_consent !== 'granted'`
   se muestra "Sin compartir" sin mirar siquiera si hay peso guardado; solo
   con consentimiento se evalúa el `client.weight ? ... : 'Sin peso
   registrado'` de siempre. En `WorkoutDetailPanel.jsx`, las kcal reales de
   cada sesión (`workoutDuration.realCalories` / `caloriesSource`) se
   ocultan — se sigue viendo duración, ejercicios y series, solo se oculta
   el dato de salud en sí.

## Funciones puras (testeadas)

Nuevo módulo `src/lib/healthConsent.js`:

- `canShowHealthData(healthConsent)` → `boolean`. `true` solo si
  `healthConsent === 'granted'`. Centraliza la condición para que
  `ClientProfileView.jsx` y `WorkoutDetailPanel.jsx` no dupliquen el
  `=== 'granted'` cada uno por su lado (mismo problema que causó la
  inconsistencia de "inicio de semana" — una sola fuente de verdad).
- `getHealthConsentBannerCopy(healthConsent, trainerName)` → `{ title,
  body } | null`. `null` si no hay nada que mostrar (`granted`/`denied`);
  el texto del banner si `pending`.

## Testing

- `src/lib/healthConsent.test.js`: casos de `canShowHealthData` (los 3
  valores + `null`/`undefined` para una fila sin backfill) y de
  `getHealthConsentBannerCopy` (los 3 valores).
- Sin test de RLS — se verifica a mano contra Supabase real, como el resto
  del proyecto (`get_advisors`, y una comprobación manual de que un cliente
  no puede escribir `health_consent` de otro).
- Verificación en navegador (skill `run-rutinex`): banner
  aparece para un cliente en `pending`, desaparece al responder, el toggle
  de `PrivacyView` refleja el estado, y `ClientProfileView`/
  `WorkoutDetailPanel` ocultan el dato cuando no hay consentimiento —
  **nunca guardar/confirmar nada sobre la cuenta real de Carlos sin que él
  mismo lo pida**, solo observar y, si hace falta, usar la cuenta de
  prueba del entrenador con un cliente de prueba para probar el flujo
  completo de extremo a extremo.

## Fuera de alcance

- FC en reposo y pasos (necesitan sync nativo HealthKit → Supabase nuevo).
- Consentimiento granular por tipo de dato.
- Notificación push al entrenador cuando el cliente decide (se entera al
  refrescar `ClientProfileView`, igual que con cualquier otro dato).
- Historial de cambios de consentimiento (solo se guarda el estado actual
  y cuándo cambió por última vez, no un log completo).
