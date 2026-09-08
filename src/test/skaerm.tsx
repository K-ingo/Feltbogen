import { afterEach } from 'vitest';
import { cleanup, render } from '@testing-library/react';
import type { ReactElement } from 'react';
import '@testing-library/jest-dom/vitest';

// Fælles opsætning for skærmtestene.
//
// Testene kører uden `globals`, så Testing Librarys egen oprydning melder sig
// ikke selv til. Uden den bliver det forrige DOM stående, og en `getByText`
// finder to knapper, hvor der skulle være én.
afterEach(cleanup);

// jsdom har ingen matchMedia. `useMedie.ts` bruger den til at afgøre, om der
// er plads til en sidebar, så uden en stub falder hver eneste skærm på
// montering.
//
// Bredden sættes eksplicit i hver test frem for at arve jsdoms standard: en
// skærm ser forskellig ud på en telefon og en PC, og hvilken af dem man tester,
// skal stå i testen.
export const MOBIL = 390;
export const DESKTOP = 1280;

export function saetBredde(px: number): void {
  window.innerWidth = px;
  window.matchMedia = ((forespoergsel: string) => {
    const m = /min-width:\s*(\d+)px/.exec(forespoergsel);
    const passer = m ? px >= Number(m[1]) : false;
    return {
      matches: passer,
      media: forespoergsel,
      onchange: null,
      addEventListener: () => {},
      removeEventListener: () => {},
      addListener: () => {},
      removeListener: () => {},
      dispatchEvent: () => false
    };
  }) as typeof window.matchMedia;
}

// Tegner en skærm i en given bredde. Returnerer det samme som `render`.
export function tegn(ui: ReactElement, bredde: number = MOBIL) {
  saetBredde(bredde);
  return render(ui);
}
