import { supabase } from './_supabase-client.js';


async function setupClient() {
    const email = 'client_agent@test.com';
    const password = process.env.TEST_ACCOUNT_PASSWORD;
    
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
