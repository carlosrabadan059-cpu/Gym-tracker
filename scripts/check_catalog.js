import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://jqpyqqlkgisykgywilrf.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpxcHlxcWxrZ2lzeWtneXdpbHJmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzEyNjcyNjMsImV4cCI6MjA4Njg0MzI2M30.HGvZZHYwAj1whHcUDIMu0fwdI9Xzngvl_VXaDs2S0ZU';
const supabase = createClient(supabaseUrl, supabaseKey);

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
