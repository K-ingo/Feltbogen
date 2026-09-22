import type { Gruppe, Item, Reference, Sted, Tur } from './db';
import { etiket } from './db';
import { aarMedTure } from './aarsopgoerelse';
import { itemUidsPaaTur } from './smartMotor';

// Friluftshistorikken: Steder og Statistik som ét regnestykke.
//
// De to skærme spurgte om det samme — hvor har jeg været, og hvad blev det
// til — men regnede hver for sig, og kunne derfor sige hver sit. Mere-rækken
// talte de gemte steder og sagde "0", mens Steder-skærmen stod med tre steder
// fra turene. Her ligger begge tal, udledt af de samme ture.
//
// Alt herinde er rene funktioner over de lister, skærmen alligevel har hentet.
// Se docs/design/desktop/09-steder-statistik.html.

// Året man ser på. 'alle' er hele historikken.
export type Aarsvalg = number | 'alle';

// Så mange årstal står i vælgeren ved siden af "Alle år". Referencen tegner
// ét år og "Alle år"; flere end to gør rækken til en liste, og de ældre år
// hører til i årsopgørelsen, hvor de fortælles ud.
export const MAKS_AAR_I_VAELGEREN = 2;

export function aarAf(dato: string): number | null {
  if (!dato) return null;
  const d = new Date(dato);
  return Number.isNaN(d.getTime()) ? null : d.getFullYear();
}

export function tureIAarsvalg(ture: Tur[], valg: Aarsvalg): Tur[] {
  if (valg === 'alle') return ture;
  return ture.filter((t) => aarAf(t.startdato) === valg);
}

// Årene i vælgeren, nyeste først, med "Alle år" til sidst. Har man ingen ture
// endnu, står indeværende år der alligevel — en vælger uden valg ser ud som
// en fejl, og året er rigtigt, det er bare tomt.
export function aarsvalgMuligheder(ture: Tur[], nu: Date = new Date()): Aarsvalg[] {
  const aar = aarMedTure(ture).slice(0, MAKS_AAR_I_VAELGEREN);
  return [...(aar.length > 0 ? aar : [nu.getFullYear()]), 'alle'];
}

// ─────────────────────────────────────────────
// Stederne, som turene kender dem
// ─────────────────────────────────────────────

export interface Turstede {
  // Stedets uid, når turen er koblet til et gemt sted — ellers den fritekst,
  // turen har stået med, i småt. To ture, der har skrevet "Fovslet Skov" og
  // "fovslet skov", har været det samme sted.
  noegle: string;
  navn: string;
  adresse: string;
  // Uid på det gemte sted, når der er et. Tom betyder: kun fritekst endnu.
  gemt_uid: Reference;
  // Det lokale id, så kortet kan åbne stedets detalje. null når stedet endnu
  // kun findes som tekst på turene.
  gemt_id: number | null;
  tags: string[];
  ture: number;
  naetter: number;
  // Kladder tæller med — man har været der — men det skal stå, at turen ikke
  // er gjort færdig. Ellers ser et halvt udfyldt udkast ud som en opgørelse.
  kladder: number;
  sidste_start: string;
  sidste_slut: string;
  // Turene bag stedet. "Gem" kobler dem til det sted, den laver, så stedets
  // detalje kender sin egen historik.
  tur_ids: number[];
}

