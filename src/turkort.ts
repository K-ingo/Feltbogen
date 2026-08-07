import { pb } from './pb';
import type { Tur } from './db';

// Turkortet til én pårørende.
//
// Sikkerhed uden ceremoni: ikke live-tracking, ikke en app til den anden. Ét
// link med fire oplysninger — hvor jeg er, hvornår jeg burde være hjemme, og
// hvem der skal ringes til hvis jeg ikke er.
//
// Modtageren læser ét felt på turen, aldrig resten. Det er den samme grænse
// som gæstelinket bruger, og af den samme grund: en læseregel i PocketBase
// gælder hele posten, så alt hvad modtageren ikke skal se, må ikke ligge i det
// hun kan hente.

export const TURKORT_VERSION = 1;

export interface Turkortsnapshot {
  version: number;
  navn: string;
  sted: string;
  koordinater: { lat: number; lng: number } | null;
  startdato: string;
  slutdato: string;
  // Hvornår man burde være hjemme. Det er den ene dato der betyder noget for
  // modtageren — slutdatoen er hvornår turen slutter, ikke hvornår bilen
  // holder i indkørslen.
  forventet_retur: string;
  besked: string;
  // Sat når turen er afsluttet. Så står kortet stadig, men siger at han er
  // kommet hjem — bedre end et link der pludselig er dødt.
  udloebet: boolean;
  lavet_den: string;
}

// Samme længde og samme slags token som gæstelinket: for langt til at gætte,
// kort nok til en sms.
export function nytTurkorttoken(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  return [...bytes].map((b) => b.toString(16).padStart(2, '0')).join('');
}

export function lavTurkort(tur: Tur, stednavn: string, nu: Date = new Date()): Turkortsnapshot {
  return {
    version: TURKORT_VERSION,
    navn: tur.navn,
    // Et gemt sted har et navn en pårørende kan finde på et kort; koordinater
    // er noget man skal taste ind et andet sted.
    sted: stednavn || tur.sted,
    koordinater: tur.koordinater,
    startdato: tur.startdato,
    slutdato: tur.slutdato,
    forventet_retur: tur.turkort_retur,
    besked: tur.turkort_besked,
    udloebet: tur.status === 'afsluttet',
    lavet_den: nu.toISOString()
  };
}

// Snapshottet kommer fra serveren og kan i princippet være hvad som helst.
export function laesTurkort(raa: unknown): Turkortsnapshot | null {
  if (typeof raa !== 'string' || raa === '') return null;

  let data: unknown;
  try {
    data = JSON.parse(raa);
  } catch {
    return null;
  }
  if (!data || typeof data !== 'object' || Array.isArray(data)) return null;

  const s = data as Record<string, unknown>;
  if (typeof s.version !== 'number' || s.version > TURKORT_VERSION) return null;

  return {
    version: s.version,
    navn: tekst(s.navn),
    sted: tekst(s.sted),
    koordinater: koordinater(s.koordinater),
    startdato: tekst(s.startdato),
    slutdato: tekst(s.slutdato),
    forventet_retur: tekst(s.forventet_retur),
    besked: tekst(s.besked),
    udloebet: s.udloebet === true,
    lavet_den: tekst(s.lavet_den)
  };
}

function tekst(v: unknown): string {
  return typeof v === 'string' ? v : '';
}

function koordinater(v: unknown): { lat: number; lng: number } | null {
  if (!v || typeof v !== 'object') return null;
  const k = v as Record<string, unknown>;
  if (typeof k.lat !== 'number' || typeof k.lng !== 'number') return null;
  return { lat: k.lat, lng: k.lng };
}

export function turkortLink(token: string, oprindelse: string = window.location.origin): string {
  return `${oprindelse}/?turkort=${token}`;
}

export function turkorttokenFraAdresse(soeg: string = window.location.search): string | null {
  const token = new URLSearchParams(soeg).get('turkort');
  return token && /^[0-9a-f]{32}$/.test(token) ? token : null;
}

// Et kort til en pårørende skal kunne åbnes i en bil på en rasteplads. Derfor
// også et link til kortet hos en tjeneste alle har.
export function kortlink(koordinater: { lat: number; lng: number } | null): string {
  if (!koordinater) return '';
  return `https://www.openstreetmap.org/?mlat=${koordinater.lat}&mlon=${koordinater.lng}#map=13/${koordinater.lat}/${koordinater.lng}`;
}

// "torsdag den 6. august kl. 19.00" — skrevet ud, fordi modtageren skal kunne
// læse det uden at regne.
export function returtekst(iso: string): string {
  if (!iso) return 'Ikke oplyst';

  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return 'Ikke oplyst';

  const dage = ['søndag', 'mandag', 'tirsdag', 'onsdag', 'torsdag', 'fredag', 'lørdag'];
  const maaneder = [
    'januar', 'februar', 'marts', 'april', 'maj', 'juni',
    'juli', 'august', 'september', 'oktober', 'november', 'december'
  ];

  const dato = `${dage[d.getDay()]} den ${d.getDate()}. ${maaneder[d.getMonth()]}`;
  // En dato uden klokkeslæt er stadig en dato; det er kun tidspunktet der
  // mangler, og så skal der ikke stå kl. 00.00.
  const harTid = iso.includes('T');
  if (!harTid) return dato;

  return `${dato} kl. ${String(d.getHours()).padStart(2, '0')}.${String(d.getMinutes()).padStart(2, '0')}`;
}

// Om returtidspunktet er overskredet. Det er dét kortet handler om: er han
// hjemme, eller er det nu man skal begynde at ringe?
export function erOverskredet(snapshot: Turkortsnapshot, nu: Date = new Date()): boolean {
  if (snapshot.udloebet || !snapshot.forventet_retur) return false;

  const retur = new Date(snapshot.forventet_retur);
  if (Number.isNaN(retur.getTime())) return false;

  return retur.getTime() < nu.getTime();
}

// ─────────────────────────────────────────────
// Hentning
// ─────────────────────────────────────────────

export type TurkortSvar =
  | { slags: 'ok'; snapshot: Turkortsnapshot }
  | { slags: 'ikke_fundet' }
  | { slags: 'fejl' };

// Som gæstelinket: filteret her er en bekvemmelighed, ikke en sikring. Det der
// faktisk beskytter turene, er læsereglen på samlingen i PocketBase.
export async function hentTurkort(token: string): Promise<TurkortSvar> {
  try {
    const svar = await pb.collection('ture').getList(1, 1, {
      filter: pb.filter('turkort_token = {:token}', { token }),
      token
    });

    const record = svar.items[0];
    if (!record) return { slags: 'ikke_fundet' };

    const snapshot = laesTurkort(record.turkort_snapshot);
    if (!snapshot) return { slags: 'ikke_fundet' };

    return { slags: 'ok', snapshot };
  } catch (e) {
    const status = (e as { status?: number })?.status;
    if (status === 404 || status === 403 || status === 400) return { slags: 'ikke_fundet' };
    return { slags: 'fejl' };
  }
}
