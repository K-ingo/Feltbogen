/// <reference types="vite/client" />
/// <reference types="vite-plugin-pwa/client" />

// Bages ind ved build fra package.json — se `define` i vite.config.ts.
declare const __APP_VERSION__: string;
// Byggetidspunkt og commit, så man kan se hvilken udgave der faktisk kører.
declare const __APP_BYGGET__: string;
declare const __APP_COMMIT__: string;
