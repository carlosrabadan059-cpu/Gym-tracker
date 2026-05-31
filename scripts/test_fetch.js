import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
const __dirname = dirname(fileURLToPath(import.meta.url));
try {
    readFileSync(resolve(__dirname, '../.env.local'), 'utf8').split('\n').forEach(l => { const eq = l.indexOf('='); if (eq > 0) process.env[l.slice(0,eq).trim()] = l.slice(eq+1).trim(); });
} catch {}
const url = `${process.env.VITE_SUPABASE_URL}/rest/v1/exercise_catalog?id=eq.86`;
const key = process.env.VITE_SUPABASE_ANON_KEY;

async function testFetch() {
    console.log('Testing PATCH via fetch...');
    const res = await fetch(url, {
        method: 'PATCH',
        headers: {
            'apikey': key,
            'Authorization': `Bearer ${key}`,
            'Content-Type': 'application/json',
            'Prefer': 'return=representation'
        },
        body: JSON.stringify({
            image_url: '/exercises/futures_abdomen_crunch_declinado_final.png'
        })
    });
    
    console.log('Status:', res.status);
    const text = await res.text();
    console.log('Body:', text);
}

testFetch();
