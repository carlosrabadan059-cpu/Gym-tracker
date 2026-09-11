# Revisar rutina con IA (Fase 2.2) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** El entrenador pulsa "Revisar con IA" sobre una rutina (nueva sin guardar, o ya asignada) y ve un análisis en texto de agujeros de patrón de movimiento / volumen / orden, sin que la IA modifique nada.

**Architecture:** Clasificación de patrón (empuje/tirón/pierna/core) por `exercise_catalog.category` ya existente + heurística de nombre solo para compuesto/aislamiento, calculada en el cliente. Se manda como contexto estructurado a un webhook nuevo de n8n (`Gym_App_Trainer_Review`, workflow independiente del chat) que devuelve el análisis en markdown. Se muestra en un modal reutilizando el renderer markdown ya existente en `ChatView.jsx`.

**Tech Stack:** React 19, Vite, Supabase JS client, n8n (vía MCP `n8n-mcp`), fetch nativo.

**Nota sobre tests:** este repo no tiene test runner configurado (`npm run lint` es la única verificación automática). Los pasos de verificación de lógica pura usan scripts Node de un solo uso (`node --input-type=module`), no un framework de test — no crear `*.test.js` nuevos, no encaja con el resto del repo.

---

## Task 1: `exerciseClassifier.js` — clasificación de patrón y compuesto/aislamiento

**Files:**
- Create: `src/lib/exerciseClassifier.js`

- [ ] **Step 1: Escribir el módulo**

```javascript
// src/lib/exerciseClassifier.js

// exercise_catalog.category ya es el grupo muscular (ver TrainerLibraryView.jsx
// MUSCLE_GROUPS). Este mapa solo traduce grupo muscular a patrón de
// movimiento para detectar huecos tipo "6 empuje, 0 tirón".
export const PATTERN_BY_CATEGORY = {
    'Pecho': 'empuje',
    'Hombro': 'empuje',
    'Tríceps': 'empuje',
    'Dorsal': 'tiron',
    'Bíceps': 'tiron',
    'Pierna': 'pierna',
    'Glúteo': 'pierna',
    'Abdomen': 'core',
    'Cardio': 'core',
};

export function patternForCategory(category) {
    return PATTERN_BY_CATEGORY[category] || 'otro';
}

// Heurística de nombre, solo para compuesto vs. aislamiento dentro de una
// misma categoría (ej. "Press banca" compuesto vs. "Aperturas" aislamiento,
// ambos Pecho). Limitación conocida: un nombre atípico puede clasificarse
// mal — no bloquea el resto del análisis, solo distorsiona ese aviso.
const ISOLATION_KEYWORDS = [
    'curl', 'extension', 'extensión', 'elevacion', 'elevación',
    'aductor', 'abductor', 'cruce', 'vuelo', 'contraccion', 'contracción',
    'patada', 'encogimiento',
];

export function isCompound(exerciseName) {
    const lower = String(exerciseName || '').toLowerCase();
    return !ISOLATION_KEYWORDS.some(function checkKeyword(keyword) {
        return lower.includes(keyword);
    });
}

// exercises: [{ name, category, series, reps }] en orden real (ui_order)
export function buildRoutineBreakdown(exercises) {
    const patternCounts = { empuje: 0, tiron: 0, pierna: 0, core: 0, otro: 0 };
    const items = [];

    for (const ex of exercises) {
        const pattern = patternForCategory(ex.category);
        const compound = isCompound(ex.name);
        patternCounts[pattern] = (patternCounts[pattern] || 0) + 1;
        items.push({
            name: ex.name,
            category: ex.category || 'Otros',
            pattern,
            compound,
            series: ex.series,
            reps: ex.reps,
        });
    }

    let orderBroken = false;
    let sawIsolation = false;
    for (const item of items) {
        if (!item.compound) {
            sawIsolation = true;
        } else if (sawIsolation) {
            orderBroken = true;
            break;
        }
    }

    return {
        items,
        patternCounts,
        legVolume: patternCounts.pierna,
        torsoVolume: patternCounts.empuje + patternCounts.tiron,
        orderBroken,
    };
}
```

- [ ] **Step 2: Verificar con un script Node de un solo uso**

Crear temporalmente `/tmp/verify-classifier.mjs`:

