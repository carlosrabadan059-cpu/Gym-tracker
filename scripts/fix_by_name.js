import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://jqpyqqlkgisykgywilrf.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpxcHlxcWxrZ2lzeWtneXdpbHJmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzEyNjcyNjMsImV4cCI6MjA4Njg0MzI2M30.HGvZZHYwAj1whHcUDIMu0fwdI9Xzngvl_VXaDs2S0ZU';
const supabase = createClient(supabaseUrl, supabaseKey);

async function fixByName() {
    await supabase.auth.signInWithPassword({
        email: 'carlosrabadan059@gmail.com',
        password: 'admin123'
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
