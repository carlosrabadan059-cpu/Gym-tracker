import fs from 'fs';

const rawData = fs.readFileSync('catalog_dump.json');
const exercises = JSON.parse(rawData);

// Our 34 available neon images
// we'll try to map them by keywords.

function getNeonImageFor(exercise) {
    const name = exercise.name.toLowerCase();
    const cat = exercise.category.toLowerCase();

    if (cat === 'pecho') {
        if (name.includes('inclinado')) return '/exercises/incline-bench-press.png';
        if (name.includes('declinado')) return '/exercises/decline-bench-press.png';
        if (name.includes('fondos') || name.includes('dips')) return '/exercises/dips.png';
        return '/exercises/bench-press.png';
    }

    if (cat === 'dorsal') {
        if (name.includes('jalón') || name.includes('dominadas')) {
            if (name.includes('estrecho') || name.includes('v') || name.includes('neutral')) return '/exercises/v-bar-pulldown.png';
            return '/exercises/lat-pulldown.png';
        }
        if (name.includes('remo')) return '/exercises/seated-cable-row.png';
        if (name.includes('lumbar')) return '/exercises/back-extension.png';
        return '/exercises/lat-pulldown.png';
    }

    if (cat === 'bíceps' || cat === 'biceps') {
        if (name.includes('martillo')) return '/exercises/hammer-curl.png';
        return '/exercises/barbell-curl.png';
    }

    if (cat === 'tríceps' || cat === 'triceps') {
        if (name.includes('jalón') || name.includes('polea')) return '/exercises/triceps-pushdown.png';
        if (name.includes('fondos')) return '/exercises/dips.png';
        return '/exercises/skullcrusher.png';
    }

    if (cat === 'hombro') {
        if (name.includes('lateral') || name.includes('vuelos') || name.includes('pájaros')) return '/exercises/lateral-raise.png';
        if (name.includes('frontal')) return '/exercises/front-raise.png';
        if (name.includes('remo al mentón')) return '/exercises/upright-row.png';
        return '/exercises/overhead-press.png';
    }

    if (cat === 'pierna') {
        if (name.includes('gemelo') || name.includes('calf')) return '/exercises/calf-raise-machine.png';
        if (name.includes('prensa')) return '/exercises/leg-press.png';
        if (name.includes('extensi')) return '/exercises/leg-extension.png';
        if (name.includes('curl') || name.includes('femoral')) return '/exercises/lying-leg-curl.png';
        return '/exercises/leg-press.png'; // default fallback for squats
    }

    if (cat === 'glúteo' || cat === 'gluteo') {
        if (name.includes('abductor') || name.includes('abducción')) return '/exercises/abductor-machine-out.png';
        if (name.includes('aductor')) return '/exercises/abductor-machine-in.png';
        return '/exercises/abductor-machine-out.png'; // closest fallback
    }

    if (cat === 'abdomen') {
        if (name.includes('elevación') || name.includes('piernas')) return '/exercises/leg-raise.png';
        if (name.includes('declinado')) return '/exercises/decline-crunch.png';
        if (name.includes('máquina')) return '/exercises/crunch-machine.png';
        if (name.includes('lateral') || name.includes('oblicuo')) return '/exercises/decline-oblique-crunch.png';
        if (name.includes('sentado') || name.includes('situp')) return '/exercises/bench-situp.png';
        return '/exercises/seated-bench-crunch.png';
    }

    return null;
}

let sqlStatements = `-- Update Exercise Catalog with Neon Icons\n`;

for (const ex of exercises) {
    const imageUrl = getNeonImageFor(ex);
    if (imageUrl) {
        sqlStatements += `UPDATE exercise_catalog SET image_url = '${imageUrl}' WHERE id = ${ex.id};\n`;
    } else {
        console.warn(`Could not map image for ${ex.name}`);
    }
}

fs.writeFileSync('scripts/update_images_neon.sql', sqlStatements);
console.log('SQL script generated at scripts/update_images_neon.sql');
