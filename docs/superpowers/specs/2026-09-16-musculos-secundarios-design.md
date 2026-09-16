# v3 Fase C1 — Músculos secundarios en el catálogo

**Fecha:** 2026-09-16
**Alcance:** primer paso de la Fase C de
[plan-gym-app-features.md](../../plan-gym-app-features.md) ("Taxonomía de
grupo muscular por ejercicio en `exercise_catalog`"). El mapa de
recuperación en sí —cálculo con ventana 48-72h y tarjeta en el Dashboard—
va en un spec aparte (**C2**), porque consume estos datos pero no comparte
ninguna decisión con ellos.

## Punto de partida real

El plan decía que "hoy solo existe mapeo de iconos por nombre de rutina en
`routineUtils.js`". Está desactualizado: **`exercise_catalog.category` ya
existe y está al 101 de 101**, en 8 grupos (Bíceps 15, Abdomen 15, Pecho 14,
Hombro 14, Pierna 14, Tríceps 11, Dorsal 11, Glúteo 7). Ya lo aprovecha el
volumen semanal por grupo (Fase 5).

Lo que falta, y es lo único que construye este spec, es el **músculo
secundario**: hoy un press de banca cuenta solo como Pecho, ignorando que
carga tríceps y hombro. Sin eso, cualquier cálculo de recuperación dirá que
tienes el tríceps fresco el día después de hacer 12 series de empuje.

## Decisiones tomadas (brainstorming, no reabrir)

1. **Se añaden secundarios, etiquetados con IA**, no a mano: 101 ejercicios
   por rellenar es demasiado para hacerlo a dedo, y el criterio
   ("¿el press inclinado carga hombro?") es justo lo que un modelo resuelve
   razonablemente bien.
2. **La IA propone, tú dispones.** Mismo principio que el resto de piezas de
   IA del proyecto: las propuestas se revisan antes de tocar la base de
   datos.
3. **Se entrega como script puntual, no como UI.** Etiquetar el catálogo es
   un trabajo de una sola vez, y el repo ya tiene ese patrón (`scripts/` está
   lleno de scripts de catálogo: `sync_catalog_v2.cjs`,
   `update_catalog_images.js`...). Construir una pantalla de revisión que se
   usa una tarde y se abandona sería trabajo tirado. Lo que sí queda en la
   app es poder editar los secundarios de un ejercicio en la Librería, para
   mantenerlos cuando añadas ejercicios nuevos.
4. **Vocabulario cerrado**: los secundarios salen de la misma lista de 8
   grupos musculares reales que ya usa `category`. Sin músculos nuevos
   ("serrato", "romboides") que luego nadie sabría mapear a nada.

## Modelo de datos

```sql
alter table public.exercise_catalog
    add column secondary_muscles text[] not null default '{}';
```

Array de Postgres, no JSONB: es una lista plana de etiquetas de un
vocabulario cerrado, y `text[]` permite consultarla con operadores de array
sin castings. `default '{}'` (no `null`) para que el código no tenga que
distinguir "sin etiquetar" de "no tiene secundarios" en cada lectura — un
ejercicio aislado como el curl de bíceps legítimamente no tiene ninguno.

**Regla de integridad:** el grupo principal (`category`) nunca aparece en
`secondary_muscles`. Si el modelo lo devuelve, el script lo filtra — si no,
un press de banca sumaría fatiga de pecho dos veces en C2.

RLS: `exercise_catalog` ya tiene sus policies; esta columna no cambia quién
puede leer o escribir la tabla.

## El etiquetado

### Workflow n8n `Gym_App_SecondaryMuscles`

Mismo patrón que los tres que ya existen (webhook → OpenAI con salida
estructurada → responder). Recibe un **lote** de ejercicios, no uno:

```json
{
  "exercises": [
    { "id": 12, "name": "Press de banca", "category": "Pecho" }
  ],
  "vocabulary": ["Pecho", "Dorsal", "Hombro", "Bíceps", "Tríceps", "Pierna", "Glúteo", "Abdomen"]
}
```

Devuelve, para cada id, los secundarios y una línea de motivo:

```json
{
  "results": [
    { "id": 12, "secondary_muscles": ["Tríceps", "Hombro"], "motivo": "El press de banca plano usa tríceps y deltoides anterior como sinergistas." }
  ]
}
```

El prompt exige: solo etiquetas del vocabulario recibido, nunca repetir la
`category` del propio ejercicio, y array vacío cuando el ejercicio es
genuinamente aislado. El `motivo` es para que la revisión humana sea posible
sin tener que ser fisioterapeuta; no se guarda en la base de datos, igual
que el `motivo` de las otras piezas de IA.

### Los dos scripts

- **`scripts/tag_secondary_muscles.mjs`** (propone): lee el catálogo, manda
  los ejercicios en lotes de 20 al webhook, y vuelca
  `scripts/secondary_muscles_proposal.json` con `{id, name, category,
  secondary_muscles, motivo}` por ejercicio. **No escribe en la base de
  datos.** Imprime además una tabla legible por terminal para poder revisar
  de un vistazo.
- **`scripts/apply_secondary_muscles.mjs`** (aplica): lee ese mismo JSON —ya
  revisado y corregido a mano si hace falta— valida cada fila contra el
  vocabulario y contra la regla de "el principal no va en secundarios", y
  hace el `update`. Si una fila no valida, la salta y lo dice; no aplica
  nada a medias sin avisar.

Separarlos es lo que hace que la revisión sea real: entre proponer y
aplicar hay un fichero que se puede leer, editar y versionar.

## Mantenimiento en la app

`TrainerLibraryView.jsx` ya tiene alta y edición inline de ejercicios, con
un selector de grupo (`MUSCLE_GROUPS`). Se añade un selector múltiple de
músculos secundarios en los dos sitios, con el mismo vocabulario y
excluyendo el grupo principal ya elegido. Sin esto, cada ejercicio nuevo
nacería sin secundarios y el mapa de recuperación se iría degradando solo.

## Funciones puras (testeadas)

`src/lib/muscleTaxonomy.js`:

- `MUSCLE_VOCABULARY` — los 8 grupos reales, sin `Cardio` ni `Otros` (que
  están en `MUSCLE_GROUPS` de la Librería pero no son músculos).
- `normalizeSecondaryMuscles(secondary, category)` — filtra al vocabulario,
  quita duplicados, quita la propia `category` y ordena. La usan los dos
  scripts y la Librería, para que la regla viva en un sitio.
- `isValidSecondaryProposal(proposal)` — valida una fila del JSON antes de
  aplicarla (id numérico, category conocida, secundarios del vocabulario).

## Testing

`src/lib/muscleTaxonomy.test.js`: vocabulario correcto; `normalize` quita la
category, quita duplicados, descarta etiquetas inventadas, tolera `null` y
`undefined`, y ordena de forma estable; `isValidSecondaryProposal` acepta una
fila buena y rechaza id no numérico, category desconocida y secundario fuera
de vocabulario.

Los scripts no se testean (puntuales, mismo criterio que el resto de
`scripts/`), pero su lógica de validación vive en las funciones puras, que
sí.

Verificación: correr el script de propuesta contra el catálogo real y
revisar la tabla a ojo antes de aplicar nada. Tras aplicar, comprobar en la
Librería que un ejercicio compuesto conocido (press de banca) tiene
secundarios y uno aislado (curl de bíceps) no.

## Fuera de alcance

- El cálculo de recuperación y su tarjeta (**C2**, spec aparte).
- Intensidad del secundario (un 0.5 fijo, no "0.3 para hombro en press").
  C2 usa un peso único para todos los secundarios.
- Músculos fuera de los 8 grupos actuales.
- Reetiquetar o renombrar las categorías principales existentes.
