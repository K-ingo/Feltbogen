import type { Item, Gruppe, Tur, Sted, Person, Reference, Billede } from './db';

// Eksport og import af kernedata som én JSON-fil — billederne med.

// v2 tog steder og personer med. v3 tager billederne med, selve filerne
// indkodet som data-URL'er (base64), så én fil er hele kopien. En v1- eller
// v2-fil kan stadig læses: de lister den ikke havde, er bare tomme, hvilket er
// den rigtige værdi for en base der ikke havde dem.
export const KOPI_VERSION = 3;

// Alt der er i en kopi. Samlet ét sted, så en ny tabel ikke kan blive glemt i
// den ene af de to retninger.
export interface Baseindhold {
  items: Item[];
  grupper: Gruppe[];
  ture: Tur[];
  steder: Sted[];
  personer: Person[];
}

// Et billede som det står i kopien. Blobs kan ikke stå i JSON, så filerne
// står som data-URL'er: `data` er visningskopien, `original_data` originalen,
// hvis den stadig lå på enheden (den ryddes, når den er nået op — se db.ts).
// Tom tekst betyder, at filen ikke var med; så er `url` det eneste spor.
export interface KopiBillede extends Omit<Billede, 'id' | 'pb_id' | 'blob' | 'original_blob' | 'usendt_aendring'> {
  data: string;
  original_data: string;
}

export interface Sikkerhedskopi extends Baseindhold {
  version: number;
  lavet: string;
  billeder: KopiBillede[];
}

