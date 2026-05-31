import { supabase } from './_supabase-client.js';
import fs from 'fs';


async function dumpCatalog() {
    const { data: catalog, error } = await supabase
        .from('exercise_catalog')
        .select('*')
        .order('id');

    if (error) {
        console.error('Error fetching catalog:', error);
        return;
    }

    fs.writeFileSync('catalog_dump.json', JSON.stringify(catalog, null, 2));
    console.log(`Dumped ${catalog.length} exercises to catalog_dump.json`);
}

dumpCatalog();