```javascript
import { patternForCategory, isCompound, buildRoutineBreakdown } from '/Volumes/SSD Externo/Proyectos/Antigravity/Gym-tracker/src/lib/exerciseClassifier.js';

console.assert(patternForCategory('Pecho') === 'empuje', 'Pecho debe ser empuje');
console.assert(patternForCategory('Dorsal') === 'tiron', 'Dorsal debe ser tiron');
console.assert(patternForCategory('Pierna') === 'pierna', 'Pierna debe ser pierna');
console.assert(patternForCategory('Grupo raro') === 'otro', 'Categoría desconocida cae en otro');

console.assert(isCompound('Press banca') === true, 'Press banca es compuesto');
console.assert(isCompound('Curl de bíceps') === false, 'Curl es aislamiento');
console.assert(isCompound('Extensión de cuádriceps') === false, 'Extensión es aislamiento');

const breakdown = buildRoutineBreakdown([
    { name: 'Press banca', category: 'Pecho', series: 4, reps: 10 },
    { name: 'Aperturas', category: 'Pecho', series: 3, reps: 12 },
    { name: 'Sentadilla', category: 'Pierna', series: 4, reps: 8 },
]);
console.assert(breakdown.patternCounts.empuje === 2, 'dos ejercicios de empuje');
console.assert(breakdown.patternCounts.pierna === 1, 'un ejercicio de pierna');
console.assert(breakdown.orderBroken === false, 'orden correcto: compuesto, aislamiento, compuesto (pierna) — solo rompe si aparece un compuesto DESPUÉS de un aislamiento ya visto');

const brokenOrder = buildRoutineBreakdown([
    { name: 'Aperturas', category: 'Pecho', series: 3, reps: 12 },
    { name: 'Press banca', category: 'Pecho', series: 4, reps: 10 },
]);
console.assert(brokenOrder.orderBroken === true, 'aislamiento antes que compuesto debe marcar orderBroken');

console.log('OK — todas las aserciones pasaron');
```

Run: `node /tmp/verify-classifier.mjs`
Expected: `OK — todas las aserciones pasaron` (si algún `console.assert` falla, imprime `Assertion failed: <mensaje>` a stderr — corregir `exerciseClassifier.js` hasta que no aparezca ninguno).

- [ ] **Step 3: Borrar el script temporal**

Run: `rm /tmp/verify-classifier.mjs`

- [ ] **Step 4: Commit**

```bash
git add src/lib/exerciseClassifier.js
git commit -m "$(cat <<'EOF'
feat(entrenador): clasificador de patrón de movimiento para revisión IA

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

## Task 2: Extraer `BotMarkdown` a componente compartido

**Files:**
- Create: `src/components/ui/BotMarkdown.jsx`
- Modify: `src/views/ChatView.jsx:1-107`

- [ ] **Step 1: Crear el componente compartido**

Contenido exacto de `src/components/ui/BotMarkdown.jsx` (movido tal cual desde `ChatView.jsx`, líneas 15-107 actuales — `SECTION_PALETTES`, `renderInline`, `BotMarkdown` — sin cambios de lógica):

```jsx
import React from 'react';

// Paleta de colores para secciones h2, cíclica
const SECTION_PALETTES = [
    { bg: 'bg-blue-500/10',   border: 'border-blue-500/30',   icon: 'text-blue-400',   dot: 'bg-blue-400'   },
    { bg: 'bg-primary/10',    border: 'border-primary/30',    icon: 'text-primary',    dot: 'bg-primary'    },
    { bg: 'bg-purple-500/10', border: 'border-purple-500/30', icon: 'text-purple-400', dot: 'bg-purple-400' },
    { bg: 'bg-orange-500/10', border: 'border-orange-500/30', icon: 'text-orange-400', dot: 'bg-orange-400' },
    { bg: 'bg-green-500/10',  border: 'border-green-500/30',  icon: 'text-green-400',  dot: 'bg-green-400'  },
];

