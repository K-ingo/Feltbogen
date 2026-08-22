import { useEffect, useState } from 'react';
import type { Genskab } from './sync';

// Fortryd sletning.
//
// Sletningen er allerede sket når den meldes her — se `slet()` i sync.ts.
// Det her er kun vinduet hvor man kan komme tilbage fra den.
//
// Tilstanden ligger uden for React, fordi den skal overleve at skærmen der
// slettede, lukker sig selv i samme åndedrag. En detaljeskærm kan ikke vise
// sin egen fortrydelse: den er væk inden den nåede at tegne den.

// 25 sekunder. Længe nok til at nå at fortryde en sletning man ikke mente,
// kort nok til at beskeden ikke bliver møbel.
export const FORTRYD_MS = 25_000;

export interface Fortrydelse {
  // Hvad der blev slettet, som sætningen begynder: "Gearet", "Turen".
  slags: string;
  navn: string;
  // Følgen der er værd at vide bagefter — "3 ture mistede koblingen". Den
  // stod før i bekræftelsesdialogen; nu hvor sletningen kan fortrydes, hører
  // den til i kvitteringen frem for i et spørgsmål stillet på forhånd.
  detalje?: string;
  genskab: Genskab;
}

// Kun én ad gangen. To beskeder oven på hinanden er værre end at den forrige
// forsvinder — og at slette to ting hurtigt efter hinanden er sjældnere end
// at læse én besked forkert.
let aktuel: Fortrydelse | null = null;
let ur: ReturnType<typeof setTimeout> | null = null;
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

export function meldSletning(f: Fortrydelse): void {
  if (ur) clearTimeout(ur);
  aktuel = f;
  ur = setTimeout(afvisFortrydelse, FORTRYD_MS);
  udsend();
}

// Beskeden lukkes før genskabelsen, ikke efter: trykket skal føles besvaret
// med det samme, og et andet tryk må ikke nå at lægge posten tilbage to gange.
export async function fortrydSletning(): Promise<void> {
  const f = aktuel;
  afvisFortrydelse();
  await f?.genskab();
}

// Navnløse poster findes — man kan nå at slette en tur inden den fik et navn.
// Så siger beskeden bare hvad slagsen var.
export function fortrydBesked(f: Fortrydelse): string {
  const navn = f.navn.trim();
  return navn ? `${f.slags} "${navn}" er slettet` : `${f.slags} er slettet`;
}

export function useFortrydelse(): Fortrydelse | null {
  const [f, setF] = useState(aktuel);

  useEffect(() => {
    const lyt = () => setF(aktuel);
    // Meldingen kan være nået at komme mellem første tegning og den her
    // effekt — så ville beskeden aldrig blive vist.
    lyt();
    lyttere.add(lyt);
    return () => { lyttere.delete(lyt); };
  }, []);

  return f;
}
