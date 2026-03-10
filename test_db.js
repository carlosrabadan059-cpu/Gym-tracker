import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://jqpyqqlkgisykgywilrf.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpxcHlxcWxrZ2lzeWtneXdpbHJmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzEyNjcyNjMsImV4cCI6MjA4Njg0MzI2M30.HGvZZHYwAj1whHcUDIMu0fwdI9Xzngvl_VXaDs2S0ZU';
const supabase = createClient(supabaseUrl, supabaseKey);

async function seed() {
    const { data: users } = await supabase.from('profiles').select('*').eq('username', 'Carlos');
    if (!users || users.length === 0) return console.log("User Carlos not found.");
    const carlosId = users[0].user_id;

    // Seed data
    const now = new Date();
    // 3 days ago
    const d1 = new Date(now); d1.setDate(d1.getDate() - 3);
    // 1 week ago
    const d2 = new Date(now); d2.setDate(d2.getDate() - 8);
    // 2 weeks ago
    const d3 = new Date(now); d3.setDate(d3.getDate() - 15);

    const logs = [
        {
            user_id: carlosId,
            routine_id: 'day1',
            date: d1.toISOString(),
            logs: { "101": { completedSets: { 0: true, 1: true, 2: true, 3: true }, setsData: { 0: { weight: "60", reps: "10" }, 1: { weight: "60", reps: "10" } } }, cardio: { type: "Correr en cinta", duration: 15 } }
        },
        {
            user_id: carlosId,
            routine_id: 'day2',
            date: d2.toISOString(),
            logs: { "63": { completedSets: { 0: true, 1: true, 2: true, 3: true }, setsData: { 0: { weight: "120", reps: "12" }, 1: { weight: "120", reps: "10" } } }, cardio: { type: "Bicicleta", duration: 20 } }
        },
        {
            user_id: carlosId,
            routine_id: 'day3',
            date: d3.toISOString(),
            logs: { "301": { completedSets: { 0: true, 1: true, 2: true, 3: true }, setsData: { 0: { weight: "50", reps: "12" }, 1: { weight: "55", reps: "10" } } } }
        }
    ];

    const { error } = await supabase.from('workout_logs').insert(logs);
    if (error) console.error("Error seeding:", error);
    else console.log("Seeded 3 workout logs for Carlos.");
}

seed();
