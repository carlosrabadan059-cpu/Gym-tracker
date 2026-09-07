# Versión 2: integración con Apple Health

**Fecha:** 2026-09-04 (fases 4-5 y estado añadidos el 2026-09-07)
**Estado:** es la **versión 2** de Rutinex — todas las fases de este documento
(0 a 5) entran aquí. Las mejoras de tipo "funciones de apps de gimnasio"
(calculadora de discos, RPE, superseries, mapa de recuperación muscular)
quedan para la **versión 3**, en [plan-gym-app-features.md](plan-gym-app-features.md).
**Objetivo:** enriquecer Rutinex con datos de Apple Health/Apple Watch para que la app se sienta más completa y cuidada (calidad percibida — no implica añadir un nivel de pago ni infraestructura de suscripción).

---

## Restricción de partida

HealthKit es un framework nativo de iOS. No existe ni ha existido nunca una API web para acceder a él — ninguna PWA, por buena que sea la instalación en pantalla de inicio, puede leerlo. Cualquier integración pasa por código nativo o por una app puente.

## Decisión: ruta elegida

**Capacitor + plugin HealthKit**, envolviendo el build web actual (Vite) en un shell nativo iOS. Se descartaron:

- **Terra / Vital (Junction)** — APIs de agregación de wearables de terceros, pensadas para SaaS multiusuario. Desde $399/mes. Descartado por coste, absurdo para una app de un solo usuario.
- **Health Auto Export** — app de terceros que exporta a un endpoint REST vía automatización. Es de pago y no permite escribir de vuelta a Health (solo lectura). Descartado por ser de pago y por sentirse como un workaround externo, no como parte de la app.
- **iOS Shortcuts → webhook (DIY gratis)** — viable y a coste cero, pero solo lectura, depende de automatizaciones frágiles (no corren con el móvil bloqueado) y no da la sensación de integración nativa que se busca. Queda como opción de validación rápida si en algún momento se quiere probar el concepto sin tocar Xcode, pero no es la ruta recomendada para el resultado final.

### Componentes de la ruta elegida

