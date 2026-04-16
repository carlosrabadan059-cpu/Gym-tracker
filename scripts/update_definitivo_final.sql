-- ============================================================
-- SCRIPT DEFINITIVO: Imagen única y correcta por ejercicio
-- 96 ejercicios → 96 imágenes distintas
-- Ejecutar en Supabase SQL Editor
-- ============================================================

-- ============================================================
-- PECHO (id 1-14)
-- ============================================================
UPDATE exercise_catalog SET image_url = '/exercises/futures_pecho_press_superior_mancuernas_alt_final.png' WHERE id = 1;  -- Press de banca plano (Mancuernas)
UPDATE exercise_catalog SET image_url = '/exercises/futures_pecho_press_inclinado_mancuernas_final.png'    WHERE id = 2;  -- Press de banca inclinado (Mancuernas)
UPDATE exercise_catalog SET image_url = '/exercises/futures-pecho-aperturas-laterales.png'                 WHERE id = 3;  -- Aperturas laterales (Mancuernas)
UPDATE exercise_catalog SET image_url = '/exercises/futures-pecho-press-superior-mancuernas.png'           WHERE id = 4;  -- Press superior con mancuernas
UPDATE exercise_catalog SET image_url = '/exercises/futures-pecho-aperturas-banco-plano.png'               WHERE id = 5;  -- Aperturas en banco plano
UPDATE exercise_catalog SET image_url = '/exercises/futures-pecho-press-banca-plano-barra.png'             WHERE id = 6;  -- Press de banca plano (Barra)
UPDATE exercise_catalog SET image_url = '/exercises/futures-pecho-press-inclinado-barra.png'               WHERE id = 7;  -- Press de banca inclinado (Barra)
UPDATE exercise_catalog SET image_url = '/exercises/futures-pecho-cruce-superior.png'                      WHERE id = 8;  -- Cruce de poleas (Superior)
UPDATE exercise_catalog SET image_url = '/exercises/futures-pecho-cruce-inferior.png'                      WHERE id = 9;  -- Cruce de poleas (Inferior)
UPDATE exercise_catalog SET image_url = '/exercises/futures-pecho-contractora.png'                         WHERE id = 10; -- Contractora (Machine Fly)
UPDATE exercise_catalog SET image_url = '/exercises/futures-pecho-flexiones.png'                           WHERE id = 11; -- Flexiones (Push ups)
UPDATE exercise_catalog SET image_url = '/exercises/futures-pecho-pullover.png'                            WHERE id = 12; -- Pull over con mancuerna
UPDATE exercise_catalog SET image_url = '/exercises/futures_pecho_fondos_paralelas_final.png'              WHERE id = 13; -- Fondos en paralelas (Dips)
UPDATE exercise_catalog SET image_url = '/exercises/futures_pecho_press_declinado_final.png'               WHERE id = 14; -- Press declinado

-- ============================================================
-- DORSAL (id 15-24)
-- ============================================================
UPDATE exercise_catalog SET image_url = '/exercises/lat-pulldown.png'                                      WHERE id = 15; -- Dominadas (Pull ups)
UPDATE exercise_catalog SET image_url = '/exercises/futures_dorsal_jalon_neutral_final.png'                WHERE id = 16; -- Jalón al pecho (Neutral)
UPDATE exercise_catalog SET image_url = '/exercises/futures-dorsal-jalon-ancho.png'                        WHERE id = 17; -- Jalón al pecho (Ancho)
UPDATE exercise_catalog SET image_url = '/exercises/futures-dorsal-remo-polea-baja.png'                    WHERE id = 18; -- Remo en polea baja (Gironde)
UPDATE exercise_catalog SET image_url = '/exercises/futures-dorsal-jalon-tras-nuca.png'                    WHERE id = 19; -- Jalón tras nuca
UPDATE exercise_catalog SET image_url = '/exercises/futures_dorsal_remo_mancuerna_horizontal_final.png'    WHERE id = 20; -- Remo horizontal con mancuerna (Serrucho)
UPDATE exercise_catalog SET image_url = '/exercises/seated-cable-row.png'                                  WHERE id = 21; -- Remo en máquina
UPDATE exercise_catalog SET image_url = '/exercises/futures-dorsal-remo-barra.png'                         WHERE id = 22; -- Remo con barra
UPDATE exercise_catalog SET image_url = '/exercises/futures-dorsal-remo-vertical.png'                      WHERE id = 23; -- Remo vertical con mancuernas
UPDATE exercise_catalog SET image_url = '/exercises/futures_dorsal_lumbares_banco_final.png'               WHERE id = 24; -- Lumbares en banco

