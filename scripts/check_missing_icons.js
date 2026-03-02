import fs from 'fs';

// 1. Get IDs from the SQL script
const sqlContent = fs.readFileSync('scripts/update_futures_premium_V3.sql', 'utf8');
const idRegex = /WHERE id = (\d+);/g;
const updatedIds = new Set();
let match;
while ((match = idRegex.exec(sqlContent)) !== null) {
    updatedIds.add(parseInt(match[1], 10));
}

// 2. Load the catalog dump
const catalog = JSON.parse(fs.readFileSync('catalog_dump.json', 'utf8'));

// 3. Find remaining exercises
const remaining = catalog.filter(ex => !updatedIds.has(ex.id));

console.log(`Total exercises in catalog: ${catalog.length}`);
console.log(`Total updated in SQL: ${updatedIds.size}`);
console.log(`Remaining exercises: ${remaining.length}`);
console.log('\n--- Remaining Exercises ---');
remaining.forEach(ex => {
    console.log(`ID: ${ex.id} | Name: ${ex.name} | Group: ${ex.muscle_group} | Image: ${ex.image_url}`);
});
