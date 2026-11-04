# Prototipo: precarga de pesos de la última vez

Abrir `http://localhost:5173/prototype-prefill-weights.html` (sin login ni Supabase).

Escenarios: mismas series, más series que antes, pirámide, entrenador vs historial, primera vez.
Controles: prioridad (historial / entrenador) y atenuado del peso precargado (sí / no).

## Qué valida
- Peso serie a serie desde `lastLog.setsData[i]`; si la serie no existe, repite el de la última serie registrada.
- Peso precargado atenuado + borde ámbar + nota; se normaliza al editar o confirmar con el check.
- La sugerencia de subida sigue aparte en la tarjeta "Última vez"; no se aplica sola.

## Veredicto
Pendiente: prioridad historial vs entrenador, y si se mantiene el atenuado.
Lógica candidata: `buildInitialSets` (main del prototipo) -> `src/lib/progression.js`.
