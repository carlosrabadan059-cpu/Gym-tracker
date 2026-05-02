import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';

// Cargar variables de entorno desde .env si existe, o usar hardcoded del proyecto
const supabaseUrl = 'https://jqpyqqlkgisykgywilrf.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpxcHlxcWxrZ2lzeWtneXdpbHJmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzEyNjcyNjMsImV4cCI6MjA4Njg0MzI2M30.HGvZZHYwAj1whHcUDIMu0fwdI9Xzngvl_VXaDs2S0ZU';
const supabase = createClient(supabaseUrl, supabaseKey);

async function syncToSupabase() {
    console.log('🚀 Iniciando sincronización con Supabase...');

    // 1. Login como entrenador para tener permisos de edición
    const { error: loginError } = await supabase.auth.signInWithPassword({
        email: 'trainer@gymtracker.com',
        password: 'password123'
    });

    if (loginError) {
        console.error('❌ Error de login:', loginError.message);
        console.log('Intentando continuar sin sesión (puede fallar por RLS)...');
    } else {
        console.log('✅ Sesión iniciada correctamente.');
    }

    // 2. Leer el catálogo local
    const catalogPath = path.resolve(process.cwd(), 'catalog_dump.json');
    if (!fs.existsSync(catalogPath)) {
        console.error('❌ No se encontró catalog_dump.json');
        return;
    }

    const catalog = JSON.parse(fs.readFileSync(catalogPath, 'utf8'));
    console.log(`📋 Procesando ${catalog.length} ejercicios...`);

    let updatedCatalog = 0;
    let updatedExercises = 0;
    let errors = 0;

    for (const ex of catalog) {
        // Solo actualizar si la URL es de tipo v2 o v3 (las que hemos estado generando)
        if (!ex.image_url.includes('v2_') && !ex.image_url.includes('v3_')) continue;

        try {
            // Actualizar tabla maestra (exercise_catalog)
            const { error: err1 } = await supabase
                .from('exercise_catalog')
                .update({ image_url: ex.image_url })
                .eq('id', ex.id);

            if (!err1) updatedCatalog++;

            // Actualizar tabla de rutinas activas (exercises)
            const { error: err2 } = await supabase
                .from('exercises')
                .update({ image_url: ex.image_url })
                .eq('catalog_id', ex.id);

            if (!err2) updatedExercises++;

            if (err1 || err2) {
                console.error(`⚠️ Error en ID ${ex.id}:`, err1?.message || err2?.message);
                errors++;
            }
        } catch (e) {
            console.error(`❌ Error inesperado en ID ${ex.id}:`, e);
            errors++;
        }
    }

    console.log('\n✨ Sincronización finalizada:');
    console.log(`- Catálogo maestro actualizado: ${updatedCatalog}`);
    console.log(`- Ejercicios en rutinas actualizados: ${updatedExercises}`);
    console.log(`- Errores: ${errors}`);
    console.log('\n💡 Si los números son 0, verifica los permisos RLS en Supabase.');
}

syncToSupabase();
