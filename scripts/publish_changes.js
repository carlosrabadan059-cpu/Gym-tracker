import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

// Load .env.local without external dependencies
try {
    const envPath = resolve(__dirname, '../.env.local');
    readFileSync(envPath, 'utf8').split('\n').forEach(line => {
        const eq = line.indexOf('=');
        if (eq > 0) process.env[line.slice(0, eq).trim()] = line.slice(eq + 1).trim();
    });
} catch {
    // .env.local not found — rely on environment variables already set
}

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;
const adminEmail = process.env.SUPABASE_ADMIN_EMAIL;
const adminPassword = process.env.SUPABASE_ADMIN_PASSWORD;

if (!supabaseUrl || !supabaseKey || !adminEmail || !adminPassword) {
    console.error('Missing required env vars. Copy .env.example to .env.local and fill in the values.');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function publishChanges() {
    console.log('Logging in to Supabase...');
    const { error: authError } = await supabase.auth.signInWithPassword({
        email: adminEmail,
        password: adminPassword,
    });

    if (authError) {
        console.error('Login failed:', authError.message);
        return;
    }
    console.log('Login success.');

    const updateData = {
        name: 'Crunch abdominal en máquina',
        image_url: '/exercises/v2_abdomen_83.png'
    };

    console.log('Updating exercise 83...');
    const { data, error } = await supabase
        .from('exercise_catalog')
        .update(updateData)
        .eq('id', 83)
        .select();

    if (error) {
        console.error('Error updating exercise 83:', error.message);
    } else if (data && data.length > 0) {
        console.log('✓ Exercise 83 updated successfully:', data[0]);
    } else {
        console.log('⚠ No rows updated for ID 83. Checking if it exists...');
        const { data: check } = await supabase.from('exercise_catalog').select('id').eq('id', 83);
        console.log('Check result:', check);
    }
}

publishChanges();
