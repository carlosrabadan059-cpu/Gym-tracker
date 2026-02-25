import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://jqpyqqlkgisykgywilrf.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpxcHlxcWxrZ2lzeWtneXdpbHJmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzEyNjcyNjMsImV4cCI6MjA4Njg0MzI2M30.HGvZZHYwAj1whHcUDIMu0fwdI9Xzngvl_VXaDs2S0ZU';

const supabase = createClient(supabaseUrl, supabaseKey);

async function listExercises() {
    const { data, error } = await supabase
        .from('exercises')
        .select('*');

    if (error) {
        console.error('Error listing exercises:', error);
    } else {
        data.forEach(ex => console.log(`${ex.id}: ${ex.name}`));
    }
}

listExercises();
