import { createClient } from '@supabase/supabase-js';
import fs from 'fs';

const supabaseUrl = 'https://jqpyqqlkgisykgywilrf.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpxcHlxcWxrZ2lzeWtneXdpbHJmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzEyNjcyNjMsImV4cCI6MjA4Njg0MzI2M30.HGvZZHYwAj1whHcUDIMu0fwdI9Xzngvl_VXaDs2S0ZU';
const supabase = createClient(supabaseUrl, supabaseKey);

async function updateCatalogImages() {
    // 1. Log in first so we have permissions
    const { data: authData, error: loginError } = await supabase.auth.signInWithPassword({
        email: 'trainer@gymtracker.com',
        password: 'password123'
    });

    if (loginError) {
        console.error('Login error:', loginError.message);
        // We will continue anyway, sometimes public updates are allowed and we just needed .select()
    } else {
        console.log('Logged in successfully as:', authData.user.email);
    }

    const rawData = fs.readFileSync('scripts/catalog_image_map.json');
    const catalogMap = JSON.parse(rawData);

    let successCount = 0;
    let errorCount = 0;

    for (const item of catalogMap) {
        const imageUrl = `https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/exercises/${item.image}/0.jpg`;

        const { data, error } = await supabase
            .from('exercise_catalog')
            .update({ image_url: imageUrl })
            .eq('id', item.id)
            .select(); // .select() is key to seeing if it actually updated rows!

        if (error) {
            console.error(`Error updating exercise ID ${item.id}:`, error);
            errorCount++;
        } else if (data && data.length === 0) {
            console.error(`No rows updated for ID ${item.id}. RLS Error?`);
            errorCount++;
        } else {
            console.log(`Updated ID ${item.id} -> ${imageUrl}`);
            successCount++;
        }
    }

    console.log(`\nUpdate Complete. Success: ${successCount}, Errors: ${errorCount}`);
}

updateCatalogImages();
