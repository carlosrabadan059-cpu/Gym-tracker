import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  test: {
    // Por defecto 'node': los tests actuales cubren funciones puras.
    // Un test de componente puede pedir DOM con `// @vitest-environment jsdom`
    // en la primera línea del archivo.
    environment: 'node',
    include: ['src/**/*.test.{js,jsx}'],
  },
})
