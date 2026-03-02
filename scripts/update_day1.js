import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://jqpyqqlkgisykgywilrf.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpxcHlxcWxrZ2lzeWtneXdpbHJmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzEyNjcyNjMsImV4cCI6MjA4Njg0MzI2M30.HGvZZHYwAj1whHcUDIMu0fwdI9Xzngvl_VXaDs2S0ZU';
const supabase = createClient(supabaseUrl, supabaseKey);

async function main() {
    const toAdd = [
        { id: 10, routine_id: 'day1', name: 'Aperturas en Máquina', series: '3', reps: '10', image_url: '/exercises/futures-pecho-contractora.png', ui_order: 4 },
        { id: 28, routine_id: 'day1', name: 'Curl Concentrado', series: '3', reps: '10', image_url: '/exercises/futures-biceps-curl-concentrado.png', ui_order: 7 }
    ];

    for (const ex of toAdd) {
        // Fix ui_orders of others later if needed, but fractional or just trailing is fine.
        // Let's just update the table.
        const { error, data } = await supabase.from('exercises').upsert(ex);
        if (error) {
            console.error(`Error adding ${ex.name}:`, error);
        } else {
            console.log(`Successfully added exercise ${ex.name}`);
        }
    }
}

main();
