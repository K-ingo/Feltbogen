import { useEffect, useRef, useState } from 'react';
import type { RefObject } from 'react';

// Fokus i dialoger og ark.
//
// Et lag over skærmen er kun et lag for den, der kan se det. For den, der
// bruger tastatur eller skærmlæser, er det et sted, fokus skal ind i, blive
// i og komme ud af igen — ellers står man og taber sig bag laget, og når det
// lukker, starter man forfra øverst på siden.
//
// Tre regler, samlet ét sted, så det næste lag ikke finder på sin egen:
//
//   1. Fokus flyttes ind, når laget åbner, og tilbage til udløseren, når det
//      lukker.
//   2. Tab og Shift+Tab bliver i laget (focus trap).
//   3. Escape lukker — men kun det øverste lag, hvis der ligger flere.

// Det, man kan tabbe sig hen til. Slukkede felter og knapper er ikke med:
// browseren springer dem selv over, og fælden skal tælle det samme.
const FOKUSERBARE = [
  'a[href]',
  'button:not([disabled])',
  'input:not([disabled]):not([type="hidden"])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[tabindex]:not([tabindex="-1"])'
].join(', ');

export function fokuserbare(rod: HTMLElement): HTMLElement[] {
  return Array.from(rod.querySelectorAll<HTMLElement>(FOKUSERBARE))
    .filter((el) => !el.closest('[aria-hidden="true"]'));
}

// Hvor fokus skal hen, når man trykker Tab fra `aktivt`. `null` betyder, at
// browseren selv må flytte det — det gør den rigtigt, så længe man ikke står
// ved en af kanterne. Ren funktion, så reglen kan testes uden en browser.
export function naesteIFaelde(
  elementer: readonly HTMLElement[],
  aktivt: Element | null,
  baglaens: boolean
): HTMLElement | null {
  if (elementer.length === 0) return null;
  const foerste = elementer[0];
  const sidste = elementer[elementer.length - 1];
  const plads = aktivt ? elementer.indexOf(aktivt as HTMLElement) : -1;
  // Står fokus uden for de fokuserbare (på selve laget, fx), går Tab til den
  // første og Shift+Tab til den sidste.
  if (plads === -1) return baglaens ? sidste : foerste;
  if (baglaens && plads === 0) return sidste;
  if (!baglaens && plads === elementer.length - 1) return foerste;
  return null;
}

// Lagene, der er åbne lige nu, nederst først. Kun det øverste svarer på
// Escape og fanger Tab.
interface AabentLag { id: symbol; rod: HTMLElement | null }
const aabneLag: AabentLag[] = [];

// Et nyt lag lægges øverst — medmindre det indeholder et lag, der allerede er
// åbent. Monteres to lag på én gang, kører React barnets effekt før
// forælderens, og så ville forælderen ellers havne øverst og lukke på Escape i
// stedet for det lag, der står ovenpå.
function laegPaa(lag: AabentLag): boolean {
  const under = lag.rod
    ? aabneLag.findIndex((andet) => !!andet.rod && andet.rod !== lag.rod && lag.rod!.contains(andet.rod))
    : -1;
  if (under === -1) {
    aabneLag.push(lag);
    return true;
  }
  aabneLag.splice(under, 0, lag);
  return false;
}

// ── Udløseren ──────────────────────────────────
//
// Knappen, der åbnede laget, skal have fokus igen, når det lukker. To ting
// gør det sværere, end det lyder:
//
// * Nogle lag tegnes *i stedet for* skærmen og ikke ovenpå den (På tur
//   erstatter hele turskærmen). Når lagets effekt kører, er knappen allerede
//   fjernet, og fokus står på body. Udløseren fanges derfor, mens laget
//   tegnes — før React rører DOM'en.
// * Når laget lukker, tegnes skærmen igen, og knappen er et nyt element med
//   samme tekst. Den gamle er væk. Derfor gemmes en beskrivelse af knappen,
//   så den kan findes igen.
//
// Safari giver ikke en knap fokus, når man klikker på den. Så er det seneste
// klik det bedste bud på, hvad der åbnede laget.

interface Udloeser {
  el: HTMLElement;
  tag: string;
  tekst: string;
  // Hvilken af knapperne med samme tekst, det var — der kan stå to "Luk".
  nr: number;
}

const KLIKBAR = 'button, a[href], [role="button"], input, select, textarea, [tabindex]';
let sidsteKlik: { el: HTMLElement; tid: number } | null = null;

if (typeof document !== 'undefined') {
  document.addEventListener('click', (e) => {
    const el = e.target instanceof Element ? e.target.closest<HTMLElement>(KLIKBAR) : null;
    if (el) sidsteKlik = { el, tid: Date.now() };
  }, true);
}

function tekstAf(el: Element): string {
  return (el.getAttribute('aria-label') ?? el.textContent ?? '').replace(/\s+/g, ' ').trim();
}

function kandidater(tag: string, tekst: string): HTMLElement[] {
  return Array.from(document.querySelectorAll<HTMLElement>(tag)).filter((el) => tekstAf(el) === tekst);
}