// Renderiza texto inline: **bold** y `code`
function renderInline(text) {
    const parts = String(text).split(/(\*\*[^*]+\*\*|`[^`]+`)/g);
    return parts.map((part, i) => {
        if (part.startsWith('**') && part.endsWith('**'))
            return <strong key={i} className="font-bold text-text-primary">{part.slice(2, -2)}</strong>;
        if (part.startsWith('`') && part.endsWith('`'))
            return <code key={i} className="bg-background px-1.5 py-0.5 rounded text-primary text-xs font-mono border border-surface-highlight">{part.slice(1, -1)}</code>;
        return part;
    });
}

// Renderizador Markdown ligero sin dependencias externas
export function BotMarkdown({ text }) {
    const lines = String(text || '').split('\n');
    const elements = [];
    let listItems = [];
    let paletteIdx = 0;

    const flushList = () => {
        if (!listItems.length) return;
        elements.push(
            <ul key={`ul-${elements.length}`} className="space-y-1.5 my-2">
                {listItems.map((item, i) => (
                    <li key={i} className="flex items-start gap-2.5 bg-background/60 rounded-xl px-3 py-2 border border-surface-highlight/50">
                        <span className="flex-shrink-0 w-5 h-5 rounded-full bg-primary/20 flex items-center justify-center mt-0.5">
                            <span className="w-1.5 h-1.5 rounded-full bg-primary block" />
                        </span>
                        <span className="text-sm text-text-primary leading-relaxed">{renderInline(item)}</span>
                    </li>
                ))}
            </ul>
        );
        listItems = [];
    };

    lines.forEach((line, i) => {
        // H2
        if (/^## /.test(line)) {
            flushList();
            const p = SECTION_PALETTES[paletteIdx++ % SECTION_PALETTES.length];
            elements.push(
                <div key={i} className={`flex items-center gap-2 px-3 py-2 rounded-xl ${p.bg} border ${p.border} mt-3 mb-2`}>
                    <div className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${p.dot}`} />
                    <span className={`text-sm font-bold ${p.icon}`}>{line.slice(3)}</span>
                </div>
            );
        // H3
        } else if (/^### /.test(line)) {
            flushList();
            elements.push(
                <p key={i} className="text-xs font-bold text-text-secondary uppercase tracking-wider mt-3 mb-1">{line.slice(4)}</p>
            );
        // Blockquote
        } else if (/^> /.test(line)) {
            flushList();
            elements.push(
                <div key={i} className="flex gap-3 bg-amber-400 border border-amber-500 rounded-xl px-3 py-2.5 my-2">
                    <span className="text-base flex-shrink-0">💡</span>
                    <p className="text-sm text-gray-900 font-medium leading-relaxed">{renderInline(line.slice(2))}</p>
                </div>
            );
        // HR
        } else if (/^---/.test(line)) {
            flushList();
            elements.push(<div key={i} className="border-t border-surface-highlight my-3" />);
        // List item
        } else if (/^[-*] /.test(line)) {
            listItems.push(line.slice(2));
        // Empty line
        } else if (!line.trim()) {
            flushList();
        // Paragraph
        } else {
            flushList();
            elements.push(
                <p key={i} className="text-sm leading-relaxed mb-2 text-text-primary">{renderInline(line)}</p>
            );
        }
    });

    flushList();
    return <div className="space-y-0.5">{elements}</div>;
}
```

- [ ] **Step 2: Quitar el código movido de `ChatView.jsx` e importar el componente**

En `src/views/ChatView.jsx`, borrar las líneas 15-107 (bloque `SECTION_PALETTES`, `renderInline`, `BotMarkdown` — desde el comentario `// Paleta de colores...` hasta el `}` que cierra `BotMarkdown`).

Añadir el import junto a los existentes (línea 3-6):

```javascript
import { BotMarkdown } from '../components/ui/BotMarkdown';
```

El resto de `ChatView.jsx` ya usa `<BotMarkdown text={...} />` (en `MessageBubble`, más abajo en el archivo) — no requiere más cambios porque el nombre y la prop son idénticos.

- [ ] **Step 3: Verificar que sigue arrancando**

Run: `npm run lint`
Expected: sin errores nuevos (si aparece `'BotMarkdown' is defined but never used` o `no-unused-vars` sobre `SECTION_PALETTES`/`renderInline` en `ChatView.jsx`, es que el Step 2 dejó restos — revisar que el bloque completo se borró).

- [ ] **Step 4: Commit**

