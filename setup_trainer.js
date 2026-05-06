import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://jqpyqqlkgisykgywilrf.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpxcHlxcWxrZ2lzeWtneXdpbHJmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzEyNjcyNjMsImV4cCI6MjA4Njg0MzI2M30.HGvZZHYwAj1whHcUDIMu0fwdI9Xzngvl_VXaDs2S0ZU';
const supabase = createClient(supabaseUrl, supabaseKey);

async function setupTrainer() {
    const email = 'trainer_agent@test.com';
    const password = 'password123';
    
    console.log("Signing up...");
    const { data: authData, error: authError } = await supabase.auth.signUp({
        email,
        password
    });
    if (authError) {
        console.error("SignUp error:", authError.message);
        // Maybe it exists. Try to sign in to get the user ID.
    }
    
    const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({
        email,
        password
    });
    if (signInError) {
        console.error("SignIn error:", signInError.message);
        return;
    }
    
    const userId = signInData.user.id;
    console.log("User ID:", userId);
    
    console.log("Updating role to trainer...");
    const { error: updateError } = await supabase
        .from('profiles')
        .update({ role: 'trainer' })
        .eq('user_id', userId);
        
    if (updateError) {
        console.error("Update error:", updateError.message);
    } else {
        console.log("Success! Account ready: trainer_agent@test.com / password123");
    }
}

setupTrainer();
