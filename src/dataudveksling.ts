import type { Item, Gruppe, Tur, Reference } from './db';

// Eksport og import af hele basen som én JSON-fil. Appen er offline-first, så
// en enhed der går tabt tager alt med sig hvis der ikke er en kopi.

export const KOPI_VERSION = 1;

export interface Sikkerhedskopi {
  version: number;
  lavet: string;
  items: Item[];
  grupper: Gruppe[];
  ture: Tur[];
}

export function lavSikkerhedskopi(items: Item[], grupper: Gruppe[], ture: Tur[]): Sikkerhedskopi {
  return {
    version: KOPI_VERSION,
    lavet: new Date().toISOString(),
    // id er lokalt for den enhed kopien blev lavet på, og pb_id peger på en
    // record der måske ikke findes mere. Kun uid følger med — det er
    // identiteten på tværs af enheder.
    items: items.map(uden),
    grupper: grupper.map(uden),
    ture: ture.map(uden)
  };
}

function uden<T extends { id?: number; pb_id?: string }>(post: T): T {
  const { id, pb_id, ...resten } = post;
  void id;
  void pb_id;
  return resten as T;
}

export function tilJson(kopi: Sikkerhedskopi): string {
  return JSON.stringify(kopi, null, 2);
}

export class KopiFejl extends Error {}

// Filen kommer udefra, så intet i den kan tages for givet. Poster der ikke
// kan læses springes over frem for at vælte hele importen.
export function laesSikkerhedskopi(raa: string): Sikkerhedskopi {
  let data: unknown;
  try {
    data = JSON.parse(raa);
  } catch {
    throw new KopiFejl('Filen er ikke gyldig JSON.');
  }

  if (!data || typeof data !== 'object' || Array.isArray(data)) {
    throw new KopiFejl('Filen ligner ikke en sikkerhedskopi.');
  }

  const k = data as Record<string, unknown>;
  if (typeof k.version !== 'number') {
    throw new KopiFejl('Filen ligner ikke en sikkerhedskopi.');
  }
  if (k.version > KOPI_VERSION) {
    throw new KopiFejl(`Kopien er lavet med en nyere version (${k.version}). Opdatér appen først.`);
  }

  return {
    version: k.version,
    lavet: typeof k.lavet === 'string' ? k.lavet : '',
    items: laesPoster<Item>(k.items),
    grupper: laesPoster<Gruppe>(k.grupper),
    ture: laesPoster<Tur>(k.ture)
  };
}

function laesPoster<T extends { uid: Reference; oprettet: Date; aendret: Date }>(v: unknown): T[] {
  if (!Array.isArray(v)) return [];

  return v
    .filter((p): p is Record<string, unknown> => !!p && typeof p === 'object' && typeof p.uid === 'string' && p.uid !== '')
    .map((p) => ({
      ...p,
      // JSON har ingen datotype, så de kom ud som tekst og skal tilbage.
      oprettet: somDato(p.oprettet),
      aendret: somDato(p.aendret)
    }) as unknown as T);
}

function somDato(v: unknown): Date {
  const d = new Date(typeof v === 'string' || typeof v === 'number' ? v : NaN);
  return Number.isNaN(d.getTime()) ? new Date() : d;
}

export interface Fletteresultat {
  items: Item[];
  grupper: Gruppe[];
  ture: Tur[];
  tilfoejet: number;
  fandtes: number;
}

// Importen lægger til, den overskriver aldrig. En post der allerede findes —
// kendt på sit uid — springes over, så den samme kopi kan læses ind to gange
// uden at fordoble noget, og så en nyere lokal udgave ikke ryger.
export function fletInd(
  kopi: Sikkerhedskopi,
  eksisterende: { items: Item[]; grupper: Gruppe[]; ture: Tur[] }
): Fletteresultat {
  const items = nye(kopi.items, eksisterende.items);
  const grupper = nye(kopi.grupper, eksisterende.grupper);
  const ture = nye(kopi.ture, eksisterende.ture);
  const tilfoejet = items.length + grupper.length + ture.length;

  return {
    items,
    grupper,
    ture,
    tilfoejet,
    fandtes: kopi.items.length + kopi.grupper.length + kopi.ture.length - tilfoejet
  };
}

function nye<T extends { uid: Reference; usendt_aendring?: boolean }>(fraKopi: T[], lokale: T[]): T[] {
  const kendte = new Set(lokale.map((p) => p.uid));
  const set = new Set<Reference>();

  return fraKopi
    .filter((p) => {
      // Kopien kan selv indeholde dubletter hvis den er lavet af en base der
      // gjorde — de skal ikke igennem.
      if (kendte.has(p.uid) || set.has(p.uid)) return false;
      set.add(p.uid);
      return true;
    })
    // Uden pb_id findes posten ikke på serveren endnu; markeringen sørger for
    // at den bliver sendt op ved næste synkronisering.
    .map((p) => ({ ...p, usendt_aendring: true }));
}

// "feltbogen-2026-07-31.json"
export function filnavn(nu: Date = new Date()): string {
  const to = (n: number) => String(n).padStart(2, '0');
  return `feltbogen-${nu.getFullYear()}-${to(nu.getMonth() + 1)}-${to(nu.getDate())}.json`;
}
