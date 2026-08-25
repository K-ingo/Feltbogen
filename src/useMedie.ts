import { useEffect, useState } from 'react';

// Under denne bredde er der ikke plads til sidebar ved siden af indholdet.
export const DESKTOP_FRA = 900;

// Over denne bredde er der plads til en kolonne mere. På en almindelig
// bærbar er der ikke — derfor to trin og ikke ét.
export const BREDSKAERM_FRA = 1500;

export function useErDesktop(): boolean {
  return useBredereEnd(DESKTOP_FRA);
}

export function useErBredskaerm(): boolean {
  return useBredereEnd(BREDSKAERM_FRA);
}

// Højden på det man faktisk kan se, i px.
//
// `100vh` og `100dvh` bygger på browserens layout-viewport, og den kan på iOS
// stå og være forkert: efter tastaturet har været fremme, eller når appen
// startes fra hjemmeskærmen mens systemet stadig animerer. Så måler den for
// lavt uden at rette sig igen, og alt der er hængt op på skærmens bund —
// bundnavigationen, plus-knappen — lander midt inde i listen mens indholdet
// tegnes hele vejen ned. `visualViewport` måler det synlige felt direkte og
// siger til hver gang det ændrer sig, tastaturet iberegnet.
export function useSynligHoejde(): number | null {
  const [hoejde, setHoejde] = useState<number | null>(() => maal());

  useEffect(() => {
    const opdater = () => setHoejde(maal());
    const vv = window.visualViewport;

    // Målingen lige efter montering: er vinduet blevet et andet siden første
    // render, er det her den bliver fanget.
    opdater();

    window.addEventListener('resize', opdater);
    window.addEventListener('orientationchange', opdater);
    // Tilbage fra baggrunden — iOS genbruger siden uden en resize.
    window.addEventListener('pageshow', opdater);
    vv?.addEventListener('resize', opdater);

    return () => {
      window.removeEventListener('resize', opdater);
      window.removeEventListener('orientationchange', opdater);
      window.removeEventListener('pageshow', opdater);
      vv?.removeEventListener('resize', opdater);
    };
  }, []);

  return hoejde;
}

function maal(): number | null {
  if (typeof window === 'undefined') return null;
  // Afrundet, så en brøkdel af en pixel ikke sender React en ny værdi ved
  // hvert eneste scroll.
  return Math.round(window.visualViewport?.height ?? window.innerHeight);
}

// Navnet starter med "use", fordi det er en hook — den bruger state og en
// effekt, og skal følge de samme regler som de to ovenfor.
function useBredereEnd(px: number): boolean {
  const [passer, setPasser] = useState(
    () => typeof window !== 'undefined' && window.innerWidth >= px
  );

  useEffect(() => {
    const forespoergsel = window.matchMedia(`(min-width: ${px}px)`);
    const opdater = () => setPasser(forespoergsel.matches);

    opdater();
    forespoergsel.addEventListener('change', opdater);
    return () => forespoergsel.removeEventListener('change', opdater);
  }, [px]);

  return passer;
}