-- ============================================================
-- BÍCEPS / ANTEBRAZO (id 25-38)
-- ============================================================
UPDATE exercise_catalog SET image_url = '/exercises/futures-biceps-curl-barra-recta.png'                   WHERE id = 25; -- Curl con barra Z
UPDATE exercise_catalog SET image_url = '/exercises/futures_biceps_curl_barra_recta_alt_final.png'         WHERE id = 26; -- Curl con barra recta
UPDATE exercise_catalog SET image_url = '/exercises/futures-biceps-curl-martillo.png'                      WHERE id = 27; -- Curl martillo (Hammer)
UPDATE exercise_catalog SET image_url = '/exercises/futures-biceps-curl-concentrado.png'                   WHERE id = 28; -- Curl concentrado
UPDATE exercise_catalog SET image_url = '/exercises/futures-biceps-curl-predicador.png'                    WHERE id = 29; -- Curl en banco Scott (Predicador)
UPDATE exercise_catalog SET image_url = '/exercises/futures-biceps-curl-polea-baja.png'                    WHERE id = 30; -- Curl con polea baja
UPDATE exercise_catalog SET image_url = '/exercises/futures-biceps-curl-alterno-sentado.png'               WHERE id = 31; -- Curl alterno con mancuernas (Sentado)
UPDATE exercise_catalog SET image_url = '/exercises/futures-biceps-curl-polea-alta.png'                    WHERE id = 32; -- Curl de bíceps en polea alta (Doble bíceps)
UPDATE exercise_catalog SET image_url = '/exercises/futures-biceps-curl-reverse.png'                       WHERE id = 33; -- Curl con polea (Reverse grip)
UPDATE exercise_catalog SET image_url = '/exercises/futures-biceps-curl-tumbado.png'                       WHERE id = 34; -- Curl tumbado en polea gironda
UPDATE exercise_catalog SET image_url = '/exercises/futures-biceps-curl-zottman.png'                       WHERE id = 35; -- Curl Zottman
UPDATE exercise_catalog SET image_url = '/exercises/futures-biceps-antebrazo-supinacion.png'               WHERE id = 36; -- Curl de antebrazo (Supinación)
UPDATE exercise_catalog SET image_url = '/exercises/futures-biceps-antebrazo-pronacion.png'                WHERE id = 37; -- Curl de antebrazo (Pronación)
UPDATE exercise_catalog SET image_url = '/exercises/futures-biceps-giros-muneca.png'                       WHERE id = 38; -- Giros de muñeca

-- ============================================================
-- TRÍCEPS (id 39-49)
-- ============================================================
UPDATE exercise_catalog SET image_url = '/exercises/futures-triceps-jalon-cuerda.png'                      WHERE id = 39; -- Jalón de tríceps en polea (Cuerda)
UPDATE exercise_catalog SET image_url = '/exercises/futures-triceps-extension-tras-nuca.png'               WHERE id = 40; -- Extensiones de tríceps tras nuca (Polea)
UPDATE exercise_catalog SET image_url = '/exercises/futures-triceps-jalon-barra.png'                       WHERE id = 41; -- Jalón de tríceps (Barra recta)
UPDATE exercise_catalog SET image_url = '/exercises/futures-triceps-press-frances.png'                     WHERE id = 42; -- Press francés con barra Z
UPDATE exercise_catalog SET image_url = '/exercises/futures_triceps_press_frances_sentado_final.png'       WHERE id = 43; -- Press francés con mancuernas
UPDATE exercise_catalog SET image_url = '/exercises/futures-triceps-extension-una-mano.png'                WHERE id = 44; -- Extensiones de tríceps con mancuerna (Una mano)
UPDATE exercise_catalog SET image_url = '/exercises/futures-triceps-press-cerrado.png'                     WHERE id = 45; -- Press de banca agarre cerrado
UPDATE exercise_catalog SET image_url = '/exercises/futures-triceps-patada.png'                            WHERE id = 46; -- Patada de tríceps (Mancuerna)
UPDATE exercise_catalog SET image_url = '/exercises/ez-bar-skullcrusher.png'                               WHERE id = 47; -- Press francés (Sentado)
UPDATE exercise_catalog SET image_url = '/exercises/futures-triceps-fondos-maquina.png'                    WHERE id = 48; -- Fondos en máquina
UPDATE exercise_catalog SET image_url = '/exercises/futures-triceps-fondos-bancos.png'                     WHERE id = 49; -- Fondos entre bancos

