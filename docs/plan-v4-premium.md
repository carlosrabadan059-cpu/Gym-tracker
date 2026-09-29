# Versión 4: funciones premium

**Fecha:** 2026-09-29
**Estado:** propuesta, **sin empezar**. Nada de este documento está
implementado ni decidido; es el punto de partida para hablarlo.
**Objetivo:** definir qué funciones justificarían un plan de pago en Rutinex,
sin repetir lo que ya cubren la
[versión 2](plan-apple-health-integration.md) (Apple Health, Watch, Live
Activity), la [versión 3](plan-gym-app-features.md) (1RM, RPE, superseries,
recuperación muscular) y el [plan del entrenador](plan-trainer-improvements.md)
(prescripción, IA, calendario, adherencia).

---

## Antes de cobrar: requisitos

Hoy Rutinex no tiene ninguna infraestructura de pago ni de planes. Sin estos
puntos no se puede cobrar nada, así que son la Fase 0 de todo lo demás.

1. **Apple Developer Program (99 €/año).** Sin él no hay App Store, ni compras
   dentro de la app, y la firma sigue caducando cada 7 días (ver
   [handoff-ios27.md](handoff-ios27.md)). También quita el paso manual de
   reinstalar cada semana.
2. **Planes en Supabase.** Columnas `plan` y `plan_expires_at` en `profiles`,
   y las políticas RLS de las tablas premium comprobando el plan en el
   servidor, no en la app. Para leer el plan desde una policy hay que usar una
   función `security definer` (como `is_trainer()`): una policy de `profiles`
   no puede consultar `profiles` (ver CLAUDE.md).
3. **Cobro.** En iOS, Apple exige su sistema de compra dentro de la app para
   suscripciones digitales. RevenueCat tiene plugin de Capacitor y valida los
   recibos. En la PWA, Stripe. Las dos vías actualizan el mismo `plan` en
   Supabase, por webhook.
4. **Cupo de IA por plan.** El chat y el asistente del entrenador (vía n8n)
   tienen coste por llamada. Hace falta un límite por plan antes de abrir la
   IA a más usuarios.

## Premium para quien entrena

### A1. Disposición diaria (readiness)

Una nota diaria de lo preparado que está el cuerpo, calculada con la
variabilidad cardiaca (HRV), el pulso en reposo y el sueño que ya guarda
Health. Con una nota baja, la sugerencia de peso de la Fase A de v3 baja el
volumen o la carga. Es lo que distingue a Whoop y Fitbod, y Rutinex ya tiene
casi todos los datos.

**Base existente:** `src/lib/appleHealth.js`, la sugerencia de peso, el mapa
de recuperación.
**Por confirmar:** si el plugin de Health lee HRV y sueño (hoy solo se usan
entrenos, pulso y kcal).

### A2. Watch completo

Ver en el reloj el ejercicio actual, el peso y la serie, y marcar la serie
desde él. En v2 se dejó fuera a propósito ("las series se marcan solo en el
iPhone"). Es la función premium más visible, y la más cara.

**Base existente:** la app del Watch con `HKWorkoutSession`, el canal
WatchConnectivity y los avisos de descanso, estables desde el 29-09.

### A3. Detección de estancamiento y semana de descarga

Si el 1RM estimado de un ejercicio no sube en varias sesiones, o el RPE sube
con el mismo peso, la app lo señala y propone una semana de descarga.
Progresión inteligente para quien no tiene entrenador.

**Base existente:** 1RM de Epley y RPE por serie (v3, Fase A).

### A4. Volumen semanal por músculo

Series efectivas por grupo muscular y semana, comparadas con rangos objetivo
(mínimo eficaz y máximo recuperable, MEV/MRV). Es la estadística avanzada
típica de las apps de pago.

**Base existente:** el etiquetado de músculos principales y secundarios de la
Fase C de v3.

### A5. Informe mensual

Resumen del mes con récords, tendencias, adherencia y kcal reales del Watch,
que se pueda compartir. Ayuda a la retención y a ver el progreso.

**Base existente:** `StatisticsView.jsx` y `workout_logs`.

### A6. Historial de récords por ejercicio

Línea de tiempo de récords con fecha y peso. Barato y muy valorado.

**Base existente:** el cálculo del récord estimado de v3.

## Pro para entrenadores

Rutinex está pensado alrededor de la relación entrenador-cliente, así que es
probable que el ingreso real venga de cobrar al entrenador por número de
clientes, como TrueCoach o Trainerize, más que de un plan individual.

### E1. Tramos por número de clientes

Hasta 3 clientes gratis; a partir de ahí, de pago por tramos.

**Base existente:** la tabla `trainer_clients` de la Fase 0 del plan del
entrenador.

### E2. Revisión semanal del cliente

El cliente manda cada semana su peso, medidas, fotos y sensaciones, y el
entrenador lo ve en una línea de tiempo. Es lo que más piden los entrenadores
que trabajan online.

**Por decidir:** dónde se guardan las fotos (Supabase Storage con RLS por
cliente y entrenador) y cuánto tiempo.

### E3. Chat entrenador-cliente

Hoy solo hay comentarios por ejercicio (Fase 4 del plan del entrenador). Un
chat general cubre lo que no encaja en un ejercicio concreto.

**Base existente:** las notificaciones con Supabase Realtime.

### E4. Riesgo de abandono

Cruza días sin entrenar, RPE a la baja y revisiones que no llegan, y avisa al
entrenador antes de que el cliente lo deje. Amplía el badge de inactividad
actual.

### E5. Marca propia del entrenador

Logo y colores del entrenador en la app de su cliente. Muy vendible y barato:
el tema ya funciona con variables CSS (`src/index.css`, `ThemeContext.jsx`).

### E6. Informe automático al cliente

Resumen semanal del cliente redactado por la IA, que el entrenador revisa y
envía.

**Base existente:** el asistente de IA del entrenador (Fase 2 del plan del
entrenador).

## Descartado o con reservas

- **Análisis de la técnica con la cámara.** Caro de construir, poco fiable, y
  requiere cámara nativa: en web el acceso está limitado.
- **Nutrición.** Es otro producto entero. Si hace falta, mejor leer lo que
  registren otras apps de nutrición a través de Health que construirlo.
- **Feed social.** Ya descartado en v3 por chocar con el enfoque
  entrenador-cliente.

## Orden propuesto

1. **Fase 0:** Developer Program, planes en Supabase, RevenueCat y Stripe,
   cupo de IA. Sin esto no se cobra.
2. **A6, A4 y A5:** baratos, con datos que ya existen; dan contenido al plan
   premium desde el primer día.
3. **E1, E2 y E4:** lo que justifica que un entrenador pague.
4. **A1 y A3:** el diferencial "inteligente".
5. **A2:** el Watch completo, lo más caro, al final.
6. **E3, E5 y E6:** cuando haya entrenadores pagando que los pidan.

## Riesgo principal

Hoy Rutinex tiene un solo usuario real en producción. Montar la parte de cobro
antes de tener entrenadores o usuarios que la vayan a probar es trabajo sin
retorno. Antes de la Fase 0 conviene validar con 2 o 3 entrenadores si
pagarían por E1, E2 y E4, y a qué precio.
