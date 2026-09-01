import { useEffect, useState } from 'react';
import type { Genskab } from './sync';

// Fortryd.
//
// Handlingen er allerede sket, når den meldes her — se `slet()` i sync.ts og
// `afvisForslag()` i afviste.ts. Det her er kun vinduet, hvor man kan komme
// tilbage fra den.
//
// Den begyndte som fortryd-sletning og hed det også. Den holdt op med at være
// det, da et "nej tak" til smart-motoren begyndte at blive husket: en
// afvisning er ikke en sletning, men den er lige så let at komme til, og der
// skal være en vej tilbage fra den på samme måde. Så det, der før var
// sletningens ord, er nu et felt — se `gjort`.
//
// Tilstanden ligger uden for React, fordi den skal overleve at skærmen der
// slettede, lukker sig selv i samme åndedrag. En detaljeskærm kan ikke vise
// sin egen fortrydelse: den er væk inden den nåede at tegne den.

// 25 sekunder. Længe nok til at nå at fortryde noget man ikke mente, kort nok
// til at beskeden ikke bliver møbel.
export const FORTRYD_MS = 25_000;

export interface Fortrydelse {
  // Hvad det gik ud over, som sætningen begynder: "Gearet", "Turen",
  // "Forslaget".
  slags: string;
  navn: string;
  // Hvad der skete med det. Sletningen var det eneste, der kunne fortrydes
  // til at begynde med, og den er derfor standarden — men et afvist forslag
  // er ikke slettet, og beskeden må ikke sige, at det er væk for evigt.
  gjort?: string;
  // Følgen der er værd at vide bagefter — "3 ture mistede koblingen". Den
  // stod før i bekræftelsesdialogen; nu hvor sletningen kan fortrydes, hører
  // den til i kvitteringen frem for i et spørgsmål stillet på forhånd.
  detalje?: string;
  genskab: Genskab;
}

// Den meldte fortrydelse, som skærmen får den. `nr` sættes her og tælles op
// for hver melding: to beskeder kan sagtens sige det samme — man kan slette
// to ting med samme navn, eller vinke to ens forslag af — og uden et nummer
// ville den anden besked overtage den førstes nedtælling i stedet for at
// begynde forfra.
export interface Meldt extends Fortrydelse {
  nr: number;
}

// Kun én ad gangen. To beskeder oven på hinanden er værre end at den forrige
// forsvinder — og at slette to ting hurtigt efter hinanden er sjældnere end
// at læse én besked forkert.
let aktuel: Meldt | null = null;
let ur: ReturnType<typeof setTimeout> | null = null;
let nummer = 0;
const lyttere = new Set<() => void>();

function udsend(): void {
  for (const lyt of lyttere) lyt();
}

export function afvisFortrydelse(): void {
  if (ur) clearTimeout(ur);
  ur = null;
  aktuel = null;
  udsend();
}

export function meldFortrydelse(f: Fortrydelse): void {
  if (ur) clearTimeout(ur);
  aktuel = { ...f, nr: ++nummer };
  ur = setTimeout(afvisFortrydelse, FORTRYD_MS);
  udsend();
}

// Beskeden lukkes før genskabelsen, ikke efter: trykket skal føles besvaret
// med det samme, og et andet tryk må ikke nå at lægge posten tilbage to gange.
export async function fortryd(): Promise<void> {
  const f = aktuel;
  afvisFortrydelse();
  await f?.genskab();
}

// Navnløse poster findes — man kan nå at slette en tur inden den fik et navn.
// Så siger beskeden bare hvad slagsen var.
export function fortrydBesked(f: Fortrydelse): string {
  const navn = f.navn.trim();
  const gjort = f.gjort ?? 'slettet';
  return navn ? `${f.slags} "${navn}" er ${gjort}` : `${f.slags} er ${gjort}`;
}

// Den melding der står lige nu, uden en skærm. `useFortrydelse` er den
// almindelige vej ind; den her er for dem, der ikke er en komponent.
export function nuvaerendeFortrydelse(): Meldt | null {
  return aktuel;
}

export function useFortrydelse(): Meldt | null {
  const [f, setF] = useState(nuvaerendeFortrydelse);

  useEffect(() => {
    const lyt = () => setF(nuvaerendeFortrydelse);
    // Meldingen kan være nået at komme mellem første tegning og den her
    // effekt — så ville beskeden aldrig blive vist.
    lyt();
    lyttere.add(lyt);
    return () => { lyttere.delete(lyt); };
  }, []);

  return f;
}
