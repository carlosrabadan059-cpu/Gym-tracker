import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://jqpyqqlkgisykgywilrf.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpxcHlxcWxrZ2lzeWtneXdpbHJmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzEyNjcyNjMsImV4cCI6MjA4Njg0MzI2M30.HGvZZHYwAj1whHcUDIMu0fwdI9Xzngvl_VXaDs2S0ZU';
const supabase = createClient(supabaseUrl, supabaseKey);

async function fix() {
    console.log('Login attempt...');
    const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
        email: 'carlosrabadan059@gmail.com',
        password: 'admin123'
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
