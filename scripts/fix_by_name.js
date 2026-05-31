import { supabase } from './_supabase-client.js';

async function fixByName() {
    await supabase.auth.signInWithPassword({
        email: process.env.SUPABASE_ADMIN_EMAIL,
        password: process.env.ADMIN_PASSWORD
    });

    const fixes = [
        { name: 'Crunch abdominal banco declinado', image_url: '/exercises/futures_abdomen_crunch_declinado_final.png' },
        { name: 'Crunch de rodillas en banco', image_url: '/exercises/futures-abdomen-cable-crunch.png' }
    ];

    for (const f of fixes) {
        console.log(`Updating by name: ${f.name}...`);
        const { data, error } = await supabase
            .from('exercise_catalog')
            .update({ image_url: f.image_url })
            .ilike('name', f.name)
            .select();
        
        if (error) console.error('Error:', error.message);
        else console.log(`✓ Updated ${data.length} rows for ${f.name}`);
    }
}

fixByName();