export function fangUdloeser(): Udloeser | null {
  const aktivt = document.activeElement;
  let el: HTMLElement | null =
    aktivt instanceof HTMLElement && aktivt !== document.body ? aktivt : null;
  // Et klik inden for de sidste sekunder. Åbningen kan vente på et skriv i
  // basen (På tur sikrer afgangstjekket først), så ikke kun samme øjeblik.
  if (!el && sidsteKlik && Date.now() - sidsteKlik.tid < 5000) el = sidsteKlik.el;
  if (!el) return null;
  const tag = el.tagName.toLowerCase();
  const tekst = tekstAf(el);
  const nr = el.isConnected ? Math.max(0, kandidater(tag, tekst).indexOf(el)) : 0;
  return { el, tag, tekst, nr };
}

// Det element, udløseren er nu: det samme, hvis det stadig står der, ellers
// et nyt med samme slags og tekst. Uden tekst er der intet at genkende på.
export function genfind(u: Udloeser): HTMLElement | null {
  if (u.el.isConnected) return u.el;
  if (!u.tekst) return null;
  const fundne = kandidater(u.tag, u.tekst);
  return fundne[u.nr] ?? fundne[0] ?? null;
}

// Fokus står ingen steder, når laget, der havde det, lige er fjernet. Har
// noget andet taget det i mellemtiden — en ny skærm med autofokus — skal det
// blive der.
function fokusErLedigt(): boolean {
  const a = document.activeElement;
  return !a || a === document.body || !a.isConnected;
}

function giveTilbage(u: Udloeser | null): void {
  if (!u) return;
  if (u.el.isConnected) {
    u.el.focus();
    return;
  }
  // Skærmen bag laget tegnes i samme omgang, som laget fjernes — men data,
  // der hentes fra basen, kan komme et øjeblik efter. Så prøves der et par
  // gange til.
  let tilbage = 10;
  const forsoeg = () => {
    if (!fokusErLedigt()) return;
    const el = genfind(u);
    if (el) el.focus();
    else if (tilbage-- > 0) setTimeout(forsoeg, 50);
  };
  forsoeg();
}

export interface DialogFokusValg {
  // Hvad der får fokus ved åbning. `felt`: det første felt, ellers den første
  // knap — et opret-ark åbner, fordi man skal skrive noget. `rod`: selve
  // laget, til skærme hvor det første felt står langt nede, og hvor fokus
  // dér ville rulle skærmen væk fra toppen. Laget skal da have tabIndex={-1}.
  foerst?: 'felt' | 'rod';
}

export function useDialogFokus(
  rodRef: RefObject<HTMLElement | null>,
  luk: () => void,
  { foerst = 'felt' }: DialogFokusValg = {}
): void {
  // `luk` er ofte en ny pil ved hver tegning. Står den i effektens
  // afhængigheder, åbner laget "igen" ved hvert tastetryk og stjæler fokus.
  const lukRef = useRef(luk);
  useEffect(() => { lukRef.current = luk; }, [luk]);

  // Fanges under første tegning, ikke i effekten. Se "Udløseren" ovenfor.
  const [udloeser] = useState(fangUdloeser);

  useEffect(() => {
    const id = Symbol('dialog');
    const rod = rodRef.current;
    const oeverst = laegPaa({ id, rod });

    // Ligger laget under et andet, har det øverste allerede taget fokus.
    if (rod && oeverst) {
      const maal = foerst === 'rod'
        ? rod
        : rod.querySelector<HTMLElement>('input:not([disabled]), textarea:not([disabled]), select:not([disabled])')
          ?? fokuserbare(rod)[0]
          ?? rod;
      maal.focus();
    }

    const paaTast = (e: KeyboardEvent) => {
      if (aabneLag[aabneLag.length - 1]?.id !== id) return;
      if (e.key === 'Escape') {
        e.preventDefault();
        lukRef.current();
        return;
      }
      if (e.key !== 'Tab') return;
      const nu = rodRef.current;
      if (!nu) return;
      const elementer = fokuserbare(nu);
      if (elementer.length === 0) {
        // Intet at tabbe til: fokus bliver på laget.
        e.preventDefault();
        return;
      }
      const naeste = naesteIFaelde(elementer, document.activeElement, e.shiftKey);
      if (naeste) {
        e.preventDefault();
        naeste.focus();
      }
    };
    document.addEventListener('keydown', paaTast);

    return () => {
      document.removeEventListener('keydown', paaTast);
      const plads = aabneLag.findIndex((lag) => lag.id === id);
      if (plads !== -1) aabneLag.splice(plads, 1);
      // Tilbage hvor man kom fra — den samme knap, eller den samme knap
      // tegnet igen. Findes den ikke længere (man oprettede en tur og står nu
      // på den), må fokus blive, hvor den nye skærm sætter det.
      giveTilbage(udloeser);
    };
    // Kun ved åbning og lukning. `foerst` ændrer sig ikke, mens laget er åbent.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
}
