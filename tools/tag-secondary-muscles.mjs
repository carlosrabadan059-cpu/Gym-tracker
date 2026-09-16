// Propone músculos secundarios para el catálogo de ejercicios usando el
// workflow n8n Gym_App_SecondaryMuscles (v3 Fase C1).
//
// NO escribe en la base de datos: vuelca las propuestas a un JSON para que
// un humano las revise y corrija antes de aplicarlas con
// tools/apply-secondary-muscles.mjs. Ese fichero intermedio es lo que hace
// que la revisión sea real y no un acto de fe.
//
//   node tools/tag-secondary-muscles.mjs            # solo los sin etiquetar
//   node tools/tag-secondary-muscles.mjs --all      # reetiqueta todo
//
// Vive en tools/ y no en scripts/ porque scripts/ está gitignorado (contiene
// credenciales); este script no lleva ninguna, las lee de .env.local.

import { createRequire } from 'node:module';
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { MUSCLE_VOCABULARY, normalizeSecondaryMuscles } from '../src/lib/muscleTaxonomy.js';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(`${ROOT}/`);
const { createClient } = require('@supabase/supabase-js');

const OUTPUT_PATH = resolve(ROOT, 'tools/secondary-muscles-proposal.json');
const BATCH_SIZE = 20;

function loadEnv() {
    const env = {};
    readFileSync(resolve(ROOT, '.env.local'), 'utf8').split('\n').forEach((line) => {
        const eq = line.indexOf('=');
        if (eq > 0) env[line.slice(0, eq).trim()] = line.slice(eq + 1).trim();
    });
    return env;
}

const env = loadEnv();
const WEBHOOK_URL = env.N8N_SECONDARY_MUSCLES_WEBHOOK_URL;
if (!WEBHOOK_URL) {
    console.error('Falta N8N_SECONDARY_MUSCLES_WEBHOOK_URL en .env.local');
    process.exit(1);
}

const supabase = createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_ANON_KEY);
const { error: authError } = await supabase.auth.signInWithPassword({
    email: env.SUPABASE_ADMIN_EMAIL,
    password: env.ADMIN_PASSWORD,
});
if (authError) {
    console.error('No se pudo autenticar:', authError.message);
    process.exit(1);
}

const retagAll = process.argv.includes('--all');

const { data: catalog, error } = await supabase
    .from('exercise_catalog')
    .select('id, name, category, secondary_muscles')
    .order('id');
if (error) {
    console.error('No se pudo leer el catálogo:', error.message);
    process.exit(1);
}

// Solo los grupos musculares reales: un ejercicio de 'Cardio' u 'Otros' no
// tiene músculos secundarios que calcular.
const candidates = catalog.filter((ex) => {
    if (!MUSCLE_VOCABULARY.includes(ex.category)) return false;
    return retagAll || !ex.secondary_muscles || ex.secondary_muscles.length === 0;
});

console.log(`Catálogo: ${catalog.length} ejercicios. A etiquetar: ${candidates.length}.`);
if (candidates.length === 0) {
    console.log('Nada que hacer.');
    process.exit(0);
}

const proposals = [];
const failures = [];

for (let i = 0; i < candidates.length; i += BATCH_SIZE) {
    const batch = candidates.slice(i, i + BATCH_SIZE);
    const batchNumber = Math.floor(i / BATCH_SIZE) + 1;
    const totalBatches = Math.ceil(candidates.length / BATCH_SIZE);
    process.stdout.write(`Lote ${batchNumber}/${totalBatches} (${batch.length} ejercicios)... `);

    try {
        const response = await fetch(WEBHOOK_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                vocabulary: MUSCLE_VOCABULARY,
                exercises: batch.map(({ id, name, category }) => ({ id, name, category })),
            }),
        });
        if (!response.ok) throw new Error(`HTTP ${response.status}`);

        const data = await response.json();
        const results = data?.results;
        if (!Array.isArray(results)) throw new Error('respuesta sin array "results"');

        const byId = new Map(results.map((r) => [r.id, r]));
        batch.forEach((ex) => {
            const result = byId.get(ex.id);
            if (!result) {
                failures.push({ id: ex.id, name: ex.name, reason: 'la IA no devolvió este id' });
                return;
            }
            proposals.push({
                id: ex.id,
                name: ex.name,
                category: ex.category,
                // Se normaliza aquí y no solo al aplicar: si el modelo cuela
                // el grupo principal o una etiqueta inventada, el JSON que
                // revisa el humano ya sale limpio.
                secondary_muscles: normalizeSecondaryMuscles(result.secondary_muscles, ex.category),
                motivo: result.motivo || '',
            });
        });
        console.log('ok');
    } catch (err) {
        console.log(`FALLO (${err.message})`);
        batch.forEach((ex) => failures.push({ id: ex.id, name: ex.name, reason: err.message }));
    }
}

writeFileSync(OUTPUT_PATH, `${JSON.stringify(proposals, null, 2)}\n`);

console.log(`\n--- ${proposals.length} propuestas escritas en ${OUTPUT_PATH} ---\n`);
proposals.forEach((p) => {
    const secundarios = p.secondary_muscles.length > 0 ? p.secondary_muscles.join(', ') : '(ninguno)';
    console.log(`${String(p.id).padStart(4)}  ${p.name.padEnd(42).slice(0, 42)}  ${p.category.padEnd(8)} → ${secundarios}`);
    console.log(`      ${p.motivo}`);
});

if (failures.length > 0) {
    console.log(`\n${failures.length} sin propuesta:`);
    failures.forEach((f) => console.log(`  ${f.id} ${f.name} — ${f.reason}`));
}

console.log('\nRevisa y corrige el JSON, y luego aplica con:');
console.log('  node tools/apply-secondary-muscles.mjs');
