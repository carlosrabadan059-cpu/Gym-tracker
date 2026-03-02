import { createClient } from '@supabase/supabase-js';
import fs from 'fs';

const supabaseUrl = 'https://jqpyqqlkgisykgywilrf.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpxcHlxcWxrZ2lzeWtneXdpbHJmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzEyNjcyNjMsImV4cCI6MjA4Njg0MzI2M30.HGvZZHYwAj1whHcUDIMu0fwdI9Xzngvl_VXaDs2S0ZU';
const supabase = createClient(supabaseUrl, supabaseKey);

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
