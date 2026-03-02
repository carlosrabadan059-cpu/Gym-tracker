import fs from 'fs';

const sqlContent = fs.readFileSync('scripts/update_futures_premium_V3.sql', 'utf8');
const idRegex = /WHERE id = (\d+);/g;
const updatedIds = new Set();
let match;
while ((match = idRegex.exec(sqlContent)) !== null) {
    updatedIds.add(parseInt(match[1], 10));
}

const catalog = JSON.parse(fs.readFileSync('catalog_dump.json', 'utf8'));
const remaining = catalog.filter(ex => !updatedIds.has(ex.id));

const queue = remaining.map(ex => ({
    id: ex.id,
    name: ex.name,
    category: ex.category || ex.muscle_group,
    prompt: `man doing ${ex.name.toLowerCase()}` // We will enhance the prompt later
}));

fs.writeFileSync('scripts/final_26_queue.json', JSON.stringify(queue, null, 2));
console.log('Saved 26 exercises to scripts/final_26_queue.json');
