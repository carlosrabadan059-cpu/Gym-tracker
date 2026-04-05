import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://jqpyqqlkgisykgywilrf.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpxcHlxcWxrZ2lzeWtneXdpbHJmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzEyNjcyNjMsImV4cCI6MjA4Njg0MzI2M30.HGvZZHYwAj1whHcUDIMu0fwdI9Xzngvl_VXaDs2S0ZU';
const supabase = createClient(supabaseUrl, supabaseKey);

const updates = [
    // PECHO
    { id: 1,  image_url: '/exercises/futures_pecho_press_superior_mancuernas_alt_final.png' },
    { id: 2,  image_url: '/exercises/futures_pecho_press_inclinado_mancuernas_final.png' },
    { id: 3,  image_url: '/exercises/futures-pecho-aperturas-laterales.png' },
    { id: 4,  image_url: '/exercises/futures-pecho-press-superior-mancuernas.png' },
    { id: 5,  image_url: '/exercises/futures-pecho-aperturas-banco-plano.png' },
    { id: 6,  image_url: '/exercises/futures-pecho-press-banca-plano-barra.png' },
    { id: 7,  image_url: '/exercises/futures-pecho-press-inclinado-barra.png' },
    { id: 8,  image_url: '/exercises/futures-pecho-cruce-superior.png' },
    { id: 9,  image_url: '/exercises/futures-pecho-cruce-inferior.png' },
    { id: 10, image_url: '/exercises/futures-pecho-contractora.png' },
    { id: 11, image_url: '/exercises/futures-pecho-flexiones.png' },
    { id: 12, image_url: '/exercises/futures-pecho-pullover.png' },
    { id: 13, image_url: '/exercises/futures_pecho_fondos_paralelas_final.png' },
    { id: 14, image_url: '/exercises/futures_pecho_press_declinado_final.png' },
    // DORSAL
    { id: 15, image_url: '/exercises/lat-pulldown.png' },
    { id: 16, image_url: '/exercises/futures_dorsal_jalon_neutral_final.png' },
    { id: 17, image_url: '/exercises/futures-dorsal-jalon-ancho.png' },
    { id: 18, image_url: '/exercises/futures-dorsal-remo-polea-baja.png' },
    { id: 19, image_url: '/exercises/futures-dorsal-jalon-tras-nuca.png' },
    { id: 20, image_url: '/exercises/futures_dorsal_remo_mancuerna_horizontal_final.png' },
    { id: 21, image_url: '/exercises/seated-cable-row.png' },
    { id: 22, image_url: '/exercises/futures-dorsal-remo-barra.png' },
    { id: 23, image_url: '/exercises/futures-dorsal-remo-vertical.png' },
    { id: 24, image_url: '/exercises/futures_dorsal_lumbares_banco_final.png' },
    // BÍCEPS / ANTEBRAZO
    { id: 25, image_url: '/exercises/futures-biceps-curl-barra-recta.png' },
    { id: 26, image_url: '/exercises/futures_biceps_curl_barra_recta_alt_final.png' },
    { id: 27, image_url: '/exercises/futures-biceps-curl-martillo.png' },
    { id: 28, image_url: '/exercises/futures-biceps-curl-concentrado.png' },
    { id: 29, image_url: '/exercises/futures-biceps-curl-predicador.png' },
    { id: 30, image_url: '/exercises/futures-biceps-curl-polea-baja.png' },
    { id: 31, image_url: '/exercises/futures-biceps-curl-alterno-sentado.png' },
    { id: 32, image_url: '/exercises/futures-biceps-curl-polea-alta.png' },
    { id: 33, image_url: '/exercises/futures-biceps-curl-reverse.png' },
    { id: 34, image_url: '/exercises/futures-biceps-curl-tumbado.png' },
    { id: 35, image_url: '/exercises/futures-biceps-curl-zottman.png' },
    { id: 36, image_url: '/exercises/futures-biceps-antebrazo-supinacion.png' },
    { id: 37, image_url: '/exercises/futures-biceps-antebrazo-pronacion.png' },
    { id: 38, image_url: '/exercises/futures-biceps-giros-muneca.png' },
    // TRÍCEPS
    { id: 39, image_url: '/exercises/futures-triceps-jalon-cuerda.png' },
    { id: 40, image_url: '/exercises/futures-triceps-extension-tras-nuca.png' },
    { id: 41, image_url: '/exercises/futures-triceps-jalon-barra.png' },
    { id: 42, image_url: '/exercises/futures-triceps-press-frances.png' },
    { id: 43, image_url: '/exercises/futures_triceps_press_frances_sentado_final.png' },
    { id: 44, image_url: '/exercises/futures-triceps-extension-una-mano.png' },
    { id: 45, image_url: '/exercises/futures-triceps-press-cerrado.png' },
    { id: 46, image_url: '/exercises/futures-triceps-patada.png' },
    { id: 47, image_url: '/exercises/ez-bar-skullcrusher.png' },
    { id: 48, image_url: '/exercises/futures-triceps-fondos-maquina.png' },
    { id: 49, image_url: '/exercises/futures-triceps-fondos-bancos.png' },
    // HOMBRO
    { id: 50, image_url: '/exercises/futures_hombro_press_maquina_final.png' },
    { id: 51, image_url: '/exercises/futures-hombro-press-militar-mancuernas.png' },
    { id: 52, image_url: '/exercises/futures-hombro-press-barra-de-pie.png' },
    { id: 53, image_url: '/exercises/futures-hombro-press-arnold.png' },
    { id: 54, image_url: '/exercises/futures_hombro_elevacion_lateral_mancuernas_final.png' },
    { id: 55, image_url: '/exercises/futures_hombro_elevacion_frontal_mancuernas_final.png' },
    { id: 56, image_url: '/exercises/futures-dorsal-face-pull.png' },
    { id: 57, image_url: '/exercises/futures-hombro-front-raise-weight.png' },
    { id: 58, image_url: '/exercises/upright-row.png' },
    { id: 59, image_url: '/exercises/futures_hombro_elevacion_frontal_polea_final.png' },
    { id: 60, image_url: '/exercises/futures-hombro-shrugs-barra.png' },
    { id: 61, image_url: '/exercises/futures_hombro_encogimiento_maquina_final.png' },
    { id: 62, image_url: '/exercises/futures-hombro-shrugs-mancuernas.png' },
    // PIERNA
    { id: 63, image_url: '/exercises/futures_pierna_sentadilla_barra_final.png' },
    { id: 64, image_url: '/exercises/futures-pierna-prensa-45.png' },
    { id: 65, image_url: '/exercises/futures-pierna-sentadilla-hack.png' },
    { id: 66, image_url: '/exercises/futures-pierna-extension.png' },
    { id: 67, image_url: '/exercises/futures-pierna-sentadilla-smith.png' },
    { id: 68, image_url: '/exercises/lying-leg-curl.png' },
    { id: 69, image_url: '/exercises/futures-pierna-femoral-tumbado.png' },
    { id: 70, image_url: '/exercises/futures-pierna-peso-muerto-rumano.png' },
    { id: 71, image_url: '/exercises/futures-pierna-zancadas.png' },
    { id: 72, image_url: '/exercises/futures-pierna-prensa-vertical.png' },
    { id: 73, image_url: '/exercises/futures_pierna_gemelo_sentado_final.png' },
    { id: 74, image_url: '/exercises/futures-pierna-prensa-gemelos.png' },
    { id: 75, image_url: '/exercises/futures-pierna-gemelos-maquina.png' },
    // GLÚTEO
    { id: 76, image_url: '/exercises/futures_gluteo_patada_polea_final.png' },
    { id: 77, image_url: '/exercises/futures-gluteo-abduccion-maquina.png' },
    { id: 78, image_url: '/exercises/futures-gluteo-abductor.png' },
    { id: 79, image_url: '/exercises/futures_gluteo_aductor_final.png' },
    { id: 80, image_url: '/exercises/futures-gluteo-patada-lateral.png' },
    { id: 81, image_url: '/exercises/futures-gluteo-hip-thrust.png' },
    { id: 82, image_url: '/exercises/futures-gluteo-step-ups.png' },
    // ABDOMEN
    { id: 83, image_url: '/exercises/futures-abdomen-crunch-suelo.png' },
    { id: 84, image_url: '/exercises/futures_abdomen_crunch_declinado_final.png' },
    { id: 85, image_url: '/exercises/futures_abdomen_elevacion_suspendido_final.png' },
    { id: 86, image_url: '/exercises/futures_abdomen_crunch_maquina_final.png' },
    { id: 87, image_url: '/exercises/leg-raise.png' },
    { id: 88, image_url: '/exercises/futures_abdomen_tijeras_final.png' },
    { id: 89, image_url: '/exercises/futures-abdomen-crunch-pies-alto.png' },
    { id: 90, image_url: '/exercises/futures-abdomen-wheel.png' },
    { id: 91, image_url: '/exercises/futures-abdomen-lumbares.png' },
    { id: 92, image_url: '/exercises/futures-abdomen-russian-twists.png' },
    { id: 93, image_url: '/exercises/futures_abdomen_crunch_lateral_final.png' },
    { id: 94, image_url: '/exercises/futures-abdomen-plank.png' },
    { id: 95, image_url: '/exercises/futures-abdomen-knee-raises.png' },
    { id: 96, image_url: '/exercises/futures-abdomen-cable-crunch.png' },
];

async function apply() {
    const { error: loginError } = await supabase.auth.signInWithPassword({
        email: 'carlosrabadan059@gmail.com',
        password: 'admin123'
    });
    if (loginError) {
        console.error('Login error:', loginError.message);
    } else {
        console.log('Logged in as trainer\n');
    }

    let ok = 0, fail = 0;
    for (const { id, image_url } of updates) {
        const { data, error } = await supabase
            .from('exercise_catalog')
            .update({ image_url })
            .eq('id', id)
            .select();

        if (error || !data?.length) {
            console.error(`✗ ID ${id}:`, error?.message || 'no rows updated');
            fail++;
        } else {
            console.log(`✓ ID ${id} → ${image_url}`);
            ok++;
        }
    }
    console.log(`\nFin: ${ok} actualizados, ${fail} errores`);
}

apply();
