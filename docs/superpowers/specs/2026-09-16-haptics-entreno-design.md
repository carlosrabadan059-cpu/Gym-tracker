# Haptics en el entreno (v2 Fase 5, primera pieza)

**Fecha:** 2026-09-16
**Alcance:** una de las piezas independientes de Fase 5 (pulido opcional) de
`docs/plan-apple-health-integration.md` — vibración al marcar una serie
completada y al terminar el descanso.

## Punto de partida real

`ExerciseDetailModal.jsx` ya intenta vibrar al terminar el descanso con la
Web Vibration API (`navigator.vibrate([500, 200, 500, 200, 800])`), en 4
sitios (líneas ~329, 381, 408, 435 — distintas rutas: fin de temporizador
local, notificación del service worker, push del servidor). No funciona en
el shell nativo iOS: WKWebView no implementa esa API, así que en producción
(app instalada) esas llamadas no hacen nada — de ahí que siguiera pendiente
en el plan.

Al marcar una serie completada (`toggleSet`) no hay ningún haptic hoy, ni
roto ni funcional.

## Decisión (brainstorming, no reabrir)

Cubrir los dos disparadores, y **sustituir** `navigator.vibrate` por
`@capacitor/haptics` (no mantener los dos en paralelo): el plugin resuelve
el fallback en PWA/navegador internamente (usa Vibration API donde el
navegador la soporta), y usa el motor háptico real en el shell nativo iOS.
Un único punto de llamada por disparador, sin comprobar la plataforma a
mano.

## Arquitectura

`ExerciseDetailModal.jsx`:

```js
import { Haptics, ImpactStyle, NotificationType } from '@capacitor/haptics';
```

- **Marcar serie** (`toggleSet`, rama `isCompleting`): `Haptics.impact({
  style: ImpactStyle.Light })` — toque corto de confirmación. No debe
  competir con `playBeep('start')`, que ya suena en el mismo instante.
- **Fin de descanso** (los 4 sitios que hoy llaman `navigator.vibrate`):
  `Haptics.notification({ type: NotificationType.Success })` — patrón más
  largo, coherente con el triple pitido (`playBeep('end')`) que ya suena ahí.
  Se borran los 4 `navigator.vibrate(...)` existentes.

**Errores:** cada llamada envuelta en `try/catch` silencioso, mismo criterio
que ya usa `playBeep` — un fallo de haptics nunca debe romper el flujo de
registro de series.

## Dependencia

`@capacitor/haptics` — plugin oficial de Capacitor, mismo alcance de
mantenimiento que `@capacitor/core`/`@capacitor/ios` ya instalados. Se añade
a `package.json` y se sincroniza con `npx cap sync ios`.

## Testing

Sin lógica pura nueva — es una llamada de efecto secundario en un manejador
de UI. Sin test dedicado, mismo criterio que el resto de
`ExerciseDetailModal.jsx` (sin test hoy).

**Verificación real:** el simulador de iOS no vibra — solo se puede
confirmar en un iPhone físico. Queda como verificación pendiente del
usuario tras el build, igual que otras piezas de Health marcadas
"pendiente de validar en dispositivo real". En navegador de escritorio la
llamada no debe lanzar (dispositivos sin vibración deben ignorarla en
silencio, cubierto por el try/catch).

## Fuera de alcance

- El resto de piezas de Fase 5 (notificación proactiva, aviso de
  sincronización, widget, FC en vivo) — específicas de esta pieza, cada una
  con su propio ciclo brainstorming → spec → plan.
