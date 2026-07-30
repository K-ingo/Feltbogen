// defineConfig fra vitest/config frem for vite, så test-feltet er typet.
import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  test: {
    // Testene kører i Node; fake-indexeddb (indlæst i opsætningen) giver Dexie
    // et IndexedDB at arbejde mod, så datalaget kan testes uden en browser.
    environment: 'node',
    include: ['src/**/*.test.ts'],
    setupFiles: ['src/test/opsaetning.ts'],
  },
})