- `@capacitor/core` + `@capacitor/ios` — envuelve el build de Vite existente sin reescribir la app. El build web/PWA actual no se toca; el shell nativo es un target adicional.
- Plugin [`@capgo/capacitor-health`](https://github.com/Cap-go/capacitor-health) — gratuito, licencia MPL-2.0, sin paywall. Expone `queryWorkouts()`, `readSamples()`, `saveSample()`, `queryAggregated()` sobre HealthKit (iOS) y Health Connect (Android). Se evita el plugin de Capawesome por ser de pago (suscripción Insiders).
- Capability HealthKit en Xcode + claves `NSHealthShareUsageDescription` / `NSHealthUpdateUsageDescription` en Info.plist (obligatorias, Apple rechaza el build sin ellas).

### Coste real

- Sin coste de software (Capacitor y el plugin son gratis).
- Instalación en el propio iPhone vía Xcode + cable, cuenta Apple gratuita: **$0**, pero el certificado expira cada 7 días → hay que reabrir Xcode y reinstalar semanalmente.
- Para evitar esa fricción (instalar y olvidar, o usar TestFlight): entitlement HealthKit exige **Apple Developer Program, $99/año** — no disponible en cuenta personal gratuita para builds persistentes. Decisión pendiente, no bloquea el arranque del plan.

### Riesgo técnico principal — confirmado, no solo sospechado

**Actualización 2026-09-07:** ya no es una duda. Se instaló
`@capgo/capacitor-health` (versión 8.10.5) y se leyó su código, tanto la
interfaz TypeScript (`node_modules/@capgo/capacitor-health/dist/esm/definitions.d.ts`)
como el nativo (`.../ios/Sources/HealthPlugin/Health.swift`), sin necesidad de
dispositivo:

- `Workout` (lo que devuelve `queryWorkouts()`) tiene `workoutEvents` — laps,
  pausas, marcadores — pero **no tiene ningún campo con el tipo de actividad
  por segmento**.
- El Swift del plugin lee `workout.workoutActivityType`: el tipo **único** de
  todo el `HKWorkout`. **Nunca lee `workout.workoutActivities`**, el array de
  `HKWorkoutActivity` con el tipo por segmento que introdujo iOS 16/watchOS 9.

Con el uso real del usuario en el Watch — una sola sesión con segmento
aeróbico + segmento de fuerza (`functionalStrengthTraining`), cambiando entre
ambos sin parar la grabación — `queryWorkouts()` devuelve **un solo workout
con un solo `workoutType`**. No hay forma de distinguir los dos segmentos con
este plugin tal cual está, en ninguna versión de su API.

**Conclusión, ya no condicional:** hace falta una extensión Swift pequeña
dentro del proyecto Capacitor iOS que lea `workoutActivities` directamente
sobre el objeto `HKWorkout` — el dato existe en HealthKit, el plugin
simplemente no lo expone. Esto entra en la Fase 2 (detección de cardio/fuerza
por segmento), no bloquea el resto de la Fase 0.

Sigue pendiente, y esa parte sí necesita dispositivo: confirmar contra un
entreno real que `workoutActivityType` (el que el plugin sí lee) no rompe
nada mientras tanto — es decir, qué tipo único devuelve HealthKit para una
sesión mixta hasta que exista la extensión Swift.

---

## Mapeo de tipos de cardio

| Eliges en Watch | HealthKit devuelve | Etiqueta en Rutinex (`CARDIO_TYPES`, `src/lib/routineUtils.js`) |
|---|---|---|
| Correr en interior | `.running` + `HKMetadataKeyIndoorWorkout = true` | "Correr en cinta" |
| Caminar en interior | `.walking` + `HKMetadataKeyIndoorWorkout = true` | "Andar en cinta" |
| Elíptica | `.elliptical` | "Elíptica" |
| Ciclismo en interior | `.cycling` + `HKMetadataKeyIndoorWorkout = true` | "Bicicleta" |

Mapeo directo, sin heurística de "asumir cinta" — el Watch ya distingue indoor de outdoor de forma explícita.

---

## Roadmap por fases

### Fase 0 — Cimiento

**Estado (2026-09-07): parcialmente hecho.** Lo que es puro código de
servidor/JS está construido y desplegado; lo que exige Xcode no puede
avanzar más en este entorno — no tiene `Xcode.app` instalado (solo las
Command Line Tools), así que `npx cap add ios` no se ha ejecutado.

Hecho:
- `@capacitor/core`, `@capacitor/cli` y `@capgo/capacitor-health` instalados
  (`package.json`). `capacitor.config.json` creado (JSON y no `.ts`: el
  proyecto no usa TypeScript en ningún otro sitio) — **su `appId`
  (`com.rutinex.app`) es un placeholder, hay que confirmarlo o cambiarlo antes
  de `cap add ios`**, porque debe coincidir con lo que se registre en el
  Apple Developer Program.
- Tabla `health_metrics` (user_id, date, steps, weight, active_energy,
  resting_hr, source) creada en Supabase, con RLS y migración en
  `supabase/migrations/20260907_create_health_metrics.sql`.
- Módulo `src/lib/appleHealth.js`: `requestHealthAuthorization`,
  `getTodayMetrics`, `getMostRecentWorkout`, `writeWorkoutToHealth` — todo
  gateado por `Capacitor.isNativePlatform()`, así que hoy son no-ops y el
  build web/PWA no cambia de comportamiento (verificado: `npm run build` sin
  cambios de tamaño de bundle relevantes).
- **Riesgo técnico de `queryWorkouts()` confirmado por lectura de código**
  (ver sección de arriba) — ya no hace falta un dispositivo para saberlo.

Bloqueado, necesita el Mac del usuario con GUI:
- Instalar `Xcode.app` (App Store, gratis, ~15 GB) — sin esto no existe
  `npx cap add ios`, ni capability HealthKit, ni compilar nada para iPhone.
- Una vez instalado: `npx cap add ios`, añadir la capability HealthKit +
  `NSHealthShareUsageDescription`/`NSHealthUpdateUsageDescription` en
  Info.plist, y decidir el `appId` real.
- Decisión pendiente y explícitamente no bloqueante: Apple Developer Program
  ($99/año) para no reinstalar cada 7 días.

### Fase 1 — Conexión visible
- Pantalla "Conectar Apple Health" dentro de perfil/ajustes: solicitar permisos, mostrar estado de conexión, última sincronización, botón para desconectar.

### Fase 2 — La función que motivó el plan
- Modal "Añadir Cardio Previo" (`src/views/DashboardView.jsx`, líneas ~351-440): al abrirlo, detectar el segmento aeróbico del workout de Watch más reciente y mostrar un banner tipo "Detectado: Correr en cinta · 22 min · 245 kcal" con opción de usar el dato o ignorarlo y seguir con el flujo manual actual. Sustituye la estimación de `calculateCardioCalories` (`src/lib/routineUtils.js`, línea ~109) por las kcal reales del Watch cuando el usuario acepta.
- En `onFinish` (`src/GymTrackerApp.jsx`): sustituir la estimación MET del entreno de fuerza por las kcal reales del segmento de fuerza del Watch, cuando exista.
- Escribir el entreno completado de Rutinex de vuelta a Apple Health, para que aparezca en los anillos de Actividad — cierra el círculo entre la app y el ecosistema nativo de Apple, y es la pieza que más aporta a la sensación de integración cuidada.

### Fase 3 — Superficie de datos
- Dashboard: card de salud con pasos del día, kcal activas, última sincronización.
- Estadísticas (`src/views/StatisticsView.jsx`): gráfica de peso corporal en el tiempo, tendencia de frecuencia cardiaca en reposo, comparativa histórica de kcal reales vs estimadas.
- Peso corporal recogido automáticamente desde Health en vez de pedirlo por input manual.

### Fase 4 — Live Activity durante el entreno

Mapeo del flujo real de uso (entras al ejercicio → marcas serie → arranca
descanso → termina descanso → completas ejercicio → siguiente) a eventos de
una Live Activity (Dynamic Island + pantalla bloqueada):

| Acción en la app | Disparador en código | Qué hace la Live Activity |
|---|---|---|
| Entras al ejercicio | se abre `ExerciseDetailModal` | **Arranca** la Activity: nombre del ejercicio, "0/X series" |
| Marcas serie completada | `toggleSet()` ([ExerciseDetailModal.jsx:206](../src/views/ExerciseDetailModal.jsx#L206)) — ya calcula `targetTime` y programa `scheduleServerPush` ([línea 233](../src/views/ExerciseDetailModal.jsx#L233)) | **Actualiza** a "Descanso" con cuenta atrás — mismo `targetTime`, se le pasa tal cual a la Activity |
| Descanso llega a 0 | dispara el beep/push existente | **Actualiza** a "Descanso terminado" — reutilizando la MISMA notificación push, no hay que montar nada nuevo del lado servidor |
| Tocas "Completar Ejercicio" | footer ([ExerciseDetailModal.jsx:686-698](../src/views/ExerciseDetailModal.jsx#L686-L698)), `onClose(true,...)` | **Actualiza** al siguiente ejercicio |
| Terminas la rutina | `onFinish` en `GymTrackerApp.jsx` | **Termina** la Activity |

En foreground, arrancar/actualizar/terminar se hace directo desde Swift vía
Capacitor, sin pasar por push. El caso que sí depende de push es "descanso
termina con el móvil bloqueado" — y ahí se reutiliza la infraestructura que
ya existe (`scheduleServerPush` en
[pushNotifications.js](../src/lib/pushNotifications.js)): se le añade el
payload de actualización de la Activity (vía token APNs de tipo
`liveactivity`) a la misma llamada que ya manda el push web actual.

Falta construir (nativo, fuera de React): el puente Capacitor→ActivityKit
para arrancar/actualizar/terminar la Activity, y extender la Edge Function
`send-timer-push` para incluir ese payload.

**⚠️ Prerrequisito — el push actual falla de forma intermitente:**
investigando `send-timer-push` ([Supabase Edge Function](https://supabase.com/dashboard/project/jqpyqqlkgisykgywilrf/functions/send-timer-push)),
usa `EdgeRuntime.waitUntil()` con un loop que espera hasta `targetTime`
haciendo heartbeats a la DB cada 5s para evitar que Deno pause la función.
Esto es fràgil por diseño:
- Las *background tasks* de Edge Functions tienen un tope de duración — un
  descanso largo (3+ min) puede superar ese tope y la función muere antes
  de enviar el push, mientras que un descanso corto (60-90s) sí funciona.
  Esto encaja con el síntoma descrito ("a veces fallan") — probablemente
  correlaciona con la duración del descanso, no es aleatorio.
- Si `webPush.sendNotification()` falla (suscripción caducada, red
  intermitente), el error solo se hace `console.error` dentro de la Edge
  Function — nadie lo ve nunca, ni en el cliente ni en ningún sitio visible.
  Sin reintento.
- Web Push en iOS solo funciona si la PWA está instalada a pantalla de
  inicio (no en una pestaña normal de Safari) — si alguna vez se abre desde
  un marcador/pestaña, el push no llega y no hay forma de saberlo desde la
  app.

Antes de construir la Live Activity sobre este mecanismo, conviene
arreglarlo: mover el rest-timer-push a un cron/queue con reintento real (o
acortar el heartbeat y loguear a una tabla consultable en vez de solo
`console.error`) en vez del loop actual dentro de la función.

### Fase 5 — Pulido opcional
- Notificaciones (`src/context/NotificationsContext.jsx`): aviso si llevan varios días sin sincronizar, insight semanal de actividad.
- **Notificación proactiva**: Health detecta un entreno (fuerza o cardio) sin log correspondiente en Rutinex ese día → notificación "Detectamos 42 min de fuerza sin registrar, ¿lo añades?". Usa el mismo `NotificationsContext.jsx`, cero infraestructura nueva.
- **Haptics** (`@capacitor/haptics`, oficial, gratis): vibración al marcar serie completada y al terminar el descanso — barato de construir, alto impacto percibido, no depende de Health.
- **Widget de pantalla de inicio** (`Cap-go/capacitor-widget-kit`, gratis): racha + pasos del día, sin abrir la app.
- Frecuencia cardiaca en vivo durante el entreno — más caro técnicamente (requiere sesión HealthKit en vivo, `HKWorkoutSession`, no una simple lectura por lotes). Dejar para el final.
- Vista de entrenador viendo datos de salud de un cliente — implica compartir datos de salud entre usuarios, tema de privacidad que se decide aparte; no entra en el alcance de este plan.

**Orden de ataque recomendado:** Fase 0 → validar el riesgo técnico de Fase 2 con un entreno real → resto de Fase 2 → Fase 1 → Fase 3 → arreglar el push (prerrequisito de Fase 4) → Fase 4 → Fase 5.

---

## Notas fuera del alcance de Health, encontradas durante esta planificación

No forman parte de la integración con Apple Health, pero se detectaron
revisando código relacionado — quedan aquí para no perderlas; encajaría
también abrirlas como issues sueltos en GitHub si se prefiere seguir el
flujo normal de `docs/agents/issue-tracker.md`.

- **Diálogo nativo de iOS "Shake to Undo" apareciendo durante el entreno**
  (el usuario lo describe como "me pregunta si deseo cancelar" al mover el
  móvil). Causa real encontrada en
  [GymTrackerApp.jsx:31-87](../src/GymTrackerApp.jsx#L31-L87)
  (`useShakeToUndoPrevention`): el hook está pensado para desenfocar el
  input activo ANTES de que iOS muestre su diálogo nativo (~15 m/s²), pero
  el umbral se subió de `8` a `22` en el commit `bfd20fe` ("shake threshold")
  para evitar falsos positivos por el móvil en el bolsillo. El problema: 22
  está POR ENCIMA del umbral real de iOS (~15), así que ya no lo adelanta —
  durante un entreno (brazo moviéndose, móvil en banda/soporte) el diálogo
  nativo de iOS dispara igual. Bajar el número sin más reintroduce el
  problema original (falsos positivos en bolsillo) que motivó subirlo a 22.
  Mejor solución probable: en vez de un único umbral instantáneo, exigir 2+
  cruces del umbral en una ventana corta (p. ej. 500ms) antes de desenfocar
  — distingue una sacudida real (oscilación rápida) de un solo golpe o
  vibración continua, permitiendo bajar el umbral base sin disparar tanto
  por movimiento normal.
- **Fallos intermitentes del aviso de fin de descanso**: ver el prerrequisito
  documentado en la Fase 4 arriba — mismo mecanismo (`send-timer-push`),
  mismo diagnóstico.

---

## Diseño de UI — decidido

Se prototipó la UI con 3 variantes (datos mock, sin backend real) para validar
cómo debía verse la card de salud del Dashboard y el modal "Añadir Cardio
Previo" antes de construir nada. **Ganadora: Variante B — "Detección
primero"**, confirmada por el usuario el 2026-09-04:

- Card de salud grande y prominente arriba del Dashboard (pasos, kcal activas, última sync).
- En el modal de cardio, el workout detectado por Health es la ruta principal (hero, CTA "Usar estos datos"), no un añadido secundario.
- El grid manual de tipos de cardio (Andar/Correr en cinta, Elíptica, Bicicleta) queda colapsado detrás de "Elegir manualmente" — sigue disponible, pero deja de ser lo primero que se ve.
- Estado "no conectado": card con CTA "Conectar con Apple Health" en vez de las estadísticas.

Marcado de referencia (mock, a reescribir con datos reales al implementar la Fase 0-2 — quitar el botón "Ver demo", `mockData.js`, y conectar a `health_metrics`/HealthKit real):

```jsx
const VariantB = ({ connected, onToggleConnected }) => {
    const [showModal, setShowModal] = useState(false);
    const [useDetected, setUseDetected] = useState(null); // null = sin decidir, true/false
    const [showManual, setShowManual] = useState(false);
    const [selectedType, setSelectedType] = useState(null);

    return (
        <div className="space-y-4">
            {connected ? (
                <Card className="border border-surface-highlight">
                    <div className="flex items-center justify-between mb-3">
                        <h4 className="font-bold text-text-primary flex items-center gap-2">
                            <Activity size={16} className="text-primary" />
                            Salud de hoy
                        </h4>
                        <span className="flex items-center gap-1 text-[10px] text-text-secondary">
                            <RefreshCw size={10} /> {lastSync}
                        </span>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                        <div className="rounded-xl bg-surface-highlight/60 p-3">
                            <p className="text-xl font-black text-text-primary">{steps.toLocaleString('es-ES')}</p>
                            <p className="text-[11px] text-text-secondary">de {stepsGoal.toLocaleString('es-ES')} pasos</p>
                        </div>
                        <div className="rounded-xl bg-surface-highlight/60 p-3">
                            <p className="text-xl font-black text-text-primary flex items-center gap-1">
                                <Flame size={16} className="text-orange-400" />{activeKcal}
                            </p>
                            <p className="text-[11px] text-text-secondary">kcal activas</p>
                        </div>
                    </div>
                </Card>
            ) : (
                <Card className="border border-primary/30 bg-gradient-to-br from-primary/10 to-transparent text-center py-6">
                    <Sparkles size={28} className="text-primary mx-auto mb-2" />
                    <h4 className="font-bold text-text-primary mb-1">Conecta Apple Health</h4>
                    <p className="text-xs text-text-secondary mb-4 max-w-[16rem] mx-auto">
                        Detecta tu cardio automáticamente y trae kcal reales del Watch a cada entreno.
                    </p>
                    <Button onClick={onToggleConnected} className="bg-primary text-black font-bold rounded-full px-6">
                        Conectar con Apple Health
                    </Button>
                </Card>
            )}

            {/* Modal "Añadir Cardio Previo" — extiende el existente en DashboardView.jsx */}
            {connected && useDetected !== false ? (
                <div className="rounded-2xl border-2 border-primary bg-primary/10 p-4 mb-4 text-center">
                    <Sparkles size={22} className="text-primary mx-auto mb-1" />
                    <p className="text-xs text-text-secondary mb-1">Detectado en tu Apple Watch</p>
                    <p className="text-lg font-black text-text-primary">{detectedWorkout.type}</p>
                    <p className="text-sm text-text-secondary mb-4">{detectedWorkout.duration} min · {detectedWorkout.kcal} kcal reales · {detectedWorkout.detectedAgo}</p>
                    <div className="flex flex-col gap-2">
                        <Button className="w-full bg-primary text-black font-bold h-11 rounded-xl" onClick={() => { setUseDetected(true); setSelectedType(detectedWorkout.type); }}>
                            Usar estos datos
                        </Button>
                        <button onClick={() => { setUseDetected(false); setShowManual(true); }} className="text-xs text-text-secondary underline">
                            Elegir manualmente
                        </button>
                    </div>
                </div>
            ) : null}
            {/* si !connected || useDetected === false: grid manual existente, colapsado tras "Elegir manualmente" */}
        </div>
    );
};
```

Prototipo ya borrado (`src/views/prototype-apple-health/`, `prototype-health.html`, `src/prototype-health-main.jsx`) — este bloque es la única referencia que queda.

### Extensión: detección del segmento de fuerza al finalizar

Mismo patrón que la detección de cardio (hero + "Usar estos datos"), pero en
el otro extremo del entreno: al finalizar, no al empezar. Sin cambios de
comportamiento si no hay Watch — cero fricción añadida para quien no lo use.

Hoy, [OtherViews.jsx:273-298](../src/views/OtherViews.jsx#L273-L298) guarda al
instante en cuanto se toca "Finalizar": calcula `realCalories` con
`calculateRealCalories` (estimación MET) y llama a `onFinish(finalLogs)` sin
ninguna pantalla intermedia.

Cambio propuesto:

- **Sin segmento de fuerza detectado** (sin Watch, o Health no conectado): comportamiento idéntico al actual — un toque en "Finalizar" y guarda, sin pantalla añadida.
- **Con segmento detectado**: al tocar "Finalizar", antes de guardar, mostrar un hero con la misma identidad visual que el de cardio de la Variante B:

```
┌─────────────────────────────────────┐
│         ✨ Detectado en tu Watch      │
│      Entrenamiento de fuerza         │
│   42 min · 310 kcal reales           │
│                                       │
│   [ Usar estos datos ]  ← primario   │
│   Usar estimación (298 kcal)         │
└─────────────────────────────────────┘
```

Sigue siendo un solo toque — la única decisión es qué número de kcal se
guarda (real del Watch vs. estimación MET actual). `finalLogs.workoutDuration.realCalories`
pasa a venir del Watch cuando el usuario acepta, en vez de
`calculateRealCalories`.

**Detección técnica:** mismo `queryWorkouts()` que la detección de cardio,
filtrando por tipo `functionalStrengthTraining` (o `traditionalStrengthTraining`)
y por solape de rango horario con `workoutStartTime` → momento de tocar
"Finalizar". Sujeto al mismo riesgo técnico ya anotado arriba (confirmar qué
devuelve el plugin por segmento antes de construir esto).

## Diseño de Estadísticas — decidido

Se prototiparon 3 variantes (datos mock) para las 4 piezas de Health en
`StatisticsView.jsx`: card semanal en Resumen, peso corporal + kcal real vs.
estimado en Progresión, FC en reposo en Actividad. **Ganadora: Variante B —
"Secciones dedicadas"**, con un detalle prestado de la Variante C, confirmado
por el usuario el 2026-09-04:

- **Resumen**: card propia "Salud (7 días)" debajo del grid de 3 números existente (pasos/día, kcal activas, FC reposo) — no se mezcla con el grid, va aparte.
- **Progresión**: sección "Peso corporal" separada de la gráfica de progresión por ejercicio ya existente (kg levantado ≠ peso corporal — importante no confundirlas), colapsable con "Mostrar/Ocultar". Debajo, sección "Kcal reales vs. estimadas" con `BarChart` de dos series y **chips de leyenda con color** (● Reales (Watch) / ● Estimadas (MET)) — este detalle viene de la Variante C, más claro que el texto plano.
- **Actividad**: card aparte bajo el heatmap de 90 días, "FC en reposo" con su propia mini-gráfica de línea.

Se descartó la Variante A (fusionar todo en los elementos existentes) por un
bug real que expuso el prototipo: al superponer barras de sesiones (escala
0-3) y línea de FC en reposo (escala 54-61) en el mismo eje Y, las barras
quedaban aplastadas — arreglarlo exigiría un eje Y secundario, quitándole a
A su ventaja de "no añadir nada nuevo". Se descartó la Variante C completa
(chips activables sobre una única gráfica compartida) por pedir más
interacción para ver lo mismo que B muestra directo — se quedó solo con el
detalle de los chips de leyenda.

El set completo de las 3 variantes (código real, no solo capturas) se
conserva como fuente primaria en la rama `prototype/statistics-health-ui`,
fuera de `main`. Ver `src/views/prototype-statistics-health/NOTES.md` en esa
rama para el detalle de cada variante.

## Estado

Documento de planificación + diseño de UI decidido para Dashboard (Variante
B) y Estadísticas (Variante B + chips de C) + mapeo de eventos para la Live
Activity (Fase 4). Nada de lo descrito aquí se ha implementado contra datos
reales ni ejecutado en producción todavía — falta la Fase 0 (Capacitor,
plugin, tabla Supabase, validar el riesgo técnico de `queryWorkouts()`) y,
antes de la Fase 4, arreglar la fiabilidad del push actual.

Ver también [docs/plan-gym-app-features.md](plan-gym-app-features.md) —
estudio de funciones de las apps de gimnasio mejor valoradas y propuesta de
cuáles añadir a Rutinex, más allá de la integración con Health.