// Billederne pakkes for sig, fordi det er asynkront: en Blob skal læses, og et
// billede der kun ligger på serveren, skal hentes ned. Resten af kopien er
// en ren omformning.
export function lavSikkerhedskopi(indhold: Baseindhold, billeder: KopiBillede[] = []): Sikkerhedskopi {
  return {
    version: KOPI_VERSION,
    lavet: new Date().toISOString(),
    // id er lokalt for den enhed kopien blev lavet på, og pb_id peger på en
    // record der måske ikke findes mere. Kun uid følger med — det er
    // identiteten på tværs af enheder.
    items: indhold.items.map(uden),
    grupper: indhold.grupper.map(uden),
    ture: indhold.ture.map(uden),
    steder: indhold.steder.map(uden),
    personer: indhold.personer.map(uden),
    billeder
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
  if (!Number.isInteger(k.version) || k.version < 1) {
    throw new KopiFejl(`Kopiens version (${k.version}) er ugyldig.`);
  }
  if (k.version > KOPI_VERSION) {
    throw new KopiFejl(`Kopien er lavet med en nyere version (${k.version}). Opdatér appen først.`);
  }

  return {
    version: k.version,
    lavet: typeof k.lavet === 'string' ? k.lavet : '',
    items: laesPoster<Item>(k.items),
    grupper: laesPoster<Gruppe>(k.grupper),
    ture: laesPoster<Tur>(k.ture),
    steder: laesPoster<Sted>(k.steder),
    personer: laesPoster<Person>(k.personer),
    billeder: laesBilleder(k.billeder)
  };
}

// Billederne efterprøves hårdere end de andre poster: en data-URL kan være
// hvad som helst, og den ender som en Blob, der vises som et billede. Kun
// billedtyper lukkes ind, og et billede uden både fil og url er ikke et
// billede — det springes over.
function laesBilleder(v: unknown): KopiBillede[] {
  return laesPoster<KopiBillede & { oprettet: Date; aendret: Date }>(v)
    .map((b) => {
      const raa = b as unknown as Record<string, unknown>;
      return {
        ...b,
        navn: somTekst(raa.navn),
        tur_uid: somTekst(raa.tur_uid),
        tid: somTekst(raa.tid),
        bredde: somTal(raa.bredde),
        hoejde: somTal(raa.hoejde),
        byte: somTal(raa.byte),
        url: somTekst(raa.url),
        original_url: somTekst(raa.original_url),
        original_byte: somTal(raa.original_byte),
        beskrivelse: somTekst(raa.beskrivelse),
        data: erBilleddata(raa.data) ? (raa.data as string) : '',
        original_data: erBilleddata(raa.original_data) ? (raa.original_data as string) : ''
      };
    })
    .filter((b) => b.data !== '' || b.url !== '');
}

function somTekst(v: unknown): string {
  return typeof v === 'string' ? v : '';
}

function somTal(v: unknown): number {
  return typeof v === 'number' && Number.isFinite(v) ? v : 0;
}

function erBilleddata(v: unknown): boolean {
  return typeof v === 'string' && /^data:image\/[a-z0-9.+-]+;base64,/i.test(v);
}

// ─────────────────────────────────────────────
// Billedfilerne
// ─────────────────────────────────────────────

// Henter et billede, der kun findes som url. Returnerer null, hvis det ikke
// kunne lade sig gøre — så kommer billedet med uden fil.
export type HentBillede = (url: string) => Promise<Blob | null>;

// Blob → "data:image/jpeg;base64,…". Skrevet med arrayBuffer og btoa frem for
// FileReader, så den samme kode kører i testene uden en browser. Bytes lægges
// over i bidder, fordi String.fromCharCode med et helt billede som argumenter
// løber tør for stak.
export async function blobTilData(blob: Blob): Promise<string> {
  const bytes = new Uint8Array(await blob.arrayBuffer());
  let binaer = '';
  const BID = 0x8000;
  for (let i = 0; i < bytes.length; i += BID) {
    binaer += String.fromCharCode(...bytes.subarray(i, i + BID));
  }
  const type = blob.type || 'image/jpeg';
  return `data:${type};base64,${btoa(binaer)}`;
}

// Den anden vej. Null, hvis teksten ikke er en gyldig billed-data-URL.
export function dataTilBlob(data: string): Blob | null {
  const fund = /^data:(image\/[a-z0-9.+-]+);base64,(.*)$/is.exec(data);
  if (!fund) return null;

  try {
    const binaer = atob(fund[2]);
    const bytes = new Uint8Array(binaer.length);
    for (let i = 0; i < binaer.length; i++) bytes[i] = binaer.charCodeAt(i);
    return new Blob([bytes], { type: fund[1].toLowerCase() });
  } catch {
    return null;
  }
}

export interface PakkedeBilleder {
  billeder: KopiBillede[];
  // Billeder der kun lå på serveren og ikke kunne hentes. De kommer med som
  // url, men ikke som fil — og det skal kunne siges, så kopien ikke lover mere,
  // end den holder.
  uden_fil: number;
}

// Gør billederne klar til kopien. Et billede der kun findes som url — det er
// taget på en anden enhed og aldrig vist her — hentes ned, så kopien også
// virker uden serveren.
export async function pakBilleder(billeder: Billede[], hent?: HentBillede): Promise<PakkedeBilleder> {
  const pakket: KopiBillede[] = [];
  let udenFil = 0;

  for (const billede of billeder) {
    let blob = billede.blob;
    if (!blob && billede.url && hent) {
      try {
        blob = await hent(billede.url);
      } catch {
        blob = null;
      }
    }
    if (!blob) udenFil++;

    const { blob: _b, original_blob, ...resten } = uden(billede);
    void _b;
    const { usendt_aendring, ...rent } = resten as typeof resten & { usendt_aendring?: boolean };
    void usendt_aendring;

    pakket.push({
      ...rent,
      data: blob ? await blobTilData(blob) : '',
      original_data: original_blob ? await blobTilData(original_blob) : ''
    });
  }

  return { billeder: pakket, uden_fil: udenFil };
}

// Fra kopien tilbage til en post i basen.
//
// Med filen på plads er den gamle url ikke længere til noget: den peger på en
// record, der måske er væk — eller tilhører en anden konto. Uden url og uden
// pb_id bliver billedet sendt op igen af den almindelige billed-sync, og
// url'en kommer så med serverens svar. Kom filen ikke med, er url'en det
// eneste spor, og den bliver stående.
export function udpakBillede(k: KopiBillede): Billede {
  const { data, original_data, ...resten } = k;
  const blob = data ? dataTilBlob(data) : null;
  const original_blob = original_data ? dataTilBlob(original_data) : null;

  return {
    ...resten,
    blob,
    url: blob ? '' : k.url,
    original_blob,
    original_url: original_blob ? '' : k.original_url
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

export interface Fletteresultat extends Baseindhold {
  billeder: Billede[];
  tilfoejet: number;
  fandtes: number;
}

// Importen lægger til, den overskriver aldrig. En post der allerede findes —
// kendt på sit uid — springes over, så den samme kopi kan læses ind to gange
// uden at fordoble noget, og så en nyere lokal udgave ikke ryger.
export function fletInd(
  kopi: Sikkerhedskopi,
  eksisterende: Baseindhold,
  lokaleBilleder: Billede[] = []
): Fletteresultat {
  const items = nye(kopi.items, eksisterende.items);
  const grupper = nye(kopi.grupper, eksisterende.grupper);
  const ture = nye(kopi.ture, eksisterende.ture);
  const steder = nye(kopi.steder, eksisterende.steder);
  const personer = nye(kopi.personer, eksisterende.personer);
  const billeder = nye((kopi.billeder ?? []).map(udpakBillede), lokaleBilleder);

  const tilfoejet = items.length + grupper.length + ture.length + steder.length + personer.length
    + billeder.length;
  const iKopien = kopi.items.length + kopi.grupper.length + kopi.ture.length
    + kopi.steder.length + kopi.personer.length + (kopi.billeder ?? []).length;

  return {
    items,
    grupper,
    ture,
    steder,
    personer,
    billeder,
    tilfoejet,
    fandtes: iKopien - tilfoejet
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
