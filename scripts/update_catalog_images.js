import { supabase } from './_supabase-client.js';
import fs from 'fs';


async function updateCatalogImages() {
    // 1. Log in first so we have permissions
    const { data: authData, error: loginError } = await supabase.auth.signInWithPassword({
        email: 'trainer@gymtracker.com',
        password: process.env.TEST_ACCOUNT_PASSWORD
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
