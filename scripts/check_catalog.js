import { supabase } from './_supabase-client.js';

async function checkCatalog() {
    const { data: catalog, error } = await supabase
        .from('exercise_catalog')
        .select('*');

    if (error) {
        console.error('Error fetching catalog:', error);
        return;
    }

    console.log(`There are ${catalog.length} exercises in exercise_catalog.`);
    console.log('Sample:');
    console.log(catalog.slice(0, 5).map(e => `${e.name} - ${e.category} - ${e.image_url}`));
}

checkCatalog();
