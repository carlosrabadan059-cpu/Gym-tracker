# Frecuencia cardiaca en vivo durante el entreno (v2 Fase 5)

**Fecha:** 2026-09-16
**Alcance:** última pieza pendiente de Fase 5 (pulido opcional) de
`docs/plan-apple-health-integration.md`, y con ella la última de todo el
plan v2. Pulso en vivo durante el descanso entre series, para ver la
recuperación.

## La premisa del plan estaba equivocada

El plan decía, literalmente: *"Frecuencia cardiaca en vivo durante el
entreno — más caro técnicamente (requiere sesión HealthKit en vivo,
`HKWorkoutSession`, no una simple lectura por lotes). Dejar para el final."*

Eso es incorrecto por dos motivos:

1. **`HKWorkoutSession` es exclusivo de watchOS.** No se puede arrancar
   desde una app de iOS. La API sencillamente no está disponible en el
   target del iPhone.
2. **El iPhone no tiene sensor de pulso.** La frecuencia cardiaca siempre
   la mide el Apple Watch y la escribe en HealthKit. La app de iPhone, haga
   lo que haga, solo puede *leer* lo que el Watch ya dejó ahí.

Por tanto la lectura por lotes no es un sucedáneo pobre de la "sesión en
vivo": es el único mecanismo que existe en iPhone, y el plugin ya instalado
(`@capgo/capacitor-health`) lo expone con `readSamples`. La pieza resulta
ser barata, no cara: cero Swift, cero targets nuevos de Xcode.

## Punto de partida real

- `src/lib/appleHealth.js` pide hoy
  `READ_TYPES = ['steps', 'weight', 'calories', 'restingHeartRate', 'workouts']`.
  Nótese `restingHeartRate` (FC en reposo, un valor diario) — **no**
  `heartRate`, que es la muestra instantánea que hace falta aquí.
- Todas las lecturas actuales del módulo usan `queryAggregated`. Para esta
  pieza hace falta `readSamples`, porque se necesita la marca de tiempo de
  la muestra concreta para decidir si el dato está fresco; una agregación
  la perdería.
- `HealthSample` (tipos del plugin) trae `value`, `unit`, `startDate`,
  `endDate`, `sourceName`. Para `heartRate`, `value` es bpm y `startDate`
  es el instante de la muestra.
- El bloque "Temporizador de Descanso" vive en
  `src/views/ExerciseDetailModal.jsx` (~línea 618) y ya tiene el estado
  `timerActive` que marca exactamente la ventana en la que interesa leer.
- `appleHealth.js` no tiene fichero de tests: es el puente nativo. Los
  módulos con tests en este repo (`adherence.js`, `superset.js`,
  `muscleRecovery.js`…) son todos de lógica pura sin imports nativos.

## Cadencia real del dato (el condicionante de todo el diseño)

El Apple Watch escribe muestras de `heartRate` a ritmos muy distintos según
lo que esté haciendo:

- **Con un entreno arrancado en el Watch:** cada ~5 segundos.
- **Puesto pero sin entreno:** cada ~5-10 minutos (lecturas ambientales).
- **Sin Watch:** ninguna.

Es decir: el pulso solo es "en vivo" si el usuario lleva el Watch **y** ha
arrancado un entreno en él. Sin eso, la muestra más reciente puede ser de
hace varios minutos, inútil para juzgar recuperación y peligrosa si se
pinta como si fuera de ahora.

## Decisiones tomadas (brainstorming, no reabrir)

1. **Propósito: saber si ya me recuperé.** El número sirve para decidir
   cuándo arrancar la siguiente serie, mirando el móvil durante el
   descanso. Se descartó "ver intensidad durante la serie" (mientras
   levantas no miras el móvil, y la FC llega con retraso) y "solo verlo"
   (acaba siendo adorno).

2. **Se muestra el pulso actual junto a la caída desde el pico** del propio
   descanso: `145 → 118`. Un número suelto no dice si te estás recuperando
   salvo que recuerdes de dónde venías; la caída es la señal. El pico se
   guarda en un ref y se resetea al empezar cada descanso.

3. **Sin dato fresco: hueco apagado con pista.** Se pinta `♥ —` y un texto
   pequeño, "Arranca el entreno en el Watch". No se pinta el último valor
   conocido con su antigüedad: un número viejo durante un descanso invita a
   leerse como si fuera de ahora. Y no se omite el bloque entero, porque un
   fallo silencioso es indistinguible de una función rota — en esta misma
   sesión se perdió tiempo depurando el Entrenador IA justo por eso.

4. **Polling desde JS, solo durante el descanso.** Descartado un observer
   nativo en Swift (`HKAnchoredObjectQuery` + background delivery): su
   única ventaja sería tener pulso con el móvil bloqueado o en la Live
   Activity, que el propósito elegido no necesita, a cambio de un plugin
   Swift nuevo y un entitlement. Descartado también hacer polling durante
   todo el entreno: gasta batería y llamadas a HealthKit sin que nadie
   mire, y la recuperación ocurre en el descanso.