```bash
git add src/components/ui/BotMarkdown.jsx src/views/ChatView.jsx
git commit -m "$(cat <<'EOF'
refactor(chat): extraer BotMarkdown a componente compartido

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

## Task 3: Workflow n8n `Gym_App_Trainer_Review`

**Files:** ninguno en el repo — se crea directamente en la instancia n8n vía MCP (`n8n-mcp`).

Contexto ya confirmado (workflow `Gym_App_Chat`, id `Qd4poLUHGy5LdDse`, en n8n.rabadanhouse.space): credencial OpenAI existente `HeNfhfUfwAHOImZn` ("OpenAI Carlos"), modelo `gpt-4.1-mini`, patrón `Webhook → Set → AI Agent → Respond to Webhook`.

- [ ] **Step 1: Cargar la referencia del SDK y las buenas prácticas**

Llamar `get_workflow_sdk_reference` (sin `section`, referencia completa) y `get_workflow_best_practices` con `technique="webhook"` y `technique="AI agent"` (si `list` no incluye una de las dos, usar la más cercana). Leer antes de escribir código — el SDK es un subconjunto restringido de TypeScript (sin arrow functions, sin loops, sin try/catch — confirmar reglas exactas en la referencia obtenida).

- [ ] **Step 2: Verificar la credencial OpenAI**

Llamar `list_credentials` y confirmar que existe una credencial OpenAI utilizable (por nombre "OpenAI Carlos" o equivalente). Si el id cambió respecto a `HeNfhfUfwAHOImZn`, usar el id devuelto por `list_credentials`.

- [ ] **Step 3: Resolver los node types exactos**

Llamar `search_nodes` con las queries `["webhook", "set", "AI Agent", "respond to webhook", "OpenAI chat model"]` y luego `get_node_types` con los node type ids encontrados (equivalentes a los ya usados en `Gym_App_Chat`: `n8n-nodes-base.webhook`, `n8n-nodes-base.set`, `@n8n/n8n-nodes-langchain.agent`, `n8n-nodes-base.respondToWebhook`, `@n8n/n8n-nodes-langchain.lmChatOpenAi`) para confirmar los parámetros exactos aceptados por la versión instalada.

- [ ] **Step 4: Escribir el código del workflow con el SDK**

Estructura exacta a construir (4 nodos, sin nodo de memoria — cada revisión es una llamada de una sola vez, no hay conversación):

1. **Webhook** — `httpMethod: "POST"`, `path: "TrainerReview"`, `responseMode: "responseNode"`.
2. **Set "Variables Entrada"** — vuelca el body a variables planas:
   - `routineName` = `{{ $json.body.routineName || '' }}`
   - `clientGoal` = `{{ $json.body.clientGoal || 'No especificado' }}`
   - `exercisesSummary` = `{{ $json.body.exercisesSummary || '' }}` (string ya formateado por la app, ver Task 4 — el workflow no reconstruye la lista, solo la reenvía dentro del prompt)
3. **AI Agent** — modelo conectado: `OpenAI Chat Model` (`gpt-4.1-mini`, credencial de Step 2). `promptType: "define"`, prompt (texto exacto, usar `expr()` para interpolar las tres variables del Set):

```
# ROLE
Actúa como un Senior Fitness Coach revisando el trabajo de otro entrenador, no hablando con el cliente final. Tono directo, profesional, entre colegas.

# CONTEXT
Vas a revisar una rutina de gimnasio ya construida por un entrenador para su cliente. Te doy el objetivo del cliente y la rutina completa con, por cada ejercicio: grupo muscular, patrón de movimiento (empuje/tirón/pierna/core/otro) y si es compuesto o aislamiento, en el orden real en que están.

Objetivo del cliente: {{clientGoal}}

Rutina "{{routineName}}":
{{exercisesSummary}}

# TAREA
Señala agujeros concretos: patrones de movimiento ausentes o desequilibrados (ej. mucho empuje y nada de tirón), volumen de pierna muy por debajo del de torso, aislamiento colocado antes que ejercicios compuestos. Para cada punto que señales, explica el porqué en una frase. Si la rutina está bien construida, dilo también — no inventes problemas que no existen.

# RESTRICTIONS
No propongas una rutina nueva ni sustituyas ejercicios — solo señala el hueco. No menciones esteroides ni sustancias prohibidas.

