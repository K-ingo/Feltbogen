import type { Item } from './db';

// Lagersted: hvor grejet står, når det ikke er på tur.
//
// Ét felt og tre faste værdier, og bevidst ikke mere. Den fulde udgave —
// flere inventarer, flyt mellem skabe, antal pr. sted — gør Grej-listen
// sværere at overskue for den, der bare vil vide, om soveposen står i hytten.
// Har man ét stykke grej to steder, opretter man det to gange.
//
// Lagersted er ikke et tursted. Steder (`steder.ts`) er dér, man tager hen;
// lagerstedet er dér, grejet venter. De to deler hverken tabel, felt eller
// ord, og en tur på "Hytten" har intet med grej med lagersted hytte at gøre.
//
// Værdierne gemmes uden æ/ø/å som de andre nøgler. Ikke sat er null lokalt
// og en tom streng i PocketBase. Ældre poster har feltet slet ikke — læs det
// altid gennem `lagerstedFor`.

export const LAGERSTED = ['hjem', 'hytte', 'bil'] as const;
export type Lagersted = (typeof LAGERSTED)[number];

// Filteret på Grej-listen: et bestemt sted, grej uden sted, eller det hele.
export type LagerstedFilter = Lagersted | 'ikke_sat' | 'alle';

const NAVNE: Record<Lagersted, string> = {
  hjem: 'Hjem',
  hytte: 'Hytte',
  bil: 'Bil'
};

export function lagerstedNavn(sted: Lagersted | 'ikke_sat'): string {
  return sted === 'ikke_sat' ? 'Ikke sat' : NAVNE[sted];
}

// Alt der ikke er en af de tre kendte værdier, er ikke sat. Et ukendt ord fra
// serveren skal ikke blive til et fjerde sted, man ikke kan vælge igen.
export function gyldigtLagersted(vaerdi: unknown): Lagersted | null {
  return typeof vaerdi === 'string' && (LAGERSTED as readonly string[]).includes(vaerdi)
    ? (vaerdi as Lagersted)
    : null;
}

export function lagerstedFor(item: Pick<Item, 'lagersted'>): Lagersted | null {
  return gyldigtLagersted(item.lagersted);
}

// Til listerne: "Hytte", eller tom streng når grejet ikke har et sted.
export function lagerstedTekst(item: Pick<Item, 'lagersted'>): string {
  const sted = lagerstedFor(item);
  return sted ? NAVNE[sted] : '';
}

export function iLagersted<T extends Pick<Item, 'lagersted'>>(items: T[], filter: LagerstedFilter): T[] {
  if (filter === 'alle') return items;
  return items.filter((i) => (lagerstedFor(i) ?? 'ikke_sat') === filter);
}

// De valg, filteret skal vise: kun de steder, der faktisk har grej, i fast
// rækkefølge — og "Ikke sat" til sidst, hvis noget mangler et sted. Har intet
// grej et lagersted, er listen tom, og filteret vises slet ikke: den, der
// ikke bruger feltet, skal ikke have en række chips mere at se på.
export function lagerstedValg(items: Pick<Item, 'lagersted'>[]): (Lagersted | 'ikke_sat')[] {
  const brugte = new Set(items.map(lagerstedFor));
  const steder = LAGERSTED.filter((s) => brugte.has(s));
  if (steder.length === 0) return [];
  return brugte.has(null) ? [...steder, 'ikke_sat'] : steder;
}
