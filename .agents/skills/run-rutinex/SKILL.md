---
name: run-rutinex
description: Arranca Rutinex en local y condúcelo en el navegador para ver un cambio funcionando (capturas incluidas). Úsala cuando haya que ejecutar la app, verla, hacerle capturas, comprobar que un cambio funciona de verdad, o revisar un prototipo. Cubre los requisitos que no son evidentes (.env.local, node_modules) y los fallos que ya nos han costado tiempo.
---

# Arrancar y conducir Rutinex

Vite + React 19 + Supabase. Puerto **5173**.

## Antes de arrancar: dos requisitos que fallan en silencio

**1. `node_modules` no está en el repo.** Si falta, `npm run dev` no arranca.

```bash
[ -d node_modules ] || npm install
```

**2. `.env.local` es obligatorio, y su ausencia da pantalla en blanco.**
`src/lib/supabase.js` llama a `createClient(import.meta.env.VITE_SUPABASE_URL, ...)`
en el import del módulo. Sin esas variables, `createClient` lanza
`supabaseUrl is required` **antes de que React monte** — la página queda
totalmente en blanco, sin ningún mensaje de error visible. Es el síntoma más
confuso de este repo: parece que la app está rota, y solo falta el fichero.

```bash
# Si no existe, créalo (está en .gitignore, no se commitea):
cat > .env.local <<'EOF'
VITE_SUPABASE_URL=https://jqpyqqlkgisykgywilrf.supabase.co
VITE_SUPABASE_ANON_KEY=<anon key del proyecto "Gym Tracker">
EOF
```

La anon key se saca del MCP de Supabase (`get_publishable_keys`, proyecto
`jqpyqqlkgisykgywilrf`) o del panel de Vercel. Es la clave pública, no la de
servicio.

## Arrancar y parar

```bash
# arrancar en segundo plano
nohup npm run dev > /tmp/rutinex-dev.log 2>&1 & disown

# esperar a que sirva (macOS no trae `timeout`, hay que sondear a mano)
for i in $(seq 1 20); do curl -sf http://localhost:5173 >/dev/null 2>&1 && break; sleep 1; done

# parar
lsof -ti:5173 -sTCP:LISTEN | xargs -r kill
```

## Conducirlo en el navegador

`chromium-cli` no existe en este entorno. Usa el driver del propio repo,
[tools/browse.mjs](../../../tools/browse.mjs):

```bash
npm run browse -- http://localhost:5173 --shot home.png
npm run browse -- http://localhost:5173 --click "text=Progresión" --shot stats.png
npm run browse -- http://localhost:5173 --text        # texto visible de la página
```

Siempre imprime al final los errores de consola, de página y de red — mirar
esa línea antes de dar nada por bueno. Opciones: `--shot`, `--click`,
`--wait`, `--sleep`, `--text`, `--size 420x1000`, `--headed`.

**`playwright` está fijado a 1.62.1 a propósito.** Las versiones nuevas
quieren un Chromium que no está en caché y el CDN da timeout al bajarlo. Si
alguien lo sube de versión y las capturas empiezan a fallar con
"Executable doesn't exist", es eso.

## Login: cuándo hace falta y cómo esquivarlo

La app está detrás de login de Supabase. El Dashboard, Estadísticas y el
entreno **no se pueden ver sin sesión** — el driver headless arranca con
perfil limpio, así que solo verá la pantalla de login.

Para trabajo de UI que no necesita datos reales, el repo usa **harness
standalone**: una página HTML en la raíz + su entry en `src/`, que monta solo
el componente en cuestión sin auth ni Supabase. Patrón:

```
prototype-<algo>.html          → en la raíz del repo
src/prototype-<algo>-main.jsx  → entry que monta el componente con datos mock
```

Se abren directos, sin login: `http://localhost:5173/prototype-<algo>.html`.
Hay ejemplos en las ramas `prototype/statistics-health-ui` y
`prototype/logging-ui`.

Si de verdad hace falta ver la app autenticada, pídele las credenciales al
usuario — no hay cuenta de prueba en el repo.

## Gotchas que ya nos han mordido

- **`npm run build` modifica `public/version.json`**, que está trackeado (el
  script de build le escribe un timestamp). Tras un build de verificación,
  `git checkout -- public/version.json` para no ensuciar el diff.
- **macOS no trae `timeout`**; usar el bucle de `curl` de arriba.
- **Cambiar de rama dispara un hook de graphify** que lanza una reconstrucción
  en segundo plano. Es normal, no es un error.
- El lint tiene un error preexistente en `DashboardView.jsx` (`onSeeAll`
  sin usar). No lo introdujo tu cambio.
