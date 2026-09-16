# Edad y objetivo real en las decisiones de IA del entrenador

**Fecha:** 2026-09-16
**Alcance:** los tres workflows de IA del lado entrenador —
`Gym_App_RoutineDraft` (Fase 2.1, borrador de rutina),
`Gym_App_Trainer_Review` (Fase 2.2, revisar rutina ya hecha) y
`Gym_App_ProgressionSuggestion` (Fase 2.3, progresión de ciclo) — para que
razonen de verdad con la edad y el objetivo del cliente al proponer
ejercicios, series, reps, descanso e intensidad.

## Punto de partida real

`profiles.goal` y `profiles.age` ya existen y se rellenan desde
`EditProfileView.jsx`. `goal` ya viaja a los tres workflows como
`clientGoal`; `age` no llega a ninguno.

Pero el problema no era solo que faltara la edad — **el objetivo tampoco se
usa bien hoy.** Revisados los tres prompts reales en n8n: los tres reciben
`clientGoal` como dato interpolado sin más
(`"clientGoal: {{ $json.body.clientGoal }}"`), pero ninguno tiene una
instrucción que le diga a la IA cómo traducir ese valor en decisiones
concretas de reps, descanso o selección de ejercicio. Es literalmente lo
que se pidió ("que tengas presente el objetivo... para adaptar los
ejercicios"), y hoy no pasa — el dato llega, pero no dirige nada.

`goal` es un vocabulario cerrado de 6 valores fijos, definidos en
`EditProfileView.jsx`: `Hipertrofia`, `Pérdida de Peso`, `Fuerza`,
`Resistencia`, `Salud General`, `Mantenimiento`. Esto permite ser concreto
en el prompt sin inventar reglas nuevas para valores que no van a aparecer.

## Decisiones tomadas (brainstorming, no reabrir)

1. **Solo prompts de IA, no taxonomía de catálogo.** Nada de etiquetar los
   101 ejercicios con "apto para mayores" ni similar — eso es un proyecto
   aparte (etiquetado con IA + revisión, como los músculos secundarios) y no
   lo que se pidió. El entrenador sigue viendo y pudiendo elegir cualquier
   ejercicio del catálogo; la IA solo razona mejor al proponer.
2. **El campo `level` no se toca.** Sigue siendo un campo manual que
   escribe el entrenador en el formulario de borrador, sin relación
   automática con la edad del cliente — el entrenador conoce a su cliente
   mejor que cualquier heurística de edad→nivel.
3. **Edad: instrucción genérica, no reglas explícitas por franja.** El
   prompt dice "ten en cuenta la edad... a mayor edad, prioriza salud
   articular y técnica sobre cargas máximas" y deja que la IA decida con su
   propio criterio — igual que ya hace con el objetivo. Nada de "65+: evitar
   saltos, priorizar máquinas" escrito a mano: esas reglas quedan sin
   mantener y quedan mal si algún día cambian.
4. **Objetivo: guía concreta por valor**, porque al ser un vocabulario
   cerrado de 6 valores sí merece la pena ser explícito:
   - **Hipertrofia** → 8-12 repeticiones, descanso 60-90s, sesgo neutro
     compuesto/aislamiento.
   - **Fuerza** → 3-6 repeticiones, descanso 2-4 min, sesgo fuerte hacia
     ejercicios compuestos.
   - **Resistencia** → 15+ repeticiones, descanso 30-45s.
   - **Pérdida de Peso** → volumen alto, descansos cortos.
   - **Salud General / Mantenimiento** → técnica y consistencia por encima
     de la intensidad máxima.

## Arquitectura

### Frontend — un campo nuevo en tres sitios que ya envían `clientGoal`

`client.age` (ya disponible en el objeto `client` que reciben
`ClientProfileView.jsx` y `RoutineAssignerView.jsx`, viene de `profiles`)
se añade junto a `client.goal` en las tres llamadas existentes:

- `src/lib/trainerUtils.js` — `buildProgressionSuggestionPayload` gana el
  parámetro `clientAge`, con el mismo patrón de default que ya usa para
  `category`/`clientGoal` (`clientAge ?? null`, no un string "No
  especificado": la IA ya sabe leer un `null` de edad, y forzar un string
  la trataría como un dato real en vez de ausente).
- `src/lib/trainerUtils.js` — `buildRoutineDraftPayload` gana el parámetro
  `clientAge`, mismo patrón.
- `src/components/trainer/RoutineReviewModal.jsx` — gana la prop
  `clientAge`, pasada al payload de revisión junto a `clientGoal`.

Los tres call sites (`ClientProfileView.jsx:461` para progresión,
`RoutineAssignerView.jsx` para borrador y revisión) pasan `client.age`
exactamente igual que ya pasan `client.goal`. Sin query nueva: el dato ya
viaja en el mismo objeto `client`.

### n8n — actualizar los tres prompts existentes, no crear workflows nuevos

**`Gym_App_RoutineDraft`** — el nodo `Generar Borrador de Rutina (LLM)`
recibe un campo más (`clientAge`) y su `SystemMessagePromptTemplate` gana
las dos piezas de guía (objetivo→prescripción, edad→criterio genérico)
citadas arriba.

**`Gym_App_Trainer_Review`** — el nodo `Variables Entrada` (Set) gana la
asignación `clientAge`, y el prompt del `AI Agent` (que hoy solo usa
`clientGoal` para evaluar equilibrio de patrones de movimiento) incorpora
la guía de objetivo y edad al criterio de revisión — ej. si el cliente es
mayor y la rutina mete sentadilla libre pesada sin ningún ejercicio de
movilidad previo, es exactamente el tipo de hueco que esta pieza debería
señalar y hoy no puede, porque no sabe la edad.

**`Gym_App_ProgressionSuggestion`** — el nodo `Generate Progression` (system
prompt inline) gana `clientAge` en la lista de campos recibidos y la misma
guía de edad; el objetivo ya se menciona ahí para el caso sin historial,
pasa a tener la tabla concreta de reps/descanso en vez de solo nombrarse.

## Testing

Funciones puras en `src/lib/trainerUtils.test.js` (extendiendo los tests ya
existentes de `buildProgressionSuggestionPayload` y
`buildRoutineDraftPayload`, no reescribiéndolos):

- `buildProgressionSuggestionPayload` incluye `clientAge` cuando se pasa.
- `buildProgressionSuggestionPayload` manda `clientAge: null` cuando no se
  pasa (no un string placeholder).
- Mismos dos casos para `buildRoutineDraftPayload`.

Sin test para `RoutineReviewModal.jsx` (componente de fetch/UI, mismo
criterio que el resto de piezas de IA del proyecto — no tiene test
dedicado hoy).

**Verificación de los prompts**: llamada directa a cada webhook (vía
`curl`, como se hizo con `Gym_App_SecondaryMuscles`) con dos variantes del
mismo caso — un cliente de 25 años objetivo Fuerza y uno de 68 años mismo
objetivo — y comprobar a ojo que la salida (reps/series/motivo) refleja la
diferencia. No hay forma de testear automáticamente la calidad de un
prompt; esto es inspección manual, igual que se hizo al ajustar el prompt
de músculos secundarios cuando salió mal la primera vez.

## Fuera de alcance

- Taxonomía de idoneidad/riesgo en `exercise_catalog` (mapa corporal de
  seguridad, no de recuperación).
- Reglas explícitas por franja de edad escritas a mano.
- Derivar `level` automáticamente de la edad.
- Cualquier bloqueo o filtrado de ejercicios — la IA sigue solo proponiendo,
  el entrenador sigue viendo y pudiendo elegir cualquier ejercicio del
  catálogo, principio ya establecido en el resto de la Fase 2.
