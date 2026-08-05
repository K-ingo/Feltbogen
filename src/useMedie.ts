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
