const fs = require('fs');

const catalog = JSON.parse(fs.readFileSync('./catalog_dump.json', 'utf8'));
const categoriesOrder = ["Pecho", "Dorsal", "Bíceps", "Tríceps", "Hombro", "Pierna", "Glúteo", "Abdomen"];

const slugify = (text) => text.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/\s+/g, '-');

let sql = '-- Actualización masiva a imágenes v2 (Futures Gym)\n';
let csvRows = ['ID;Nombre;Categoria;Imagen'];

// Group by category to match the requested order
const grouped = {};
categoriesOrder.forEach(cat => grouped[cat] = []);
catalog.forEach(ex => {
    if (grouped[ex.category]) grouped[ex.category].push(ex);
});

categoriesOrder.forEach(cat => {
    grouped[cat].sort((a,b) => a.id - b.id);
    grouped[cat].forEach(ex => {
        const catSlug = slugify(ex.category);
        const v2Name = `v2_${catSlug}_${ex.id}.png`;
        const v2Path = `./public/exercises/${v2Name}`;
        
        if (fs.existsSync(v2Path)) {
            const finalPath = `/exercises/${v2Name}`;
            sql += `UPDATE exercise_catalog SET image_url = '${finalPath}' WHERE id = ${ex.id};\n`;
            sql += `UPDATE exercises SET image_url = '${finalPath}' WHERE catalog_id = ${ex.id};\n`;
            csvRows.push(`${ex.id};${ex.name};${ex.category};${finalPath}`);
        } else {
            // Keep current if v2 doesn't exist
            csvRows.push(`${ex.id};${ex.name};${ex.category};${ex.image_url}`);
        }
    });
});

fs.writeFileSync('scripts/update_v2_final.sql', sql);
fs.writeFileSync('EJERCICIOS_CATALOGO_V2.csv', csvRows.join('\n'));

console.log('Sincronización completada:');
console.log('- SQL generado: scripts/update_v2_final.sql');
console.log('- CSV generado: EJERCICIOS_CATALOGO_V2.csv');
