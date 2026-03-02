import fs from 'fs';

const rawData = fs.readFileSync('scripts/catalog_image_map.json');
const catalogMap = JSON.parse(rawData);

let sqlStatements = `-- Update Exercise Catalog Images\n`;

for (const item of catalogMap) {
    const imageUrl = `https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/exercises/${item.image}/0.jpg`;
    sqlStatements += `UPDATE exercise_catalog SET image_url = '${imageUrl}' WHERE id = ${item.id};\n`;
}

fs.writeFileSync('scripts/update_images.sql', sqlStatements);
console.log('SQL script generated at scripts/update_images.sql');
