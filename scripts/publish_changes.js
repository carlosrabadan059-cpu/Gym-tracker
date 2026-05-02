import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://jqpyqqlkgisykgywilrf.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpxcHlxcWxrZ2lzeWtneXdpbHJmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzEyNjcyNjMsImV4cCI6MjA4Njg0MzI2M30.HGvZZHYwAj1whHcUDIMu0fwdI9Xzngvl_VXaDs2S0ZU';
const supabase = createClient(supabaseUrl, supabaseKey);

async function publishChanges() {
    console.log('Logging in to Supabase...');
    const { error: authError } = await supabase.auth.signInWithPassword({
        email: 'carlosrabadan059@gmail.com',
        password: 'admin123'
    });

    if (authError) {
        console.error('Login failed:', authError.message);
        return;
    }
    console.log('Login success.');

    const updateData = {
        name: 'Crunch abdominal en máquina',
        image_url: '/exercises/v2_abdomen_83.png'
    };

    console.log('Updating exercise 83...');
    const { data, error } = await supabase
        .from('exercise_catalog')
        .update(updateData)
        .eq('id', 83)
        .select();

    if (error) {
        console.error('Error updating exercise 83:', error.message);
    } else if (data && data.length > 0) {
        console.log('✓ Exercise 83 updated successfully:', data[0]);
    } else {
        console.log('⚠ No rows updated for ID 83. Checking if it exists...');
        const { data: check } = await supabase.from('exercise_catalog').select('id').eq('id', 83);
        console.log('Check result:', check);
    }
}

publishChanges();
