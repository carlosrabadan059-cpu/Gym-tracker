#!/usr/bin/env node
/**
 * Mini-driver de navegador para ver la app sin abrirla a mano.
 * Sustituye a `chromium-cli` (que no es instalable fuera del sandbox de Claude).
 *
 * Uso:
 *   npm run browse -- <url> [opciones]
 *   npm run browse -- http://localhost:5173/prototype-logging.html --shot a.png
 *   npm run browse -- http://localhost:5173 --click "text=Progresión" --shot b.png
 *   echo "nav http://localhost:5173\nshot home.png" | npm run browse
 *
 * Opciones (se ejecutan en orden de aparición):
 *   --shot <fichero>     captura de pantalla (pantalla completa)
 *   --click <selector>   click en un selector Playwright
 *   --wait <selector>    espera a que aparezca un selector
 *   --sleep <ms>         espera fija
 *   --text               imprime el texto visible de la página
 *   --size <ancho>x<alto> viewport (por defecto 420x1000, móvil)
 *   --headed             abre el navegador visible en vez de headless
 *
 * Al terminar siempre imprime los errores de consola y de red que hubo.
 */
import path from 'node:path';

// playwright NO es dependencia del proyecto a propósito: su postinstall
// descarga ~150 MB de navegadores, y eso alargaría (o rompería, si el CDN va
// lento) el build de producción en Vercel. Es una herramienta solo de
// desarrollo, así que se instala a mano cuando hace falta.
let chromium;
try {
    ({ chromium } = await import('playwright'));
} catch {
    console.error(
        'Falta playwright (es intencionado, no es dependencia del proyecto).\n' +
        'Instálalo solo en tu máquina con:\n\n' +
        '  npm i --no-save playwright@1.62.1 && npx playwright install chromium\n'
    );
    process.exit(1);
}

const argv = process.argv.slice(2);
if (!argv.length) {
    console.error('Falta la URL. Ej: npm run browse -- http://localhost:5173 --shot home.png');
    process.exit(1);
}

const url = argv.find((a) => !a.startsWith('--'));
const has = (flag) => argv.includes(flag);
const valueAfter = (flag) => {
    const i = argv.indexOf(flag);
    return i === -1 ? null : argv[i + 1];
};

const sizeArg = valueAfter('--size') || '420x1000';
const [width, height] = sizeArg.split('x').map(Number);

const browser = await chromium.launch({ headless: !has('--headed') });
const page = await browser.newPage({ viewport: { width, height } });

const problems = [];
page.on('pageerror', (e) => problems.push(`[error de página] ${e.message}`));
page.on('console', (m) => m.type() === 'error' && problems.push(`[consola] ${m.text()}`));
page.on('requestfailed', (r) => problems.push(`[petición fallida] ${r.url()} — ${r.failure()?.errorText}`));

await page.goto(url, { waitUntil: 'load', timeout: 30000 });

// Ejecuta las acciones en el orden en que aparecen en la línea de comandos
for (let i = 0; i < argv.length; i++) {
    const flag = argv[i];
    const value = argv[i + 1];
    if (flag === '--wait') await page.waitForSelector(value, { timeout: 15000 });
    if (flag === '--click') await page.click(value, { timeout: 15000 });
    if (flag === '--sleep') await page.waitForTimeout(Number(value));
    if (flag === '--shot') {
        const out = path.resolve(value);
        await page.screenshot({ path: out, fullPage: true });
        console.log(`captura → ${out}`);
    }
    if (flag === '--text') {
        console.log('--- texto visible ---');
        console.log(await page.evaluate(() => document.body.innerText));
    }
}

if (!argv.some((a) => ['--shot', '--text'].includes(a))) {
    // Sin acciones explícitas: al menos deja una captura para poder mirarla
    await page.screenshot({ path: path.resolve('browse.png'), fullPage: true });
    console.log(`captura → ${path.resolve('browse.png')}`);
}

console.log(problems.length ? `\n⚠️  ${problems.length} problema(s):\n${problems.join('\n')}` : '\n✅ sin errores de consola ni de red');

await browser.close();
