import fs from 'fs';

const queue = JSON.parse(fs.readFileSync('scripts/final_26_queue.json', 'utf8'));

// The base prompt for the Futures Gym premium style
const createPrompt = (subject) => `High-end tech-noir fitness app icon. Subject: Detailed silhouette of a person doing ${subject}. Style: 'Futures Gym' tech aesthetic. Deep dark background, glowing green and purple neon circuitry lines. Glowing green neon highlighting on the targeted muscles. Text '[NAME]' in neon green and 'FUTURES GYM' in neon purple. Square layout, no rounded corners. Matches reference.`;

const enhancedQueue = queue.map(ex => {
    let subject = '';
    let nameText = '';

    // Customize subject and text based on ID
    switch (ex.id) {
        case 2: subject = 'incline dumbbell bench press'; nameText = 'INCLINE PRESS'; break;
        case 4: subject = 'seated dumbbell overhead press'; nameText = 'DB PRESS'; break;
        case 13: subject = 'parallel bar dips'; nameText = 'DIPS'; break;
        case 14: subject = 'decline barbell bench press'; nameText = 'DECLINE PRESS'; break;
        case 16: subject = 'neutral grip lat pulldown'; nameText = 'NEUTRAL PULL'; break;
        case 20: subject = 'single arm dumbbell row on a bench'; nameText = 'DB ROW'; break;
        case 24: subject = 'back extensions on a hyperextension bench'; nameText = 'BACK EXT'; break;
        case 26: subject = 'standing barbell biceps curl'; nameText = 'BB CURL'; break;
        case 39: subject = 'triceps rope pushdown on a cable machine'; nameText = 'ROPE PUSH'; break;
        case 47: subject = 'seated overhead dumbbell triceps extension (french press)'; nameText = 'FRENCH PRESS'; break;
        case 50: subject = 'seated machine shoulder press'; nameText = 'MACHINE PRESS'; break;
        case 54: subject = 'standing dumbbell lateral raises'; nameText = 'LATERAL RAISE'; break;
        case 55: subject = 'standing dumbbell front raises'; nameText = 'FRONT RAISE'; break;
        case 59: subject = 'cable front raises'; nameText = 'CABLE RAISE'; break;
        case 61: subject = 'machine shoulder shrugs'; nameText = 'MACHINE SHRUG'; break;
        case 63: subject = 'barbell back squats'; nameText = 'BB SQUAT'; break;
        case 64: subject = '45-degree leg press machine'; nameText = 'LEG PRESS'; break;
        case 73: subject = 'seated calf raise machine'; nameText = 'SEATED CALF'; break;
        case 76: subject = 'standing cable glute kickbacks'; nameText = 'GLUTE KICK'; break;
        case 79: subject = 'seated hip adductor machine (squeezing in)'; nameText = 'ADDUCTOR'; break;
        case 83: subject = 'floor crunches'; nameText = 'FLOOR CRUNCH'; break;
        case 84: subject = 'crunches on a decline bench'; nameText = 'DECLINE CRUNCH'; break;
        case 85: subject = 'hanging leg raises'; nameText = 'HANGING RAISE'; break;
        case 86: subject = 'seated abdominal crunch machine'; nameText = 'MACHINE CRUNCH'; break;
        case 88: subject = 'lying floor flutter kicks/scissors'; nameText = 'FLUTTER KICKS'; break;
        case 93: subject = 'lying side crunches for obliques'; nameText = 'SIDE CRUNCH'; break;
        default: subject = ex.name.toLowerCase(); nameText = ex.name.substring(0, 12).toUpperCase();
    }

    let prompt = createPrompt(subject).replace('[NAME]', nameText);

    // File names for saving
    let fileName = '';
    switch (ex.id) {
        case 2: fileName = 'futures_pecho_press_inclinado_mancuernas'; break;
        case 4: fileName = 'futures_pecho_press_superior_mancuernas_alt'; break; // Avoid conflict
        case 13: fileName = 'futures_pecho_fondos_paralelas'; break;
        case 14: fileName = 'futures_pecho_press_declinado'; break;
        case 16: fileName = 'futures_dorsal_jalon_neutral'; break;
        case 20: fileName = 'futures_dorsal_remo_mancuerna_horizontal'; break;
        case 24: fileName = 'futures_dorsal_lumbares_banco'; break;
        case 26: fileName = 'futures_biceps_curl_barra_recta_alt'; break; // Avoid conflict
        case 39: fileName = 'futures_triceps_jalon_cuerda_alt'; break; // Avoid conflict
        case 47: fileName = 'futures_triceps_press_frances_sentado'; break;
        case 50: fileName = 'futures_hombro_press_maquina'; break;
        case 54: fileName = 'futures_hombro_elevacion_lateral_mancuernas'; break;
        case 55: fileName = 'futures_hombro_elevacion_frontal_mancuernas'; break;
        case 59: fileName = 'futures_hombro_elevacion_frontal_polea'; break;
        case 61: fileName = 'futures_hombro_encogimiento_maquina'; break;
        case 63: fileName = 'futures_pierna_sentadilla_barra'; break;
        case 64: fileName = 'futures_pierna_prensa_45_alt'; break; // Avoid conflict
        case 73: fileName = 'futures_pierna_gemelo_sentado'; break;
        case 76: fileName = 'futures_gluteo_patada_polea'; break;
        case 79: fileName = 'futures_gluteo_aductor'; break;
        case 83: fileName = 'futures_abdomen_crunch_suelo_alt'; break; // Avoid conflict
        case 84: fileName = 'futures_abdomen_crunch_declinado'; break;
        case 85: fileName = 'futures_abdomen_elevacion_suspendido'; break;
        case 86: fileName = 'futures_abdomen_crunch_maquina'; break;
        case 88: fileName = 'futures_abdomen_tijeras'; break;
        case 93: fileName = 'futures_abdomen_crunch_lateral'; break;
    }

    return {
        ...ex,
        prompt: prompt,
        fileName: fileName + '_final'
    };
});

fs.writeFileSync('scripts/final_26_queue_enhanced.json', JSON.stringify(enhancedQueue, null, 2));
console.log('Saved enhanced queue with detailed tech-noir prompts.');
