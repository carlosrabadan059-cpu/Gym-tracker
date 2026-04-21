const fs = require('fs');

const catalog = JSON.parse(fs.readFileSync('./catalog_dump.json', 'utf8'));
const exerciseFiles = fs.readdirSync('./public/exercises');

const broken = catalog.filter(ex => {
    if (!ex.image_url.startsWith('/exercises/')) return false;
    const fileName = ex.image_url.replace('/exercises/', '');
    return !exerciseFiles.includes(fileName);
});

console.log('--- BROKEN IMAGES IN DB ---');
broken.forEach(ex => {
    console.log(`ID ${ex.id} (${ex.name}): ${ex.image_url} (NOT FOUND)`);
});
