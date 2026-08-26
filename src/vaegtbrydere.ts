import type { Gruppe, Item, Reference, Tur } from './db';
import { itemUidsPaaTur, turensTags } from './smartMotor';
import { erGodtVurderet, GODT } from './vurdering';

// Vægt-brydere: hvor kan sækken blive lettere?
//
// Vægt er noget af det gear overhovedet er lavet til at løse, og appen viser
// allerede totalen. Det her er skridtet videre: for hvert tungt stykke gear på
// turen, findes noget lettere i inventaret der kan det samme.
//
// Faren ved sådan et forslag er tåbeligheder — at foreslå en kniv i stedet for
// en sovepose, fordi de begge er tagget "bushcraft". Derfor er matchningen
// stram, og hvert forslag bærer sin egen begrundelse.

// Så meget lettere skal alternativet være, før det er værd at nævne. Under det
// er byttet ikke besværet værd.
export const MINDSTE_BESPARELSE = 0.2;

// Så mange tunge items kigges der på. Resten er ikke der vægten ligger.
const TOP = 5;

// Så mange alternativer pr. item. Er der flere, er det ikke et forslag
// længere — så er det en liste man skal igennem.
const MAKS_ALTERNATIVER = 3;

export interface Alternativ {
  item: Item;
  sparet_g: number;
  // Hvor stor en del af vægten der spares, 0-1.
  andel: number;
  // Tags de to har til fælles. Det er dem der gør dem sammenlignelige.
  faelles: string[];
}

export interface Vaegtbryder {
  tung: Item;
  alternativer: Alternativ[];
  begrundelse: string;
}

// Kandidater til at erstatte ét stykke gear.
//
// Kravene er med vilje strenge: samme slags ting (mindst ét fælles tag), ejet,
// ikke allerede med på turen, og mærkbart lettere. Et forslag man må afvise
// hver gang, er værre end intet forslag.
export function alternativerTil(
  tung: Item,
  inventar: Item[],
  paaTuren: Set<Reference>
): Alternativ[] {
  if (tung.tags.length === 0 || tung.vaegt_g <= 0) return [];

  const graense = tung.vaegt_g * (1 - MINDSTE_BESPARELSE);

  return inventar
    .filter((i) => i.uid !== tung.uid)
    .filter((i) => i.status === 'ejer')
    .filter((i) => !paaTuren.has(i.uid))
    .filter((i) => i.vaegt_g > 0 && i.vaegt_g <= graense)
    .map((item) => ({
      item,
      sparet_g: tung.vaegt_g - item.vaegt_g,
      andel: (tung.vaegt_g - item.vaegt_g) / tung.vaegt_g,
      faelles: item.tags.filter((t) => tung.tags.includes(t))
    }))
    .filter((a) => a.faelles.length > 0)
    // Mest sparet først; ved uafgjort vinder den der ligner mest.
    .sort((a, b) => (b.sparet_g - a.sparet_g) || (b.faelles.length - a.faelles.length))
    .slice(0, MAKS_ALTERNATIVER);
}

// De tungeste stykker gear på turen der har et lettere alternativ i skabet.
export function vaegtbrydere(
  tur: Tur,
  grupper: Gruppe[],
  inventar: Item[],
  pakItems: Item[]
): Vaegtbryder[] {
  const paaTuren = itemUidsPaaTur(tur, grupper);

  return [...pakItems]
    // Grej man har sagt god for, foreslås ikke skiftet ud. Det er det ene
    // sted, hvor vurderingen betyder noget for et forslag: appen kender
    // ellers kun tags og gram, og på de to alene ligner en sovepose man
    // fryser i og en man sover godt i hinanden.
    .filter((i) => !erGodtVurderet(i))
    .sort((a, b) => b.vaegt_g - a.vaegt_g)
    .slice(0, TOP)
    .map((tung) => ({ tung, alternativer: alternativerTil(tung, inventar, paaTuren) }))
    .filter((v) => v.alternativer.length > 0)
    .map(({ tung, alternativer }) => ({
      tung,
      alternativer,
      begrundelse: `${tung.navn} er blandt de tungeste på turen. ${alternativer.length === 1 ? 'Et andet stykke gear' : `${alternativer.length} andre stykker gear`} i dit inventar deler mindst ét tag med den og vejer mindst ${Math.round(MINDSTE_BESPARELSE * 100)} % mindre. Om de faktisk kan det samme, er dit valg — motoren kender kun tags, gram og din egen vurdering: har du givet noget ${GODT} stjerner eller mere, holder den op med at foreslå at skifte det ud.`
    }));
}

// Hvor meget der kunne spares, hvis man tog det bedste bytte hver gang.
export function samletBesparelse(brydere: Vaegtbryder[]): number {
  return brydere.reduce((sum, b) => sum + (b.alternativer[0]?.sparet_g ?? 0), 0);
}

// ─────────────────────────────────────────────
// Manglende tags
// ─────────────────────────────────────────────

// De af turens kendetegn som ingen gruppe er tagget med.
//
// Det løser en fejl man ellers aldrig opdager: "motoren foreslår aldrig noget
// til kanoture" — fordi ingen gruppe har tagget "kano". Motoren tier, og man
// tror den ikke har noget at sige.
export function manglendeTags(tur: Tur, grupper: Gruppe[]): string[] {
  const iBrug = new Set(grupper.flatMap((g) => g.tags));
  return [...turensTags(tur)].filter((t) => !iBrug.has(t));
}
