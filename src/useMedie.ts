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

// Om der er forbindelse. Ikke en mediaforespørgsel, men samme slags svar:
// noget om omgivelserne, som skærmen skal rette sig efter.
//
// `navigator.onLine` er et løfte om det svageste: falsk betyder helt sikkert
// ingen forbindelse, sandt betyder kun, at der er et netværk — ikke at der er
// hul igennem til serveren. Til at vælge ordlyd på en statuslinje er det nok.
export function useErOnline(): boolean {
  const [online, setOnline] = useState(() => navigator.onLine);

  useEffect(() => {
    const opdater = () => setOnline(navigator.onLine);
    window.addEventListener('online', opdater);
    window.addEventListener('offline', opdater);
    return () => {
      window.removeEventListener('online', opdater);
      window.removeEventListener('offline', opdater);
    };
  }, []);

  return online;
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

// Det synlige felt — højde og hvor langt det er skubbet ned — til et lag der
// skal stå over tastaturet.
//
// Et `position: fixed`-lag hænger på layout-viewporten. Når iOS-tastaturet
// kommer frem, bliver den ikke mindre: Safari skubber i stedet det synlige
// felt ned over siden, og et ark nedefra bliver liggende bag tastaturet med
// det felt, man skriver i. `visualViewport` kender både højden og
// forskydningen, og lægges laget præcis dér, står arkets bund på tastaturets
// overkant. `tastatur` er sand, når der er skåret mere end en adresselinje af
// — så er hjemmeknappen gemt bag tastaturet, og dens luft kan spares.
export interface SynligtFelt {
  top: number;
  hoejde: number;
  tastatur: boolean;
}

export function useSynligtFelt(): SynligtFelt | null {
  const [felt, setFelt] = useState<SynligtFelt | null>(() => maalFelt());

  useEffect(() => {
    const vv = window.visualViewport;
    const opdater = () => setFelt((foer) => {
      const nu = maalFelt();
      // Samme mål giver samme objekt, så et scroll uden ændring ikke tegner
      // arket om.
      return foer && nu && foer.top === nu.top && foer.hoejde === nu.hoejde
        && foer.tastatur === nu.tastatur ? foer : nu;
    });

    opdater();
    window.addEventListener('resize', opdater);
    vv?.addEventListener('resize', opdater);
    // Safari flytter det synlige felt uden at ændre højden, når fokus skifter
    // mellem to felter med tastaturet fremme.
    vv?.addEventListener('scroll', opdater);

    return () => {
      window.removeEventListener('resize', opdater);
      vv?.removeEventListener('resize', opdater);
      vv?.removeEventListener('scroll', opdater);
    };
  }, []);

  return felt;
}

// Mere end det her skåret af bunden er et tastatur og ikke en adresselinje,
// der folder sig ud.
const TASTATUR_FRA = 120;

function maalFelt(): SynligtFelt | null {
  if (typeof window === 'undefined' || !window.visualViewport) return null;
  const vv = window.visualViewport;
  const hoejde = Math.round(vv.height);
  return {
    top: Math.round(vv.offsetTop),
    hoejde,
    tastatur: window.innerHeight - hoejde > TASTATUR_FRA
  };
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
