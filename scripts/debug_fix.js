import { supabase } from './_supabase-client.js';

async function fix() {
    console.log('Login attempt...');
    const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
        email: process.env.SUPABASE_ADMIN_EMAIL,
        password: process.env.ADMIN_PASSWORD
    });

    if (authError) {
        console.error('Auth error:', authError.message);
        return;
    }
    console.log('Auth success for:', authData.user.email);

    const fixes = [
        { id: 86, image_url: '/exercises/futures_abdomen_crunch_maquina_final.png' },
        { id: 87, image_url: '/exercises/futures-abdomen-cable-crunch.png' }
    ];

    for (const f of fixes) {
        console.log(`Updating ID ${f.id} to ${f.image_url}...`);
        const response = await supabase
            .from('exercise_catalog')
            .update({ image_url: f.image_url })
            .eq('id', f.id)
            .select();
        
        console.log('Response:', JSON.stringify(response, null, 2));
    }
}

fix();