# FORMATO (OBLIGATORIO)
Markdown: párrafo inicial breve, `##` para separar tipos de hueco si hay varios, `-` para puntos concretos, `**negrita**` para lo importante, `> texto` para el aviso más importante si lo hay. Máximo 250 palabras.
```

4. **Respond to Webhook** — responde con `{ ok: true, answer: {{ $json.output }} }` (mismo patrón que `Variables Salida` de `Gym_App_Chat`, sin `sessionID` porque no hay memoria de conversación).

- [ ] **Step 5: Validar el workflow**

Llamar `validate_workflow` sobre el código generado. Si hay errores, corregir siguiendo `n8n-validation-expert` (skill ya disponible) y repetir hasta que valide limpio.

- [ ] **Step 6: Crear el workflow**

Llamar `create_workflow_from_code` con:
- `name`: `"Gym_App_Trainer_Review"`
- `versionName`: `"Versión inicial"`
- `description`: `"Revisión de rutina por IA para el entrenador (Fase 2.2) — analiza patrón de movimiento, volumen y orden, sin generar ni modificar ejercicios."`
- sin `projectId`/`folderId` (mismo proyecto personal donde vive `Gym_App_Chat` — confirmar con `search_workflows` que ambos quedan en el mismo `parentFolderId`, `mFYxumQoAzC950ee`, si el creador lo soporta; si no, dejarlo en la raíz y decírselo al usuario).

- [ ] **Step 7: Activar el workflow y anotar la URL**

El workflow debe quedar `active: true` para que el webhook responda en producción (`https://n8n.rabadanhouse.space/webhook/TrainerReview`). Confirmar con `get_workflow_details` que `active` es `true`; si no, activarlo.

- [ ] **Step 8: Probar el webhook end-to-end**

Ejecutar una llamada de prueba (vía `execute_workflow` con `triggerNodeName: "Webhook"` e `inputs.webhookData.body` con datos de ejemplo, o un `curl` directo a la URL de test) con:

```json
{
  "routineName": "Día 1 - Pecho y Tríceps",
  "clientGoal": "Hipertrofia",
  "exercisesSummary": "1. Press banca (Pecho, empuje, compuesto) 4x10\n2. Aperturas (Pecho, empuje, aislamiento) 3x12\n3. Press militar (Hombro, empuje, compuesto) 3x10"
}
```

Expected: respuesta JSON con `ok: true` y `answer` conteniendo markdown que señale la ausencia de tirón/pierna en ese día.

- [ ] **Step 9: Informar al usuario dónde quedó el workflow**

Decir explícitamente en qué proyecto/carpeta de n8n quedó creado (campo `targetProject`/`targetFolder` de la respuesta de `create_workflow_from_code`) y la URL final del webhook — esa URL es la que hace falta para `VITE_N8N_TRAINER_REVIEW_WEBHOOK_URL` en Task 4.

(Sin commit — este task no toca el repo.)

---

## Task 4: `RoutineReviewModal` — llamada al webhook y UI de resultado

**Files:**
- Create: `src/components/trainer/RoutineReviewModal.jsx`
- Modify: `.env.example`

- [ ] **Step 1: Añadir la variable de entorno de ejemplo**

En `.env.example`, añadir tras las líneas existentes:

```
VITE_N8N_TRAINER_REVIEW_WEBHOOK_URL=https://n8n.rabadanhouse.space/webhook/TrainerReview
```

- [ ] **Step 2: Crear el modal**