-- ============================================================
-- HOMBRO (id 50-62)
-- ============================================================
UPDATE exercise_catalog SET image_url = '/exercises/futures_hombro_press_maquina_final.png'                WHERE id = 50; -- Press militar en máquina
UPDATE exercise_catalog SET image_url = '/exercises/futures-hombro-press-militar-mancuernas.png'           WHERE id = 51; -- Press militar con barra (Sentado)
UPDATE exercise_catalog SET image_url = '/exercises/futures-hombro-press-barra-de-pie.png'                 WHERE id = 52; -- Press militar con barra (De pie)
UPDATE exercise_catalog SET image_url = '/exercises/futures-hombro-press-arnold.png'                       WHERE id = 53; -- Press Arnold
UPDATE exercise_catalog SET image_url = '/exercises/futures_hombro_elevacion_lateral_mancuernas_final.png' WHERE id = 54; -- Elevaciones laterales (Mancuernas)
UPDATE exercise_catalog SET image_url = '/exercises/futures_hombro_elevacion_frontal_mancuernas_final.png' WHERE id = 55; -- Elevaciones frontales (Mancuernas)
UPDATE exercise_catalog SET image_url = '/exercises/futures-dorsal-face-pull.png'                          WHERE id = 56; -- Vuelos (Pájaros) para deltoide posterior
UPDATE exercise_catalog SET image_url = '/exercises/futures-hombro-front-raise-weight.png'                 WHERE id = 57; -- Elevaciones frontales (Disco o Barra)
UPDATE exercise_catalog SET image_url = '/exercises/upright-row.png'                                       WHERE id = 58; -- Remo al mentón (Polea)
UPDATE exercise_catalog SET image_url = '/exercises/futures_hombro_elevacion_frontal_polea_final.png'      WHERE id = 59; -- Elevaciones frontales (Polea)
UPDATE exercise_catalog SET image_url = '/exercises/futures-hombro-shrugs-barra.png'                       WHERE id = 60; -- Encogimientos de hombros (Shrugs) con barra
UPDATE exercise_catalog SET image_url = '/exercises/futures_hombro_encogimiento_maquina_final.png'         WHERE id = 61; -- Elevación de hombros en máquina o polea baja
UPDATE exercise_catalog SET image_url = '/exercises/futures-hombro-shrugs-mancuernas.png'                  WHERE id = 62; -- Encogimientos con mancuernas

-- ============================================================
-- PIERNA (id 63-75)
-- ============================================================
UPDATE exercise_catalog SET image_url = '/exercises/futures_pierna_sentadilla_barra_final.png'             WHERE id = 63; -- Sentadilla con barra
UPDATE exercise_catalog SET image_url = '/exercises/futures-pierna-prensa-45.png'                          WHERE id = 64; -- Prensa de piernas (45°)
UPDATE exercise_catalog SET image_url = '/exercises/futures-pierna-sentadilla-hack.png'                    WHERE id = 65; -- Sentadilla Hack
UPDATE exercise_catalog SET image_url = '/exercises/futures-pierna-extension.png'                          WHERE id = 66; -- Extensiones de cuádriceps
UPDATE exercise_catalog SET image_url = '/exercises/futures-pierna-sentadilla-smith.png'                   WHERE id = 67; -- Sentadilla en multipower
UPDATE exercise_catalog SET image_url = '/exercises/lying-leg-curl.png'                                    WHERE id = 68; -- Curl femoral sentado
UPDATE exercise_catalog SET image_url = '/exercises/futures-pierna-femoral-tumbado.png'                    WHERE id = 69; -- Femoral (Curl femoral tumbado)
UPDATE exercise_catalog SET image_url = '/exercises/futures-pierna-peso-muerto-rumano.png'                 WHERE id = 70; -- Peso muerto rumano (Mancuernas)
UPDATE exercise_catalog SET image_url = '/exercises/futures-pierna-zancadas.png'                           WHERE id = 71; -- Zancadas (Lunges)
UPDATE exercise_catalog SET image_url = '/exercises/futures-pierna-prensa-vertical.png'                    WHERE id = 72; -- Prensa vertical o Jaca
UPDATE exercise_catalog SET image_url = '/exercises/futures_pierna_gemelo_sentado_final.png'               WHERE id = 73; -- Extensiones de gemelos (Sentado)
UPDATE exercise_catalog SET image_url = '/exercises/futures-pierna-prensa-gemelos.png'                     WHERE id = 74; -- Prensa de gemelos
UPDATE exercise_catalog SET image_url = '/exercises/futures-pierna-gemelos-maquina.png'                    WHERE id = 75; -- Gemelos de pie (Máquina)

