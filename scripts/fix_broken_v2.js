import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://jqpyqqlkgisykgywilrf.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpxcHlxcWxrZ2lzeWtneXdpbHJmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzEyNjcyNjMsImV4cCI6MjA4Njg0MzI2M30.HGvZZHYwAj1whHcUDIMu0fwdI9Xzngvl_VXaDs2S0ZU';
const supabase = createClient(supabaseUrl, supabaseKey);

async function fix() {
    await supabase.auth.signInWithPassword({
        email: 'carlosrabadan059@gmail.com',
        password: 'admin123'
    });

    console.log('Aplicando correcciones para IDs rotos...');

    const fixes = [
        { id: 86, image_url: '/exercises/futures_abdomen_crunch_maquina_final.png' },
        // Para el 87, si no hay v2, usamos el base o uno similar por ahora
        { id: 87, image_url: '/exercises/futures-abdomen-cable-crunch.png' }
    ];

    for (const f of fixes) {
        const { data, error } = await supabase
            .from('exercise_catalog')
            .update({ image_url: f.image_url })
            .eq('id', f.id)
            .select();
        
        if (error) console.error(`Error ID ${f.id}:`, error.message);
        else console.log(`✓ ID ${f.id} corregido a: ${f.image_url}`);
    }
}

fix();