```jsx
// src/components/trainer/RoutineReviewModal.jsx
import { useEffect, useState } from 'react';
import { X, Sparkles, Loader2 } from 'lucide-react';
import { BotMarkdown } from '../ui/BotMarkdown';
import { buildRoutineBreakdown } from '../../lib/exerciseClassifier';

const PATTERN_LABELS = {
    empuje: 'empuje',
    tiron: 'tirón',
    pierna: 'pierna',
    core: 'core',
    otro: 'otro',
};

function formatExercisesSummary(items) {
    const lines = items.map(function formatLine(item, index) {
        const tipo = item.compound ? 'compuesto' : 'aislamiento';
        const patternLabel = PATTERN_LABELS[item.pattern] || item.pattern;
        return (index + 1) + '. ' + item.name + ' (' + item.category + ', ' + patternLabel + ', ' + tipo + ') ' + item.series + 'x' + item.reps;
    });
    return lines.join('\n');
}

// exercises: [{ name, category, series, reps }] en el orden real de la rutina
// routineName: string
// clientGoal: string | undefined
export function RoutineReviewModal({ exercises, routineName, clientGoal, onClose }) {
    const [status, setStatus] = useState('loading'); // 'loading' | 'done' | 'error'
    const [answer, setAnswer] = useState('');

    useEffect(() => {
        let cancelled = false;

        const run = async () => {
            const webhookUrl = import.meta.env.VITE_N8N_TRAINER_REVIEW_WEBHOOK_URL;
            if (!webhookUrl) {
                if (!cancelled) {
                    setStatus('error');
                    setAnswer('Falta configurar VITE_N8N_TRAINER_REVIEW_WEBHOOK_URL.');
                }
                return;
            }

            const breakdown = buildRoutineBreakdown(exercises);
            const exercisesSummary = formatExercisesSummary(breakdown.items);

            try {
                const controller = new AbortController();
                const timer = setTimeout(() => controller.abort(), 30000);
                const response = await fetch(webhookUrl, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        routineName: routineName || 'Rutina sin nombre',
                        clientGoal: clientGoal || 'No especificado',
                        exercisesSummary,
                    }),
                    signal: controller.signal,
                });
                clearTimeout(timer);

                if (!response.ok) throw new Error('Respuesta HTTP ' + response.status);
                const data = await response.json();
                if (cancelled) return;
                setAnswer(data.answer || 'Sin respuesta de la IA.');
                setStatus('done');
            } catch (err) {
                if (cancelled) return;
                console.error('Error revisando rutina con IA:', err);
                setStatus('error');
                setAnswer('No se pudo completar la revisión. Inténtalo de nuevo.');
            }
        };

        run();
        return () => { cancelled = true; };
    }, [exercises, routineName, clientGoal]);

    return (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60" onClick={onClose}>
            <div
                className="w-full max-w-lg max-h-[80vh] overflow-y-auto bg-surface rounded-t-3xl p-6 pb-10 space-y-4"
                onClick={(e) => e.stopPropagation()}
            >
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <Sparkles size={18} className="text-primary" />
                        <h3 className="text-lg font-bold text-text-primary">Revisión con IA</h3>
                    </div>
                    <button onClick={onClose} className="p-2 rounded-full hover:bg-surface-highlight transition-colors">
                        <X size={18} className="text-text-secondary" />
                    </button>
                </div>

                {status === 'loading' && (
                    <div className="flex items-center gap-2 text-text-secondary py-8 justify-center">
                        <Loader2 size={18} className="animate-spin" />
                        <span className="text-sm">Analizando la rutina...</span>
                    </div>
                )}

                {status !== 'loading' && <BotMarkdown text={answer} />}

                <button
                    onClick={onClose}
                    className="w-full bg-surface-highlight text-text-primary font-bold px-4 py-2.5 rounded-xl text-sm hover:bg-gray-600 transition-colors"
                >
                    Cerrar
                </button>
            </div>
        </div>
    );
}
```

- [ ] **Step 3: Verificar lint**

Run: `npm run lint`
Expected: sin errores en el archivo nuevo.

- [ ] **Step 4: Commit**

