// Om et element er et sted, man skriver — og dermed et sted, hvor telefonens
// tastatur kommer frem.
//
// Bruges af mobilskallen til at gemme bundnavigationen, mens man skriver. Uden
// den krymper skallen med tastaturet (den er lige så høj som det synlige
// felt), og så lægger navigationen sig lige over tastaturet og dækker det
// felt, man står i.
//
// Afkrydsning, radioknapper, skydere, farve- og filvalg giver intet tastatur,
// og de skal ikke få navigationen til at forsvinde. Det samme gælder dato og
// tid: iOS viser et hjul eller en kalender, der ikke skubber siden.
const INGEN_TASTATUR = new Set([
  'checkbox', 'radio', 'range', 'color', 'file', 'button', 'submit', 'reset',
  'image', 'hidden', 'date', 'datetime-local', 'month', 'week', 'time'
]);

export function erSkrivefelt(el: Element | null | undefined): boolean {
  if (!el || !(el instanceof HTMLElement)) return false;
  if (el instanceof HTMLTextAreaElement) return !el.readOnly && !el.disabled;
  if (el instanceof HTMLInputElement) {
    return !INGEN_TASTATUR.has(el.type) && !el.readOnly && !el.disabled;
  }
  return el.isContentEditable || el.getAttribute('contenteditable') === 'true'
    || el.getAttribute('contenteditable') === '';
}

// Mere end det her skåret af det synlige felt er et tastatur og ikke en
// adresselinje, der folder sig ud. Samme tal som i useMedie.ts.
export const TASTATUR_FRA = 120;

// Om tastaturet ser ud til at være fremme, ud fra den højeste højde, det
// synlige felt har haft i den her bredde, og den højde det har nu.
//
// Ikke `innerHeight - visualViewport.height`: på iOS bliver innerHeight
// stående, men på Android krymper den med tastaturet, og så er forskellen nul.
// Den højeste højde, man har set, er det fælles nulpunkt for begge.
export function tastaturFremme(hoejesteHoejde: number, hoejdeNu: number): boolean {
  return hoejesteHoejde - hoejdeNu > TASTATUR_FRA;
}

// Om bundnavigationen skal gemmes.
//
// Fokus i et skrivefelt er det hurtige signal: det kommer, før tastaturet er
// fremme, så navigationen ikke når at stå over tastaturet under animationen.
// Det gælder kun på en berøringsskærm — på en smal PC-browser med mus kommer
// der intet tastatur frem, og så skal navigationen blive stående.
//
// Det synlige felt er det sikre signal, og det dækker to huller: et tastatur,
// der er fremme uden at fokus kom fra et focusin (fx efter et tryk i et felt,
// der allerede havde fokus), og et tastatur, der er lukket, mens feltet
// beholder fokus — Android's tilbage-knap gør præcis det.
export function skjulBundnav({ fokusISkrivefelt, tastatur, beroering, lukketUdenBlur }: {
  fokusISkrivefelt: boolean;
  tastatur: boolean;
  beroering: boolean;
  lukketUdenBlur: boolean;
}): boolean {
  if (!fokusISkrivefelt) return false;
  if (tastatur) return true;
  return beroering && !lukketUdenBlur;
}
