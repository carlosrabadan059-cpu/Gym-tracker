import { supabase } from './_supabase-client.js';

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
