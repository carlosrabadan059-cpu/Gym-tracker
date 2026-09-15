import { supabase } from './_supabase-client.js';

async function checkSingleLine() {
    const { data: catalog } = await supabase
        .from('exercise_catalog')
        .select('*')
        .eq('id', 83);

    console.log("Current DB data for ID 83:", catalog);
}

checkSingleLine();
