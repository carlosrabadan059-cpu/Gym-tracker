import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://jqpyqqlkgisykgywilrf.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpxcHlxcWxrZ2lzeWtneXdpbHJmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzEyNjcyNjMsImV4cCI6MjA4Njg0MzI2M30.HGvZZHYwAj1whHcUDIMu0fwdI9Xzngvl_VXaDs2S0ZU';
const supabase = createClient(supabaseUrl, supabaseKey);

async function setupClient() {
    const email = 'client_agent@test.com';
    const password = 'password123';
    
    console.log("Signing up client...");
    const { data: authData, error: authError } = await supabase.auth.signUp({
        email,
        password,
        options: {
            data: { username: 'ClientAgent' }
        }
    });
    
    // Ensure profile exists and role is client
    const { data: signInData } = await supabase.auth.signInWithPassword({ email, password });
    if(signInData?.user) {
        await supabase.from('profiles').update({ role: 'client', fullName: 'Agente Cliente' }).eq('user_id', signInData.user.id);
        console.log("Client created and role set.", signInData.user.id);
    }
}

setupClient();