// Stederne, turene har været på — både de gemte og dem, der kun står som
// fritekst. Det er dét tal, "Fra dine ture" siger, og det er derfor ikke nul,
// bare fordi man ikke har gemt noget endnu.
export function stederFraTure(ture: Tur[], steder: Sted[]): Turstede[] {
  const stedPrUid = new Map(steder.map((s) => [s.uid, s]));
  const samlet = new Map<string, Turstede>();

  // Nyeste først, så "sidst" og navnet kommer fra den seneste tur: har man
  // rettet stavemåden undervejs, er det den nye, man kender stedet på.
  const efterDato = [...ture].sort((a, b) => (b.startdato || '').localeCompare(a.startdato || ''));

  for (const tur of efterDato) {
    const gemt = tur.sted_uid ? stedPrUid.get(tur.sted_uid) : undefined;
    const fritekst = tur.sted.trim();

    // Hverken et gemt sted eller en tekst: turen siger ikke hvor den var, og
    // et sted uden navn er ikke et sted.
    if (!gemt && !fritekst) continue;

    const noegle = gemt ? gemt.uid : fritekst.toLowerCase();
    const kendt = samlet.get(noegle);

    if (kendt) {
      kendt.ture += 1;
      kendt.naetter += tur.naetter;
      if (tur.status === 'kladde') kendt.kladder += 1;
      if (tur.id !== undefined) kendt.tur_ids.push(tur.id);
      continue;
    }

    samlet.set(noegle, {
      noegle,
      navn: gemt?.navn.trim() || fritekst || 'Uden navn',
      adresse: gemt?.adresse ?? '',
      gemt_uid: gemt?.uid ?? '',
      gemt_id: gemt?.id ?? null,
      tags: gemt && gemt.tags.length > 0 ? [...gemt.tags] : turtags(tur),
      ture: 1,
      naetter: tur.naetter,
      kladder: tur.status === 'kladde' ? 1 : 0,
      sidste_start: tur.startdato,
      sidste_slut: tur.slutdato,
      tur_ids: tur.id !== undefined ? [tur.id] : []
    });
  }

  // Det sted man kommer igen, står øverst. Derefter det man var på senest —
  // et enkelt besøg i sidste uge er tættere på end et enkelt besøg i 2019.
  return [...samlet.values()].sort((a, b) =>
    b.ture - a.ture
    || (b.sidste_start || '').localeCompare(a.sidste_start || '')
    || a.navn.localeCompare(b.navn, 'da'));
}

// Mærkaterne på et sted, der ikke har sine egne endnu: hvad man lavede, og
// hvad man stod i. Det er turens egne svar — ikke noget, appen gætter.
function turtags(tur: Tur): string[] {
  return [...new Set([etiket(tur.aktivitet), etiket(tur.terraen)])].map(stortForbogstav);
}

function stortForbogstav(ord: string): string {
  return ord ? ord[0].toUpperCase() + ord.slice(1) : ord;
}

// ─────────────────────────────────────────────
// Tallene
// ─────────────────────────────────────────────

export interface Historiktal {
  ture: number;
  naetter: number;
  // Grejet i bogen er det, man ejer nu. Det følger ikke året: en sovepose,
  // man købte i fjor, ligger der stadig.
  grej: number;
  vaegt_g: number;
}

export function historiktal(ture: Tur[], items: Item[]): Historiktal {
  const ejet = items.filter((i) => i.status === 'ejer');

  return {
    ture: ture.length,
    naetter: ture.reduce((sum, t) => sum + t.naetter, 0),
    grej: ejet.length,
    vaegt_g: ejet.reduce((sum, i) => sum + i.vaegt_g * i.antal, 0)
  };
}

export interface Maanedstal {
  // 0-11, som Date selv tæller dem.
  maaned: number;
  naetter: number;
  ture: number;
}

// Nætterne fordelt på måneder. Kun de måneder, man faktisk var ude i — tolv
// søjler, hvor de ni er tomme, siger mest om de ni.
//
// Den måned, der blev flest nætter af, står øverst. Det er en optælling og
// ikke en tidslinje: spørgsmålet er hvornår man kommer ud, ikke hvad der
// skete i hvilken rækkefølge.
export function naetterPrMaaned(ture: Tur[]): Maanedstal[] {
  const pr = new Map<number, Maanedstal>();

  for (const tur of ture) {
    const maaned = maanedAf(tur.startdato);
    if (maaned === null) continue;

    const kendt = pr.get(maaned) ?? { maaned, naetter: 0, ture: 0 };
    kendt.naetter += tur.naetter;
    kendt.ture += 1;
    pr.set(maaned, kendt);
  }

  return [...pr.values()].sort((a, b) => b.naetter - a.naetter || a.maaned - b.maaned);
}

function maanedAf(dato: string): number | null {
  if (!dato) return null;
  const d = new Date(dato);
  return Number.isNaN(d.getTime()) ? null : d.getMonth();
}

// Det grej man ejer, som ikke har været med på nogen af turene. Linjen
// "Resten — aldrig brugt endnu" står kun, når der faktisk er en rest.
export function aldrigBrugt(items: Item[], ture: Tur[], grupper: Gruppe[]): number {
  const brugte = new Set<Reference>();
  ture.forEach((tur) => itemUidsPaaTur(tur, grupper).forEach((uid) => brugte.add(uid)));

  return items.filter((i) => i.status === 'ejer' && !brugte.has(i.uid)).length;
}
