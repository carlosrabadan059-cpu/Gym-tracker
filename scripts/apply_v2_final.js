import { createClient } from '@supabase/supabase-js';
import fs from 'fs';

const supabaseUrl = 'https://jqpyqqlkgisykgywilrf.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpxcHlxcWxrZ2lzeWtneXdpbHJmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzEyNjcyNjMsImV4cCI6MjA4Njg0MzI2M30.HGvZZHYwAj1whHcUDIMu0fwdI9Xzngvl_VXaDs2S0ZU';
const supabase = createClient(supabaseUrl, supabaseKey);

async function apply() {
    // Auth as trainer to bypass potential RLS
    const { error: loginError } = await supabase.auth.signInWithPassword({
        email: 'carlosrabadan059@gmail.com',
        password: 'admin123'
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
