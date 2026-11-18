import { useEffect, useState } from 'react';
import { erSkrivefelt, skjulBundnav, tastaturFremme } from './skrivefelt';

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

// Om man står og skriver på en telefon — så skal bundnavigationen væk.
//
// Skallen er lige så høj som det synlige felt (useSynligHoejde), og når
// tastaturet kommer frem, krymper den. Navigationen er skallens nederste
// række og lægger sig dermed lige over tastaturet — oven i det felt, man
// skriver i. Reglen står i skrivefelt.ts; her er kun lytterne.
export function useSkriverPaaTelefon(): boolean {
  const [fokus, setFokus] = useState(
    () => typeof document !== 'undefined' && erSkrivefelt(document.activeElement)
  );
  const [tastatur, setTastatur] = useState(false);
  const [lukketUdenBlur, setLukketUdenBlur] = useState(false);

  useEffect(() => {
    const vv = window.visualViewport;
    let hoejeste = 0;
    let bredde = window.innerWidth;
    let aaben = false;
    let ventende: ReturnType<typeof setTimeout> | undefined;

    const tjekFokus = () => setFokus(erSkrivefelt(document.activeElement));

    const maal = () => {
      const hoejde = vv?.height ?? window.innerHeight;
      // Ny bredde er en drejet telefon, og så er den gamle højeste højde ikke
      // længere et nulpunkt. Et tastatur, der står fremme under drejningen,
      // er ikke "lukket" af den grund.
      if (window.innerWidth !== bredde) {
        bredde = window.innerWidth;
        hoejeste = 0;
        aaben = false;
      }
      hoejeste = Math.max(hoejeste, hoejde);
      const nu = tastaturFremme(hoejeste, hoejde);
      if (nu) aaben = true;
      else if (aaben) {
        aaben = false;
        setLukketUdenBlur(true);
      }
      setTastatur(nu);
      // Et felt, der forsvinder fra siden, mens det har fokus, sender ikke
      // altid et focusout. Ændrer det synlige felt sig, ses der efter igen.
      tjekFokus();
    };

    const ind = (e: FocusEvent) => {
      if (ventende) clearTimeout(ventende);
      if (erSkrivefelt(e.target as Element | null)) {
        setFokus(true);
        setLukketUdenBlur(false);
      }
    };

    // Ved skift fra ét felt til det næste kommer focusout før focusin. Der
    // ventes en tur, så navigationen ikke blinker frem imellem de to.
    const ud = () => {
      if (ventende) clearTimeout(ventende);
      ventende = setTimeout(tjekFokus, 0);
    };

    maal();
    document.addEventListener('focusin', ind);
    document.addEventListener('focusout', ud);
    window.addEventListener('resize', maal);
    vv?.addEventListener('resize', maal);

    return () => {
      if (ventende) clearTimeout(ventende);
      document.removeEventListener('focusin', ind);
      document.removeEventListener('focusout', ud);
      window.removeEventListener('resize', maal);
      vv?.removeEventListener('resize', maal);
    };
  }, []);

  return skjulBundnav({ fokusISkrivefelt: fokus, tastatur, beroering: erBeroering(), lukketUdenBlur });
}

// Holder siden selv rullet helt op, mens `aktiv` er sand.
//
// Mobilskallen og arkene står allerede efter det synlige felt: skallen er lige
// så høj som det (useSynligHoejde), og arket lægges præcis over det
// (useSynligtFelt). Får et felt langt nede fokus, ruller iOS desuden selve
// siden (`window.scrollY`) for at få det fri af tastaturet — og så er
// tastaturet regnet med to gange: laget er gjort lavere *og* skubbet op. Arkets
// top ender under statuslinjen, bunden et godt stykke over tastaturet, og
// imellem står et tomt felt. Siden har aldrig noget at rulle — indholdet
// ruller inde i skallen og arket — så den rulles tilbage, hver gang iOS har
// flyttet den, og feltet rulles frem indefra i stedet (Ark.tsx og Skal.tsx).
export function useHoldSidenStille(aktiv: boolean): void {
  useEffect(() => {
    if (!aktiv) return;
    const vv = window.visualViewport;
    const tilbage = () => {
      if (window.scrollY !== 0 || window.scrollX !== 0) window.scrollTo(0, 0);
    };

    tilbage();
    window.addEventListener('scroll', tilbage);
    vv?.addEventListener('resize', tilbage);
    vv?.addEventListener('scroll', tilbage);
    return () => {
      window.removeEventListener('scroll', tilbage);
      vv?.removeEventListener('resize', tilbage);
      vv?.removeEventListener('scroll', tilbage);
    };
  }, [aktiv]);
}

// En berøringsskærm, hvor et felt med fokus betyder et tastatur på skærmen.
function erBeroering(): boolean {
  if (typeof window === 'undefined') return false;
  const grov = typeof window.matchMedia === 'function' && window.matchMedia('(pointer: coarse)').matches;
  return grov || (typeof navigator !== 'undefined' && (navigator.maxTouchPoints ?? 0) > 0);
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
