import { supabase } from './_supabase-client.js';

async function main() {
    const email = 'trainer@gymtracker.com';
    const password = process.env.TEST_ACCOUNT_PASSWORD;

    // Attempt to sign up
    console.log(`Intentando registrar: ${email}...`);
    const { data: authData, error: authError } = await supabase.auth.signUp({
        email,
        password,
        options: {
            data: {
                username: 'Entrenador Pro',
            }
        }
    });

    if (authError) {
        if (authError.message.includes('already registered')) {
            console.log('El usuario ya existe. Intentando hacer login para actualizar el rol...');
            const { error: loginError } = await supabase.auth.signInWithPassword({ email, password });
            if (loginError) {
                console.error('Error al hacer login:', loginError.message);
                return;
            }
        } else {
            console.error('Error de registro:', authError.message);
            return;
        }
    } else {
        console.log('Usuario registrado correctamente.');
    }

    // Get current user session to update profile
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
        console.log('No session found. Please login first.');
        return;
    }

    const userId = session.user.id;
    console.log(`Usuario ID: ${userId}. Actualizando rol a "trainer"...`);

    const { error: updateError } = await supabase
        .from('profiles')
        .update({ role: 'trainer' })
        .eq('user_id', userId);

    if (updateError) {
        console.error('Error actualizando perfil:', updateError.message);
    } else {
        console.log('¡Éxito! El usuario ahora tiene el rol de "trainer".');
        console.log(`Credenciales de acceso:\nEmail: ${email}\nPassword: ${password}`);
    }
}

main();
