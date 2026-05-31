import { supabase } from './_supabase-client.js';



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
