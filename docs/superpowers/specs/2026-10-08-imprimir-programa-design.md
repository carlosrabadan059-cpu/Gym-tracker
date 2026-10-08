# Imprimir el programa de entrenamiento de un cliente

**Fecha:** 2026-10-08
**Estado:** implementado (2026-10-08).

## Qué se quiere

Desde la app de entrenador, ver en pantalla e imprimir el programa completo de un cliente en
una hoja A4, parecida a la hoja en papel del gimnasio ("Programa de
entrenamiento avanzado"): cabecera con los datos del cliente, una fila con
los días y, por cada día, los dibujos de los ejercicios y una tabla con
series, repeticiones, descanso y observaciones.

## Decisiones tomadas

- **Agrupación por día**, no por grupo muscular: un bloque por rutina
  asignada, en el orden en que el cliente las hace. Es como está organizada
  la app.
- **Lesión y Calentamiento salen como líneas en blanco**, para escribir a
  mano. No se guardan en ningún sitio.
- **La columna Peso sale siempre en blanco**, como en el papel.
- **Dibujos:** en pantalla, en color; en papel, pequeños (~19 mm) y en
  escala de grises, porque las ilustraciones del catálogo son de fondo oscuro
  (decidido con el prototipo `prototype/printable-program`).
- **Impresión con el navegador** (`window.print()` y `@media print`). El
  entrenador trabaja en iPad o escritorio desde la web; en la app nativa del
  iPhone `window.print()` no funciona sin un plugin, y no hace falta.
  Descartados: generar el PDF en la app (jsPDF/html2canvas, dependencia
  pesada y texto como imagen) y en el servidor (desproporcionado).

## Dónde

Un botón **"Programa"** (icono de impresora) en
[ClientProfileView.jsx](../../../src/views/trainer/ClientProfileView.jsx),
junto a las rutinas asignadas. Solo aparece si el cliente tiene al menos una
rutina asignada. Abre la vista de impresión a pantalla completa, encima de la
ficha.

## Componentes

### `buildPrintableProgram(client, assignments, today)` — `src/lib/printableProgram.js`

Función pura, con tests. Transforma lo que la ficha ya tiene cargado en lo
que pinta la hoja:

```js
{
  clientName,           // client.name, o el email si no hay nombre
  goal,                 // client.goal o null
  startDate,            // el mesocycle_start_date más temprano de las rutinas, o null
  durationWeeks,        // la semana más alta de weekly_progression entre todos los ejercicios, o null
  days: [{
    label,              // "Día 1", "Día 2"... por el primer día programado (L→D), sin programar al final
    name,               // nombre de la rutina, sin el prefijo "Dia N -" que ya pone la etiqueta
    scheduledDays,      // p. ej. "L · X", o null si no tiene días programados
    exercises: [{
      number,           // 1, 2, 3... dentro del día
      name,
      imageUrl,         // o null
      variant,          // tempo o null
      series, reps,     // de la semana activa del mesociclo (applyMesocycleWeek)
      rest,             // '90"' a partir de rest_seconds, o null
      observations,     // notas y "RIR n" juntos, o null
      superset,         // 'A', 'B'... por orden de aparición en el día, o null
    }],
  }],
}
```

- La semana activa sale de `getCurrentMesocycleWeek(startDate, today)` de
  cada rutina, igual que en la ficha del cliente. Sin mesociclo, valores
  base.
- Las rutinas sin ejercicios no salen.

### `PrintableProgram.jsx` — `src/views/trainer/`

Pinta la hoja a partir del resultado de `buildPrintableProgram`.

- **Cabecera:** "Programa de entrenamiento", logo y nombre de Rutinex;
  líneas de Nombre, Fecha de inicio, Duración, Objetivo, Lesión y
  Calentamiento. Lo que no tenga dato sale como línea en blanco.
- **Rejilla de días:** una casilla por día con la etiqueta, el nombre de la
  rutina y sus días de la semana.
- **Un bloque por día:** título con la etiqueta y el nombre; fila de
  miniaturas numeradas; tabla con Nº, Ejercicio, Variante, Series,
  Repeticiones, Descanso, Peso (vacía) y Observaciones. Las superseries
  llevan una marca común en la columna Nº, como en la app.
- **Pantalla:** el informe es también una vista para consultar, no solo la
  vista previa del papel. Se lee bien en escritorio, iPad y móvil: en
  pantallas estrechas la rejilla de días pasa a una columna, las miniaturas
  hacen scroll horizontal y la tabla va en su propio contenedor con scroll
  horizontal, sin que la página entera se desplace de lado. Usa los colores
  del tema (claro/oscuro); el papel siempre sale en blanco y negro. Barra
  arriba con "Imprimir" (llama a `window.print()`) y "Volver"; la barra no
  sale en el papel. Solo la ve el entrenador.
- **Papel:** A4 vertical, blanco y negro, bordes finos. Cada bloque de día
  intenta no partirse entre páginas (`break-inside: avoid`). Al imprimir se
  oculta el resto de la app.

## Datos

Solo lectura. Usa lo que `ClientProfileView` ya carga (cliente y
asignaciones con sus rutinas y ejercicios, con `image_url` del catálogo).
Nada nuevo en la base de datos.

## Errores

- Un ejercicio sin imagen deja la casilla de la miniatura vacía con su
  número.
- Si una imagen no carga, se oculta y queda el número.

## Pruebas

- Tests de `buildPrintableProgram`: orden de días, semana activa del
  mesociclo, formato del descanso, observaciones con notas y RIR, campos
  vacíos, rutinas sin ejercicios.
- Comprobación visual con `run-rutinex` en la cuenta de entrenador de
  prueba: abrir la ficha de un cliente y la vista de impresión, sin pulsar
  Guardar ni Asignar.