## Arquitectura

### `src/lib/heartRate.js` (nuevo)

Lógica pura, sin imports nativos — testeable sin mocks, igual que
`adherence.js` o `superset.js`.

- `LIVE_HR_MAX_AGE_MS = 90_000`. Umbral de frescura. Con entreno en el
  Watch las muestras llegan cada ~5s y sin entreno cada 5-10 min, así que
  90s separa los dos casos con margen de sobra para un hueco puntual.
- `pickLiveHeartRate(samples, { now, maxAgeMs })` → `{ bpm, sampledAt }` o
  `null`. Coge la muestra más reciente por `startDate` y devuelve `null` si
  no hay ninguna o si la más nueva supera `maxAgeMs`. No asume que el
  plugin devuelva las muestras ordenadas.

### `src/lib/appleHealth.js` (modificado)

- Añadir `'heartRate'` a `READ_TYPES`. Dispara un diálogo de permiso extra
  la primera vez que se pida autorización tras el cambio.
- `getLiveHeartRate()`: wrapper fino. Devuelve `null` fuera del shell
  nativo, como el resto del módulo. Llama a
  `readSamples({ dataType: 'heartRate', startDate: ahora-2min, endDate: ahora })`
  y pasa el resultado por `pickLiveHeartRate`. La ventana de 2 minutos es
  mayor que el umbral de frescura a propósito: así el filtro de frescura
  vive en un solo sitio (`pickLiveHeartRate`) y la consulta no tiene que
  ser exacta.

### `src/views/ExerciseDetailModal.jsx` (modificado)

- Estado `liveHr` y ref `hrPeakRef`.
- `useEffect` atado a `timerActive`: al arrancar el descanso resetea el
  pico y lanza un `setInterval` de 5 segundos que llama a
  `getLiveHeartRate()`. Cada lectura fresca actualiza el pico si supera al
  guardado. Al parar el descanso o desmontar el modal, limpia el intervalo
  y el estado.
- Render dentro del bloque "Temporizador de Descanso", solo mientras el
  descanso está activo:
  - Dato fresco y hay pico previo distinto del actual: `♥ 145 → 118`.
  - Dato fresco en la primera lectura (aún sin pico): solo el actual.
  - Sin dato fresco: `♥ —` más "Arranca el entreno en el Watch".
  - Fuera del shell nativo: no se pinta nada (el wrapper ya devuelve
    `null`, y en la PWA el bloque no aparece).

## Flujo de datos

Watch con entreno en marcha → HealthKit → `readSamples` cada 5s →
`pickLiveHeartRate` filtra por frescura → estado de React → bloque de
descanso del modal.

**No se persiste nada.** No toca Supabase, no escribe en `workout_logs`, no
añade columnas. El pulso vive solo en memoria durante el descanso y
desaparece al terminarlo.

## Errores

Cualquier fallo — permiso denegado, cero muestras, excepción del plugin —
resuelve a `null` y la UI cae al estado apagado. Mismo criterio que el
resto de `appleHealth.js`: la integración con Health nunca puede romper el
registro del entreno, que es la función principal de la pantalla.

## Tests

`src/lib/heartRate.test.js`, sin mocks por ser módulo puro:

- Lista vacía de muestras → `null`.
- Muestra reciente → `{ bpm, sampledAt }` con el valor correcto.
- Muestra más vieja que el umbral → `null`.
- Varias muestras desordenadas → devuelve la más reciente, no la primera
  del array.
- Muestra justo en el límite del umbral → se define como fresca
  (comparación `<=`), y el test fija ese criterio.

## Fuera de alcance (explícito)

- No alimenta la Live Activity con el pulso. Requeriría el camino nativo en
  background que se descartó arriba.
- No guarda la FC en el log del entreno ni en ninguna tabla.
- No hay umbral de "ya estás recuperado" ni aviso propio. El temporizador
  de descanso ya es dueño de la decisión "arranca la siguiente serie", y
  meter una segunda señal competiría con él; además, el umbral es personal
  y difícil de acertar.

## Simplificación aceptada

Si el permiso de `heartRate` llegara a estar denegado, la UI mostraría el
estado apagado con la pista de arrancar el entreno en el Watch, que en ese
caso es un consejo equivocado. No se construye lógica de permisos para
distinguirlo: el único usuario real ya tiene HealthKit concedido y aceptará
el prompt adicional. Si algún día la app tuviera usuarios que rechazan el
permiso, aquí es donde habría que mirar.

## Trabajo manual asociado

Tras implementar hace falta `npm run build && npx cap sync ios` y recompilar
en Xcode para que el iPhone reciba el cambio. La verificación real necesita
Apple Watch con un entreno arrancado en él, así que no se puede validar en
simulador.
