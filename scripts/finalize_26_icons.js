import fs from 'fs';
import path from 'path';

const queuePath = path.join(process.cwd(), 'scripts', 'final_26_queue_enhanced.json');
const artifactsDir = '/Users/carlosrabadan/.gemini/antigravity/brain/6bb1c06a-60af-4fe3-9071-e4f181fa4dd4';
const publicDir = path.join(process.cwd(), 'public', 'exercises');
const sqlFile = path.join(process.cwd(), 'scripts', 'update_final_26.sql');

const queue = JSON.parse(fs.readFileSync(queuePath, 'utf8'));
const allFiles = fs.readdirSync(artifactsDir);

let sqlContent = '-- Update the remaining 26 premium icons\n\n';
let copiedCount = 0;

for (const ex of queue) {
    const baseName = ex.fileName;
    // Find the newest file matching this baseName in artifacts
    const matchingFiles = allFiles
        .filter(f => f.startsWith(baseName) && f.endsWith('.png'))
        .sort((a, b) => {
            const timeA = fs.statSync(path.join(artifactsDir, a)).mtimeMs;
            const timeB = fs.statSync(path.join(artifactsDir, b)).mtimeMs;
            return timeB - timeA; // Descending
        });

    if (matchingFiles.length > 0) {
        const latestFile = matchingFiles[0];
        const srcPath = path.join(artifactsDir, latestFile);
        const finalName = `${baseName}.png`;
        const destPath = path.join(publicDir, finalName);

        fs.copyFileSync(srcPath, destPath);
        copiedCount++;

        sqlContent += `UPDATE exercises SET image_url = '/exercises/${finalName}' WHERE id = ${ex.id};\n`;
    } else {
        console.error(`Missing artifact for ${baseName}`);
    }
}

fs.writeFileSync(sqlFile, sqlContent);
console.log(`Successfully copied ${copiedCount} icons to public/exercises/`);
console.log(`Generated SQL update script at scripts/update_final_26.sql`);