```bash
git add src/components/trainer/RoutineReviewModal.jsx .env.example
git commit -m "$(cat <<'EOF'
feat(entrenador): modal de revisión de rutina con IA

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

## Task 5: Botón "Revisar con IA" en `RoutineAssignerView` (modo `'new'`)

**Files:**
- Modify: `src/views/trainer/RoutineAssignerView.jsx`

- [ ] **Step 1: Importar el modal y añadir estado**

Junto a los imports existentes (línea 6):

```javascript
import { RoutineReviewModal } from '../../components/trainer/RoutineReviewModal';
```

Junto a `const [saveError, setSaveError] = useState(null);` (dentro de `RoutineAssignerView`, ~línea 436):

```javascript
const [showReview, setShowReview] = useState(false);
```

- [ ] **Step 2: Añadir el botón en el header, junto a "Guardar"**

En el bloque del header (alrededor de la línea 601-609, dentro de `{mode === 'new' && (...)}`), añadir el botón antes del de Guardar:

```jsx
{mode === 'new' && (
    <>
        <button
            onClick={() => setShowReview(true)}
            disabled={selectedExercises.length === 0}
            className="border border-primary text-primary font-bold px-3 py-2 rounded-xl text-sm disabled:opacity-40 disabled:cursor-not-allowed hover:bg-primary/10 transition-colors flex-shrink-0"
        >
            Revisar con IA
        </button>
        <button
            onClick={handleSave}
            disabled={!canSave || saving}
            className="bg-primary text-black font-bold px-4 py-2 rounded-xl text-sm disabled:opacity-40 disabled:cursor-not-allowed hover:bg-primary-hover transition-colors flex-shrink-0"
        >
            {saving ? 'Guardando...' : 'Guardar'}
        </button>
    </>
)}
```

(Esto reemplaza el `<button onClick={handleSave}...>` suelto que estaba directamente dentro de `{mode === 'new' && (...)}`, envolviendo ambos botones en un fragment `<>...</>`.)

- [ ] **Step 3: Renderizar el modal condicionalmente**

Justo antes del `</div>` de cierre del componente `RoutineAssignerView` (al final del JSX que retorna, tras el resto de contenido existente):

```jsx
{showReview && (
    <RoutineReviewModal
        exercises={selectedExercises.map((ex) => ({
            name: ex.name,
            category: catalog.find((c) => c.id === ex.catalog_id)?.category,
            series: ex.series,
            reps: ex.reps,
        }))}
        routineName={routineName}
        clientGoal={client?.goal}
        onClose={() => setShowReview(false)}
    />
)}
```

- [ ] **Step 4: Probar en el navegador (skill `run-rutinex`)**

Arrancar la app, entrar como entrenador, ir a un cliente → Asignar rutina → "Crear nueva", añadir 2-3 ejercicios del mismo grupo muscular, pulsar "Revisar con IA". Verificar: aparece el modal, loading, y luego el texto markdown con el hueco señalado. Capturar pantalla del resultado. No pulsar "Guardar" ni "Asignar" sobre la cuenta de Carlos si se prueba con su cliente real — usar el cliente de prueba de `admin@gymtracker.com` si aplica.

- [ ] **Step 5: Commit**

```bash
git add src/views/trainer/RoutineAssignerView.jsx
git commit -m "$(cat <<'EOF'
feat(entrenador): botón Revisar con IA al construir rutina nueva

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

## Task 6: Botón "Revisar con IA" en `ClientProfileView` (rutina ya asignada)

**Files:**
- Modify: `src/views/trainer/ClientProfileView.jsx`
- Modify: `src/lib/utils.js:26-41`

- [ ] **Step 1: Importar el modal y añadir estado**

Junto a los imports existentes (línea 7-8):

```javascript
import { RoutineReviewModal } from '../../components/trainer/RoutineReviewModal';
```

Junto a `const [addingToAssignment, setAddingToAssignment] = useState(null);` (~línea 43):

```javascript
const [reviewingAssignmentId, setReviewingAssignmentId] = useState(null);
```

- [ ] **Step 2: Incluir `category` en la query de ejercicios y en `enrichExercisesWithCatalog`**

`enrichExercisesWithCatalog` (`src/lib/utils.js:26-41`) usa una allowlist explícita (`name`, `image_url`, `instructions`) y descarta el resto de `exercise_catalog` — hay que añadir `category` a esa allowlist. Es un cambio aditivo: los demás consumidores de esta función (`DashboardView.jsx`, `StatisticsView.jsx`, `ChatView.jsx`, `WorkoutDetailPanel.jsx`) simplemente ganan un campo `category` que hoy no piden ni usan.

En `src/lib/utils.js`, cambiar:

```javascript
        return {
            ...exerciseWithoutCatalog,
            name: catalogData.name || exercise.name,
            image_url: catalogData.image_url || exercise.image_url,
            instructions: catalogData.instructions || exercise.instructions,
        };
```

a:

```javascript
        return {
            ...exerciseWithoutCatalog,
            name: catalogData.name || exercise.name,
            image_url: catalogData.image_url || exercise.image_url,
            instructions: catalogData.instructions || exercise.instructions,
            category: catalogData.category || exercise.category,
        };
```

En `ClientProfileView.jsx`, en el `fetchRoutines` (línea ~68), cambiar el select de ejercicios de:

```javascript
supabase.from('exercises').select('*, exercise_catalog(name, image_url, instructions)').in('routine_id', routineIds).order('ui_order'),
```

a:

```javascript
supabase.from('exercises').select('*, exercise_catalog(name, image_url, instructions, category)').in('routine_id', routineIds).order('ui_order'),
```

- [ ] **Step 3: Añadir el botón junto a Pencil/Trash2**

En el bloque de botones de cada rutina (línea 434-464), añadir un botón antes del de editar nombre:

```jsx
<div className="flex items-center gap-1" onClick={e => e.stopPropagation()}>
    <button
        onClick={() => setReviewingAssignmentId(assignment.id)}
        className="p-1.5 text-text-secondary hover:text-primary hover:bg-primary/10 rounded-full transition-colors"
        title="Revisar con IA"
    >
        <Sparkles size={15} />
    </button>
    <button
        onClick={() => { setEditingRoutineNameId(assignment.id); setEditingRoutineNameValue(routine.name); }}
        className="p-1.5 text-text-secondary hover:text-primary hover:bg-primary/10 rounded-full transition-colors"
    >
        <Pencil size={15} />
    </button>
    {/* resto del bloque (confirmDeleteId / Trash2 / ChevronRight) sin cambios */}
```

Añadir `Sparkles` al import de `lucide-react` (línea 6):

```javascript
import { ArrowLeft, PlusCircle, Activity, Dumbbell, ChevronRight, ChevronUp, ChevronDown, Trash2, Calendar, Clock, Edit2, Check, X, Minus, Plus, Pencil, Sparkles } from 'lucide-react';
```

- [ ] **Step 4: Renderizar el modal para la rutina en revisión**

Tras el `.map((assignment) => {...})` que renderiza la lista de rutinas (fuera del `.map`, junto a otros modales condicionales del componente — buscar dónde se renderiza `editingExercise` o `selectedHistoryEntry` como referencia de patrón), añadir:

```jsx
{reviewingAssignmentId && (() => {
    const assignment = assignedRoutines.find((a) => a.id === reviewingAssignmentId);
    if (!assignment) return null;
    return (
        <RoutineReviewModal
            exercises={assignment.routine.exercises.map((ex) => ({
                name: ex.name,
                category: ex.category,
                series: ex.series,
                reps: ex.reps,
            }))}
            routineName={assignment.routine.name}
            clientGoal={client?.goal}
            onClose={() => setReviewingAssignmentId(null)}
        />
    );
})()}
```

- [ ] **Step 5: Probar en el navegador (skill `run-rutinex`)**

Arrancar la app, entrar como entrenador, abrir el perfil de un cliente con al menos una rutina asignada, pulsar el icono ✨ en una rutina. Verificar modal + resultado. Si el cliente de prueba es Carlos: solo navegar y pulsar "Revisar con IA" (es lectura, no modifica `workout_logs` ni `exercises`) — no tocar Guardar/Asignar/Terminar sobre su cuenta.

- [ ] **Step 6: Commit**

```bash
git add src/views/trainer/ClientProfileView.jsx src/lib/utils.js
git commit -m "$(cat <<'EOF'
feat(entrenador): botón Revisar con IA sobre rutina ya asignada

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

## Self-review

**Cobertura del spec:**
- Clasificación por `category` sin migración → Task 1. ✓
- Workflow n8n nuevo e independiente → Task 3. ✓
- `BotMarkdown` extraído y reusado → Task 2, consumido en Task 4. ✓
- Botón en `RoutineAssignerView` modo new → Task 5. ✓
- Botón en `ClientProfileView` → Task 6. ✓
- Fuera de alcance (no editar rutina, no RPE/RIR, no tocar `Gym_App_Chat` salvo extracción) → respetado en todos los tasks. ✓
- Limitación conocida de `isCompound` → documentada en Task 1 y en el spec. ✓

**Placeholders:** ninguno — cada step tiene código completo o comando exacto. Task 3 (n8n) no fija literalmente el código SDK final porque el propio protocolo de `n8n-mcp` exige llamar a `get_workflow_sdk_reference` justo antes de escribirlo (referencia que puede cambiar de versión); en su lugar fija todos los parámetros de negocio (nodos, textos, modelo, credencial, contrato de payload) sin ambigüedad, dejando solo la sintaxis mecánica del SDK al flujo de validación iterativo que el propio servidor MCP exige.

**Ambigüedad resuelta en la escritura del plan:** `enrichExercisesWithCatalog` no volcaba `category` por defecto (allowlist explícita) — Task 6 ya incluye el fix concreto en `src/lib/utils.js`, no quedó como verificación pendiente.

**Consistencia de tipos:** `exercises` en `RoutineReviewModal` siempre `{ name, category, series, reps }` en Task 4/5/6. `buildRoutineBreakdown` devuelve `items` con `{ name, category, pattern, compound, series, reps }` — usado igual en Task 4. Contrato del webhook (`routineName`, `clientGoal`, `exercisesSummary` → `{ ok, answer }`) idéntico entre Task 3 y Task 4.
