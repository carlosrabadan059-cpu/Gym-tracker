# Handoff — Gym Tracker

**Date:** 2026-06-14  
**Repo:** `/Users/carlosrabadan/Gym-tracker` (branch: `main`, up to date with origin)

---

## Estado del proyecto

React 19 PWA + Supabase, desplegada en Vercel con CI/CD automático desde GitHub. UI en español.

---

## Lo que se hizo en esta sesión

### 1. Fix: Plancha abdominal no marcaba series — commit `308852a`

- **Archivo:** `src/views/ExerciseDetailModal.jsx` — función `toggleSet`
- **Causa:** el guard bloqueaba ejercicios sin peso, pero "Plancha" tiene `catalog_id=97` (tiempo), no bodyweight — el campo de peso estaba oculto pero el guard seguía exigiendo peso.
- **Fix:** añadir `!isTimeBased` a la condición:
  ```js
  // antes
  if (!isBodyweight && (!currentSet || !currentSet.weight)) {
  // después
  if (!isBodyweight && !isTimeBased && (!currentSet || !currentSet.weight)) {
  ```
- Pushed y desplegado en Vercel.

### 2. Fix: Chatbot del entrenador no funcionaba — commit `91156a3`

- **Causa:** CSP (`vercel.json`) solo permitía conexiones a `*.supabase.co`. El `fetch()` al webhook de n8n era bloqueado por el navegador:
  > `Refused to connect to https://n8n.rabadanhouse.space/webhook/Gym because it does not appear in the connect-src directive`
- **Fix:** añadir `https://n8n.rabadanhouse.space` al `connect-src` en `vercel.json`:
  ```
  connect-src 'self' https://*.supabase.co wss://*.supabase.co https://n8n.rabadanhouse.space
  ```
- Pushed y desplegado. **Confirmado funcionando por el usuario.**

---

## Arquitectura relevante

| Concepto | Detalle |
|----------|---------|
| Chatbot | `src/views/ChatView.jsx` → POST a `VITE_N8N_WEBHOOK_URL` (env var en Vercel) |
| n8n | Workflow en `https://n8n.rabadanhouse.space`, modelo LLM vía OpenRouter |
| Ejercicios tiempo | `catalog_id=97` → `isTimeBased=true`, ver `src/lib/exerciseUtils.js` |
| CSP | Definida en `vercel.json` → `headers[*].Content-Security-Policy` |
| Deploy | Push a `main` → Vercel auto-deploy (sin comando manual) |

---

## Archivos clave

- `src/views/ExerciseDetailModal.jsx` — modal de entrenamiento activo
- `src/lib/exerciseUtils.js` — `BODYWEIGHT_CATALOG_IDS`, `TIME_BASED_CATALOG_ID`, helpers
- `src/views/ChatView.jsx` — chatbot con n8n
- `vercel.json` — headers de seguridad (CSP, HSTS, etc.)
- `src/lib/supabase.js` — cliente Supabase
- `supabase/migrations/` — migraciones SQL

---

## Pendiente

- **n8n MCP:** el skill `n8n-mcp-tools-expert` fue instalado globalmente pero el servidor MCP no está configurado (falta API key de n8n). No es bloqueante.
- **Archivos sin trackear:** `.agents/skills/cyber-neo/` y `handoff.md` en raíz del proyecto — decidir si commitear o añadir a `.gitignore`.

---

## Suggested skills

- `/handoff` — para documentar el estado al final de sesión
- `/code-review ultra` — revisión multi-agente del branch antes de merges importantes
- `n8n-mcp-tools-expert` (ya instalado globalmente) — para configurar/gestionar workflows de n8n desde Claude

---

## Contexto de despliegue

- **Vercel project:** `gym-tracker` (cuenta de carlosrabadan059@gmail.com)
- **Supabase:** proyecto conectado, RLS activo en todas las tablas sensibles
- **GitHub → Vercel:** integración activa, push a `main` = deploy automático
