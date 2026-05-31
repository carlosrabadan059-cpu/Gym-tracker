import { supabase } from './_supabase-client.js';

async function fix() {
    await supabase.auth.signInWithPassword({
        email: process.env.SUPABASE_ADMIN_EMAIL,
        password: process.env.ADMIN_PASSWORD
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
