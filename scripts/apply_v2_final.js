import { supabase } from './_supabase-client.js';
import fs from 'fs';


async function apply() {
    // Auth as trainer to bypass potential RLS
    const { error: loginError } = await supabase.auth.signInWithPassword({
        email: process.env.SUPABASE_ADMIN_EMAIL,
        password: process.env.ADMIN_PASSWORD
    });

    if (loginError) {
        console.warn('Login warning (proceeding as anon):', loginError.message);
    } else {
        console.log('Logged in as Trainer ✅\n');
    }

    const csvData = fs.readFileSync('EJERCICIOS_CATALOGO_V2.csv', 'utf8').split('\n').slice(1);
    
    let ok = 0, fail = 0;
    
    for (const row of csvData) {
        if (!row.trim()) continue;
        const [id, name, category, image_url] = row.split(';');
        
        console.log(`Aplicando: [${category}] ${id}: ${name}...`);
        
        const { data, error } = await supabase
            .from('exercise_catalog')
            .update({ image_url })
            .eq('id', parseInt(id))
            .select();

        if (error || !data?.length) {
            console.error(`✗ Error en ID ${id}:`, error?.message || 'No se afectaron filas');
            fail++;
        } else {
            console.log(`✓ Actualizado: ${image_url}`);
            ok++;
        }
    }

    console.log(`\n--- RESULTADO FINAL ---`);
    console.log(`Éxito: ${ok}`);
    console.log(`Error: ${fail}`);
}

apply();
