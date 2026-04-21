const fs = require('fs');

const catalog = JSON.parse(fs.readFileSync('./catalog_dump.json', 'utf8'));
const files = fs.readFileSync('./v2_files_list.txt', 'utf8').split('\n');

const categoriesOrder = [
    "Pecho", "Dorsal", "Bíceps", "Tríceps", "Hombro", "Pierna", "Glúteo", "Abdomen"
];

const pending = catalog.filter(ex => {
    const v2Name = `v2_${ex.category.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "")}_${ex.id}.png`;
    return !files.some(f => f.includes(v2Name));
});

pending.sort((a, b) => {
    const catA = categoriesOrder.indexOf(a.category);
    const catB = categoriesOrder.indexOf(b.category);
    if (catA !== catB) return catA - catB;
    return a.id - b.id;
});

console.log(JSON.stringify(pending, null, 2));
