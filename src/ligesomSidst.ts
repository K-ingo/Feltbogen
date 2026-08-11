import type { Gruppe, Item, Reference, Tur } from './db';
import { etiket } from './db';
import { itemUidsPaaTur } from './smartMotor';

// "Ligesom sidst": kopiér grejet fra en tidligere tur der lignede.
//
// Det er en turskabelon uden at bygge en skabelonstruktur — de gamle ture er
// allerede skabelonerne. Forslaget kræver et tryk og skubbes ikke i hovedet på
// nogen: motoren er rådgiver og ikke automat.

// Så mange forslag vises. Er den bedste ikke iblandt de tre, er matchningen
// alligevel ikke god nok til at man skulle kopiere derfra.
const MAKS_FORSLAG = 3;

// Under det er turene ikke ens nok til at grejet siger noget.
const MINDSTE_SCORE = 2;

// Kendetegnene der sammenlignes, med deres vægt. Overnatningen er den
// vigtigste: den afgør det tungeste grej. Antal personer er det løseste — man
// kan sagtens tage det samme med til to som til tre.
const KENDETEGN = [
  { navn: 'overnatning', vaegt: 2, af: (t: Tur) => etiket(t.overnatning) },
  { navn: 'terræn', vaegt: 1, af: (t: Tur) => etiket(t.terraen) },
  { navn: 'aktivitet', vaegt: 1, af: (t: Tur) => etiket(t.aktivitet) },
  { navn: 'årstid', vaegt: 1, af: (t: Tur) => aarstid(t.startdato) },
  { navn: 'selskab', vaegt: 1, af: (t: Tur) => (t.personer > 1 ? 'flere' : 'solo') }
] as const;

const MAKS_SCORE = KENDETEGN.reduce((s, k) => s + k.vaegt, 0);

export interface Kopiforslag {
  tur: Tur;
  score: number;
  maks: number;
  // De kendetegn der matchede, skrevet ud.
  traf: string[];
  antalItems: number;
  begrundelse: string;
}

// Tidligere ture der ligner denne, bedste match først.
//
// Kun ture med grej på tæller — en tom tur er ikke en skabelon. Og turen selv
// holdes ude, uanset hvor godt den matcher sig selv.
export function foreslaaKopi(
  ny: Tur,
  gamle: Tur[],
  grupper: Gruppe[]
): Kopiforslag[] {
  return gamle
    .filter((t) => t.uid !== ny.uid)
    .map((tur) => {
      const traf = KENDETEGN.filter((k) => k.af(tur) === k.af(ny));
      const score = traf.reduce((s, k) => s + k.vaegt, 0);
      const antalItems = itemUidsPaaTur(tur, grupper).size;

      return {
        tur,
        score,
        maks: MAKS_SCORE,
        traf: traf.map((k) => `${k.navn}: ${k.af(ny)}`),
        antalItems,
        begrundelse: `${tur.navn || 'Turen'} matcher på ${traf.map((k) => k.navn).join(', ')}. Motoren sammenligner ${KENDETEGN.length} kendetegn og vægter overnatningen tungest, fordi den afgør det tungeste grej. Den ved ikke om turene føltes ens — det gør du.`
      };
    })
    .filter((f) => f.score >= MINDSTE_SCORE && f.antalItems > 0)
    .sort((a, b) => (b.score - a.score) || (b.tur.startdato || '').localeCompare(a.tur.startdato || ''))
    .slice(0, MAKS_FORSLAG);
}

// Grejet fra den gamle tur, lagt oven i det der allerede er valgt.
//
// Grupperne følger med som grupper og ikke som løse items: det er sådan de
// blev valgt, og så følger de med hvis gruppen senere ændrer sig.
export interface Kopi {
  gruppe_ids: Reference[];
  loese_item_ids: Reference[];
}

export function kopierGrej(fra: Tur, til: Tur): Kopi {
  const nyeGrupper = fra.gruppe_ids.filter((g) => !til.gruppe_ids.includes(g));
  const nyeLoese = fra.loese_item_ids.filter((i) => !til.loese_item_ids.includes(i));

  return {
    gruppe_ids: [...til.gruppe_ids, ...nyeGrupper],
    loese_item_ids: [...til.loese_item_ids, ...nyeLoese]
  };
}

// Hvor meget der reelt kommer til. Bruges til at skrive "tilføjer 12 stykker
// gear" på knappen frem for at lade folk gætte.
export function antalNye(fra: Tur, til: Tur, grupper: Gruppe[], items: Item[]): number {
  const kopi = kopierGrej(fra, til);
  const foer = itemUidsPaaTur(til, grupper);
  const efter = itemUidsPaaTur({ ...til, ...kopi }, grupper);

  // Items der ikke findes i inventaret længere, skal ikke tælles med.
  const kendte = new Set(items.map((i) => i.uid));
  return [...efter].filter((uid) => !foer.has(uid) && kendte.has(uid)).length;
}

// Årstiden efter måned. Groft, men det er også groft man pakker efter —
// december og januar kræver det samme.
export function aarstid(dato: string): string {
  if (!dato) return 'ukendt';

  const d = new Date(dato);
  if (Number.isNaN(d.getTime())) return 'ukendt';

  const m = d.getMonth();
  if (m <= 1 || m === 11) return 'vinter';
  if (m <= 4) return 'forår';
  if (m <= 7) return 'sommer';
  return 'efterår';
}
