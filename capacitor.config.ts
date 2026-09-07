import type { CapacitorConfig } from '@capacitor/cli';

// TODO: cambiar 'appId' antes de `npx cap add ios`. Es el bundle identifier
// de Xcode — debe ser único y coincidir con lo que registres en el Apple
// Developer Program al pedir el entitlement de HealthKit (docs/plan-apple-health-integration.md,
// Fase 0). No hay uno definido en ningún sitio del repo todavía; este es un
// placeholder.
const config: CapacitorConfig = {
  appId: 'com.rutinex.app',
  appName: 'Rutinex',
  webDir: 'dist',
};

export default config;
