// Aplica al catálogo las propuestas de músculos secundarios ya revisadas
// (v3 Fase C1). Lee tools/secondary-muscles-proposal.json, valida cada fila
// y actualiza exercise_catalog.secondary_muscles.
//
//   node tools/apply-secondary-muscles.mjs --dry-run   # solo enseña qué haría
//   node tools/apply-secondary-muscles.mjs             # escribe de verdad
//
// Una fila que no valide se salta y se reporta: no se aplica nada a medias
// en silencio.

import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { isValidSecondaryProposal, normalizeSecondaryMuscles } from '../src/lib/muscleTaxonomy.js';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(`${ROOT}/`);
const { createClient } = require('@supabase/supabase-js');

const INPUT_PATH = resolve(ROOT, 'tools/secondary-muscles-proposal.json');
const dryRun = process.argv.includes('--dry-run');

function loadEnv() {
    const env = {};
    readFileSync(resolve(ROOT, '.env.local'), 'utf8').split('\n').forEach((line) => {
        const eq = line.indexOf('=');
        if (eq > 0) env[line.slice(0, eq).trim()] = line.slice(eq + 1).trim();
    });
    return env;
}

const env = loadEnv();
const proposals = JSON.parse(readFileSync(INPUT_PATH, 'utf8'));

const valid = [];
const invalid = [];
proposals.forEach((p) => {
    // Se revalida tras la revisión humana: corregir el JSON a mano es
    // justo donde se cuela una etiqueta mal escrita.
    const normalized = { ...p, secondary_muscles: normalizeSecondaryMuscles(p.secondary_muscles, p.category) };
    if (isValidSecondaryProposal(normalized)) valid.push(normalized);
    else invalid.push(p);
});

console.log(`${proposals.length} propuestas: ${valid.length} válidas, ${invalid.length} descartadas.`);
if (invalid.length > 0) {
    console.log('\nDescartadas (no se tocan en la base de datos):');
    invalid.forEach((p) => console.log(`  ${p.id} ${p.name} — categoría "${p.category}", secundarios ${JSON.stringify(p.secondary_muscles)}`));
}

if (dryRun) {
    console.log('\n--dry-run: no se ha escrito nada.');
    process.exit(0);
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

let updated = 0;
const errors = [];
for (const p of valid) {
    const { error } = await supabase
        .from('exercise_catalog')
        .update({ secondary_muscles: p.secondary_muscles })
        .eq('id', p.id);
    if (error) errors.push({ id: p.id, name: p.name, message: error.message });
    else updated += 1;
}

console.log(`\nActualizados: ${updated}/${valid.length}`);
if (errors.length > 0) {
    console.log('Errores de escritura:');
    errors.forEach((e) => console.log(`  ${e.id} ${e.name} — ${e.message}`));
    process.exit(1);
}
