import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://jqpyqqlkgisykgywilrf.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpxcHlxcWxrZ2lzeWtneXdpbHJmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzEyNjcyNjMsImV4cCI6MjA4Njg0MzI2M30.HGvZZHYwAj1whHcUDIMu0fwdI9Xzngvl_VXaDs2S0ZU';

const supabase = createClient(supabaseUrl, supabaseKey);

async function updateExercise() {
    const { data, error } = await supabase
        .from('exercises')
        .update({
            name: 'Encogimiento de Abdomen en banco',
            image_url: '/exercises/seated-bench-crunch.png'
        })
        .eq('id', 90)
        .select();

    if (error) {
        console.error('Error updating exercise:', error);
    } else {
        console.log('Successfully updated exercise:', data);
    }
}

updateExercise();
