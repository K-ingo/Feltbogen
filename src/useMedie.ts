import { useEffect, useState } from 'react';

// Under denne bredde er der ikke plads til sidebar ved siden af indholdet.
export const DESKTOP_FRA = 900;

export function useErDesktop(): boolean {
  const [erDesktop, setErDesktop] = useState(
    () => typeof window !== 'undefined' && window.innerWidth >= DESKTOP_FRA
  );

  useEffect(() => {
    const forespoergsel = window.matchMedia(`(min-width: ${DESKTOP_FRA}px)`);
    const opdater = () => setErDesktop(forespoergsel.matches);

    opdater();
    forespoergsel.addEventListener('change', opdater);
    return () => forespoergsel.removeEventListener('change', opdater);
  }, []);

  return erDesktop;
}
