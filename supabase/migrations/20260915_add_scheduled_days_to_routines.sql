-- Fase 3 (parte 1): qué días de la semana toca cada rutina. null = sin día
-- fijo asignado (comportamiento actual, sin cambios). Valores 0-6 igual que
-- Date.prototype.getDay() de JS (0 = domingo ... 6 = sábado) — se elige esa
-- convención y no "lunes primero" porque es la que ya usa new Date().getDay()
-- sin ninguna conversión, sin añadir una tercera convención de inicio de
-- semana a las dos que ya conviven en el proyecto (ver nota en CLAUDE.md).
alter table routines add column if not exists scheduled_days smallint[];
