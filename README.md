# Rutinex

App de seguimiento de entrenamientos de gimnasio. PWA mobile-first en React 19
+ Vite, con Supabase (PostgreSQL) como backend. Interfaz en español.

## Puesta en marcha

```bash
npm install
cp .env.example .env.local   # y rellenar los valores (ver abajo)
npm run dev                  # http://localhost:5173
```

### Variables de entorno (obligatorias)

`src/lib/supabase.js` crea el cliente de Supabase en el import del módulo, así
que **sin estas variables la app no arranca**: `createClient` lanza
`supabaseUrl is required` antes de que React monte y el navegador se queda en
**pantalla completamente en blanco**, sin mensaje de error.

| Variable | De dónde sale |
|---|---|
| `VITE_SUPABASE_URL` | URL del proyecto Supabase |
| `VITE_SUPABASE_ANON_KEY` | clave pública (anon) del proyecto — no la de servicio |

`.env.local` está en `.gitignore`. En producción, las variables se configuran
en Vercel.

## Comandos

```bash
npm run dev       # servidor de desarrollo (Vite), puerto 5173
npm run build     # build de producción
npm run preview   # servir el build de producción
npm run lint      # ESLint
npm run browse    # abrir la app en un navegador headless y hacer capturas
```

No hay suite de tests configurada.

### `npm run browse`

Driver mínimo de navegador ([tools/browse.mjs](tools/browse.mjs)) para ver
la app y capturarla sin abrirla a mano:

```bash
npm run browse -- http://localhost:5173 --shot home.png
npm run browse -- http://localhost:5173 --click "text=Progresión" --shot stats.png
npm run browse -- http://localhost:5173 --text
```

Opciones: `--shot`, `--click`, `--wait`, `--sleep`, `--text`, `--size 420x1000`,
`--headed`. Al terminar siempre imprime los errores de consola, de página y de
red que hubo.

> **`playwright` no es dependencia del proyecto a propósito.** Su `postinstall`
> descarga ~150 MB de navegadores, lo que alargaría (o rompería, si el CDN va
> lento) el build de producción. Instálalo solo en tu máquina la primera vez:
>
> ```bash
> npm i --no-save playwright@1.62.1 && npx playwright install chromium
> ```
>
> La versión va fijada a 1.62.1 porque las más nuevas piden un Chromium que el
> CDN suele no servir a tiempo (`Executable doesn't exist`).

## Estructura

Ver [CLAUDE.md](CLAUDE.md) para la arquitectura completa (vistas, contextos,
capa de datos, tablas de Supabase).

## Planificación

Los planes de producto vivos están en `docs/`:

| Documento | Contenido |
|---|---|
| [docs/plan-apple-health-integration.md](docs/plan-apple-health-integration.md) | **Versión 2** — integración con Apple Health/Apple Watch (Capacitor + HealthKit), detección de cardio y fuerza, Live Activity |
| [docs/plan-gym-app-features.md](docs/plan-gym-app-features.md) | **Versión 3** — funciones de las apps de gimnasio mejor valoradas (calculadora de discos, RPE, superseries, recuperación muscular) |
| [docs/plan-trainer-improvements.md](docs/plan-trainer-improvements.md) | Mejoras del lado entrenador (prescripción completa, programación, seguimiento) |
