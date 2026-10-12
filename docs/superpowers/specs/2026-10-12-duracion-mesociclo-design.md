# Duración del mesociclo y aviso de lo que queda

**Fecha:** 2026-10-12
**Estado:** implementado y publicado en web. Migración aplicada en producción.

## Qué se quiere

El mesociclo tenía fecha de inicio pero no duración: la app contaba
"Semana 9, 10…" sin fin. Carlos programa bloques de 8 semanas y quiere que
entrenador y cliente vean cuánto queda.

## Diseño

### Base de datos

`routines.mesocycle_weeks smallint` nullable, entre 1 y 52
(`20261012_routines_mesocycle_weeks.sql`). Nula = sin duración: todo se ve
como antes. Las 5 rutinas actuales de Carlos quedaron con 8.

### Lógica (`src/lib/mesocycle.js`)

- `getMesocycleStatus(start, weeks, today)` → `{ week, total, endDate, state }`.
  El último día es el último de la semana `weeks` (inicio lunes 12-oct,
  8 semanas → domingo 6-dic). `state`: `active`, `last` (semana `weeks`) o
  `finished` (pasado el último día). La semana no pasa de `weeks`.
- `getMesocycleAlert(routines, today)`: el aviso más urgente de un cliente
  (terminado antes que última semana; a igualdad, el que acaba antes).

### Entrenador

- Ficha del cliente: campo "Semanas" junto a la fecha del mesociclo y
  etiqueta "Semana 1 de 8 · termina el 6 dic" (naranja en la última semana,
  roja al terminar).
- Asignar plantilla: "Duración (semanas)", 8 por defecto.
- Inicio: sección "Mesociclo" con los clientes en su última semana o con el
  mesociclo terminado.
- Hoja imprimible: "Duración" usa `mesocycle_weeks` si está puesta.

### Cliente

Etiqueta bajo el nombre de cada rutina del Inicio: "Semana 1 de 8",
"Última semana del mesociclo" o "Mesociclo terminado". La rutina sigue
funcionando igual al terminar.

Componente compartido: `src/components/shared/MesocycleBadge.jsx`.

## Fuera de alcance

Notificación push al terminar; cerrar o renovar el mesociclo automáticamente.
