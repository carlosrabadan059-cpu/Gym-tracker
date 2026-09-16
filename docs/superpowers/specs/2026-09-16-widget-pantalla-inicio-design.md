# Widget de pantalla de inicio (v2 Fase 5)

**Fecha:** 2026-09-16
**Alcance:** última pieza de Fase 5 (pulido opcional) de
`docs/plan-apple-health-integration.md` que admite hacerse en esta sesión —
racha + pasos del día en un widget de pantalla de inicio, sin abrir la app.
FC en vivo queda para una sesión aparte (más cara, siempre se dejó "para el
final" en el plan).

## Punto de partida real

Ya existe una extensión de widget (`ios/App/RutinexWidgets`, target
`RutinexWidgets`), construida en la Fase 4 para la Live Activity del
entreno. `RutinexWidgetsBundle.swift` hoy solo registra
`RutinexWidgetsLiveActivity()` — el comentario en el propio fichero dice
explícitamente "Fase 4 no incluye widget de pantalla de inicio [...], se
quitó el boilerplate". Bundle ids reales (`project.pbxproj`):
`com.rutinex.app` (app) / `com.rutinex.app.RutinexWidgets` (extensión).

El proyecto ya tiene un patrón probado para exponer funciones nativas a
medida sin depender de paquetes npm de terceros: un plugin Capacitor
**local** (`ios/App/App/LiveActivityPlugin.swift`), registrado a mano vía
`bridge?.registerPluginInstance(...)` y consumido desde JS con acceso lazy
a `Capacitor.Plugins.<Nombre>` (`src/lib/liveActivity.js`).

## Decisiones tomadas (brainstorming, no reabrir)

1. **Se añade un segundo `Widget` al `WidgetBundle` ya existente**, no un
   target de Xcode nuevo — un `WidgetBundle` puede alojar varios widgets
   (Live Activity + widget de pantalla de inicio conviven sin problema).
2. **Paso de datos JS→widget: plugin local nuevo + App Group**, no
   `capacitor-widget-kit` (paquete de terceros mencionado en el plan
   original) — mismo patrón ya depurado en el proyecto, cero dependencias
   npm nuevas.
3. **Sin Health conectado: solo la fila de racha**, sin placeholder de
   pasos. La racha nunca depende de Health (viene de `workout_logs`); los
   pasos sí, y si no hay dato esa fila no se pinta.
4. **Actualización por escritura parcial**: el método nativo `setData`
   acepta claves sueltas (`{streak}` o `{steps}`) y solo sobreescribe esas
   en el App Group, sin esperar a que ambos datos lleguen a la vez desde
   JS — evita coordinar dos `useEffect` independientes (racha viene del
   efecto que ya carga `workout_logs` para el mapa de recuperación
   muscular; pasos viene del efecto que ya carga `getTodayMetrics()`).

## Arquitectura

### App Group

`group.com.rutinex.app`. Entitlements nuevos:
- `ios/App/App/App.entitlements` (ya existe, tiene HealthKit) — gana la
  entrada de App Groups.
- `ios/App/RutinexWidgets/RutinexWidgets.entitlements` (nuevo) — misma
  entrada.

**Paso manual del usuario en Xcode** (no automatizable desde aquí):
Signing & Capabilities de ambos targets (`App`, `RutinexWidgets`) → "+
Capability" → App Groups → marcar `group.com.rutinex.app`. Cuenta personal
gratuita, mismo criterio que HealthKit (sin coste, sin Developer Program).

### Plugin local — `ios/App/App/HomeWidgetPlugin.swift`

Mismo patrón que `LiveActivityPlugin.swift`: método `setData(_ call:
CAPPluginCall)` que lee `streak`/`steps` opcionales de los args, escribe
las que vengan en `UserDefaults(suiteName: "group.com.rutinex.app")`, y
llama `WidgetCenter.shared.reloadTimelines(ofKind: "RutinexHomeWidget")`.
Registrado en `MainViewController.swift` igual que `LiveActivityPlugin`.

### `src/lib/homeWidget.js`

```js
import { Capacitor } from '@capacitor/core';
const getPlugin = () => Capacitor.Plugins.HomeWidget;
export const isHomeWidgetAvailableOnThisPlatform = () =>
    Capacitor.isNativePlatform() && !!getPlugin();

export async function updateHomeWidgetData({ streak, steps } = {}) {
    if (!isHomeWidgetAvailableOnThisPlatform()) return;
    try {
        const data = {};
        if (streak !== undefined) data.streak = streak;
        if (steps !== undefined) data.steps = steps;
        if (Object.keys(data).length === 0) return;
        await getPlugin().setData(data);
    } catch (err) {
        console.error('[HomeWidget] No se pudo actualizar el widget:', err);
    }
}
```

### Widget SwiftUI — `ios/App/RutinexWidgets/RutinexHomeWidget.swift` (nuevo)

`TimelineProvider` que lee del mismo App Group; una entrada de timeline
(sin política de refresco periódico propia — el widget se refresca cuando
la app llama `reloadTimelines`, más una recarga de sistema diaria por
defecto de WidgetKit). Vista `.systemSmall`: racha siempre (con icono de
fuego, mismo criterio visual que el resto de la app), fila de pasos solo
si `UserDefaults` tiene esa clave. Se añade a
`RutinexWidgetsBundle.body`.

### `DashboardView.jsx`

- En el `useEffect` que ya carga `logs` de `workout_logs` para
  `computeMuscleRecovery` (línea ~174): añade
  `updateHomeWidgetData({ streak: computeStreak(logs.map(l => l.date)) })`.
- En el `useEffect` que ya carga `getTodayMetrics()` (línea ~275): añade
  `updateHomeWidgetData({ steps: metrics.steps })` dentro del `.then`.

## Testing

Sin lógica pura nueva propia — reutiliza `computeStreak` (`adherence.js`,
ya testeado). Sin test para el plugin Swift ni la vista SwiftUI: no hay
infraestructura de test nativo en este proyecto (ni falta, dado el
alcance).

**Verificación real, pendiente del usuario:** compilar en Xcode con la
capability de App Groups activada en ambos targets, instalar en el
iPhone, mantener pulsada la pantalla de inicio → "+" → buscar Rutinex →
añadir el widget pequeño, y confirmar que muestra la racha (y los pasos,
si Health está conectado).

## Fuera de alcance

- Tamaños de widget mediano/grande — solo `.systemSmall`.
- Widget de Centro de Control — descartado, mismo comentario que ya deja
  el código (`RutinexWidgetsBundle.swift`).
- Frecuencia cardíaca en vivo — pieza aparte, sesión dedicada.
- Deep-link al tocar el widget (abrir una pantalla concreta de la app) —
  no pedido, el widget es solo lectura.
