import { supabase } from './_supabase-client.js';



async function updateExercise() {
    const { data, error } = await supabase
        .from('exercises')
        .update({
            name: 'Encogimiento de Abdomen en banco',
            image_url: '/exercises/seated-bench-crunch.png'
        })
        .or('name.eq.Abdominales en Banco,name.eq.Encogimientos en Banco')
        .select();

    if (error) {
        console.error('Error updating exercise:', error);
    } else {
        console.log('Successfully updated exercise:', data);
    }
}

updateExercise();
