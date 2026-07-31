// defineConfig fra vitest/config frem for vite, så test-feltet er typet.
import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'
import pakke from './package.json' with { type: 'json' }

// https://vite.dev/config/
export default defineConfig({
  // Versionen står ét sted — i package.json — og bages ind ved build, så
  // indstillingsskærmen ikke skal holdes ved lige i hånden.
  define: { __APP_VERSION__: JSON.stringify(pakke.version) },
  plugins: [
    react(),
    VitePWA({
      // Ny version tages i brug ved næste indlæsning. Det er forsvarligt her,
      // fordi redigeringer skrives til IndexedDB med det samme og markeres
      // usendt_aendring — en genindlæsning kan ikke tabe data.
      registerType: 'autoUpdate',

      // Appen skal kunne startes offline, så hele skallen lægges i cache.
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,woff2}'],
        navigateFallback: '/index.html',
        // Hvis PocketBase en dag flyttes til samme domæne under /api/, må de
        // kald ikke ende i index.html.
        navigateFallbackDenylist: [/^\/api\//],
        runtimeCaching: [
          {
            // Skrifterne hentes fra Google. Uden dem i cache skifter appen til
            // systemfonte så snart man er offline.
            urlPattern: /^https:\/\/fonts\.(googleapis|gstatic)\.com\//,
            handler: 'CacheFirst',
            options: {
              cacheName: 'google-fonts',
              expiration: { maxEntries: 20, maxAgeSeconds: 60 * 60 * 24 * 365 },
              cacheableResponse: { statuses: [0, 200] }
            }
          }
        ]
      },

      manifest: {
        name: 'Feltbogen',
        short_name: 'Feltbogen',
        description: 'Hold styr på gear-inventar og planlæg ture med smarte forslag.',
        lang: 'da',
        dir: 'ltr',
        display: 'standalone',
        orientation: 'portrait',
        start_url: '/',
        scope: '/',
        // Matcher --bg og --accent i src/index.css.
        background_color: '#f5efe4',
        theme_color: '#5d6b3a',
        categories: ['utilities', 'travel', 'lifestyle'],
        icons: [
          { src: '/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: '/icon-512.png', sizes: '512x512', type: 'image/png' },
          {
            // Android beskærer til vilkårlig form; her ligger motivet inden for
            // den sikre zone.
            src: '/icon-maskable-512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable'
          },
          { src: '/icon.svg', sizes: 'any', type: 'image/svg+xml' }
        ]
      },

      // Ingen service worker under `npm run dev` — den ville cache moduler væk
      // under næsen af hot reload. Slå til hvis offline skal fejlsøges.
      devOptions: { enabled: false }
    })
  ],
  test: {
    // Testene kører i Node; fake-indexeddb (indlæst i opsætningen) giver Dexie
    // et IndexedDB at arbejde mod, så datalaget kan testes uden en browser.
    environment: 'node',
    include: ['src/**/*.test.ts'],
    setupFiles: ['src/test/opsaetning.ts'],
  },
})