-- ============================================================
-- GLÚTEO (id 76-82)
-- ============================================================
UPDATE exercise_catalog SET image_url = '/exercises/futures_gluteo_patada_polea_final.png'                 WHERE id = 76; -- Patada de glúteo (Máquina o Polea)
UPDATE exercise_catalog SET image_url = '/exercises/futures-gluteo-abduccion-maquina.png'                  WHERE id = 77; -- Abducción de cadera (Máquina)
UPDATE exercise_catalog SET image_url = '/exercises/futures-gluteo-abductor.png'                           WHERE id = 78; -- Abductor
UPDATE exercise_catalog SET image_url = '/exercises/futures_gluteo_aductor_final.png'                      WHERE id = 79; -- Aductor
UPDATE exercise_catalog SET image_url = '/exercises/futures-gluteo-patada-lateral.png'                     WHERE id = 80; -- Patada lateral de glúteo
UPDATE exercise_catalog SET image_url = '/exercises/futures-gluteo-hip-thrust.png'                         WHERE id = 81; -- Puentes de glúteo (Hip Thrust)
UPDATE exercise_catalog SET image_url = '/exercises/futures-gluteo-step-ups.png'                           WHERE id = 82; -- Step ups

-- ============================================================
-- ABDOMEN (id 83-96)
-- ============================================================
UPDATE exercise_catalog SET image_url = '/exercises/futures-abdomen-crunch-espaldera.png'                      WHERE id = 83; -- Crunch abdominal en espaldera
UPDATE exercise_catalog SET image_url = '/exercises/futures_abdomen_crunch_declinado_final.png'            WHERE id = 84; -- Crunch en banco declinado
UPDATE exercise_catalog SET image_url = '/exercises/futures_abdomen_elevacion_suspendido_final.png'        WHERE id = 85; -- Elevación de piernas suspendido
UPDATE exercise_catalog SET image_url = '/exercises/futures_abdomen_crunch_maquina_final.png'              WHERE id = 86; -- Crunch en máquina
UPDATE exercise_catalog SET image_url = '/exercises/leg-raise.png'                                         WHERE id = 87; -- Elevación de piernas en banco plano
UPDATE exercise_catalog SET image_url = '/exercises/futures_abdomen_tijeras_final.png'                     WHERE id = 88; -- Tijeras abdominales
UPDATE exercise_catalog SET image_url = '/exercises/futures-abdomen-crunch-pies-alto.png'                  WHERE id = 89; -- Crunch con pies en alto
UPDATE exercise_catalog SET image_url = '/exercises/futures-abdomen-wheel.png'                             WHERE id = 90; -- Rueda abdominal
UPDATE exercise_catalog SET image_url = '/exercises/futures-abdomen-lumbares.png'                          WHERE id = 91; -- Lumbares (Hiperextensiones)
UPDATE exercise_catalog SET image_url = '/exercises/futures-abdomen-russian-twists.png'                    WHERE id = 92; -- Giros rusos (Russian Twists)
UPDATE exercise_catalog SET image_url = '/exercises/futures_abdomen_crunch_lateral_final.png'              WHERE id = 93; -- Crunch lateral (Oblicuos)
UPDATE exercise_catalog SET image_url = '/exercises/futures-abdomen-plank.png'                             WHERE id = 94; -- Plancha abdominal (Plank)
UPDATE exercise_catalog SET image_url = '/exercises/futures-abdomen-knee-raises.png'                       WHERE id = 95; -- Elevación de rodillas al pecho
UPDATE exercise_catalog SET image_url = '/exercises/futures-abdomen-cable-crunch.png'                      WHERE id = 96; -- Crunch con polea alta
