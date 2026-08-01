import { pb } from './pb';
import type { Item, Gruppe, Tur } from './db';
import { pakkelisteEfterGruppe, baererAf } from './smartMotor';
import type { VejrData } from './smartMotor';

// Deling af en tur med nogen der ikke har konto.
//
// Gæsten læser aldrig inventaret. Alt hvad hun skal se, fryses ned i ét felt
// på turen, når linket bliver lavet — så er der ét felt at åbne for læsning i
// stedet for tre samlinger, og gearlisten forlader aldrig kontoen.
//
// Det betyder også at øjebliksbilledet ikke følger med, når man siden retter
// turen. Det er med vilje: gæsten skal se det man delte, ikke det man er
// midt i at lave om.

export const SNAPSHOT_VERSION = 1;

export interface GaesteItem {
  navn: string;
  vaegt_g: number;
  delt: boolean;
  // Navnet på den der bærer det, eller tom hvis det ikke er fordelt. Kun
  // navnet — gæsten har ikke brug for deltagernes id'er.
  baerer: string;
}

export interface GaesteAfsnit {
  titel: string;
  items: GaesteItem[];
}

export interface Gaestesnapshot {
  version: number;
  navn: string;
  sted: string;
  koordinater: { lat: number; lng: number } | null;
  startdato: string;
  slutdato: string;
  naetter: number;
  personer: number;
  baereafstand_km: number;
  besked_fra_ejer: string;
  // Kun navnene. Gæsten har ikke brug for de andres gearlister.
  deltagere: string[];
  vejr: VejrData | null;
  afsnit: GaesteAfsnit[];
  vaegt_i_alt_g: number;
  delt_den: string;
}

// 128 bit fra crypto — for langt til at gætte, kort nok til et link man kan
// sende i en sms.
export function nytDeletoken(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  return [...bytes].map((b) => b.toString(16).padStart(2, '0')).join('');
}

export function lavSnapshot(
  tur: Tur,
  grupper: Gruppe[],
  pakItems: Item[],
  nu: Date = new Date()
): Gaestesnapshot {
  const baerer = baererAf(tur);
  const navnPaa = new Map(tur.deltagere.map((d) => [d.id, d.navn]));

  const afsnit = pakkelisteEfterGruppe(tur, grupper, pakItems).map((a) => ({
    titel: a.titel,
    // Kun navn, vægt, om det deles og hvem der bærer det. Ikke pris, ikke
    // købsinfo, ikke noter.
    items: a.items.map((i) => ({
      navn: i.navn,
      vaegt_g: i.vaegt_g,
      delt: i.delt,
      baerer: navnPaa.get(baerer.get(i.uid) ?? '') ?? ''
    }))
  }));

  return {
    version: SNAPSHOT_VERSION,
    navn: tur.navn,
    sted: tur.sted,
    koordinater: tur.koordinater,
    startdato: tur.startdato,
    slutdato: tur.slutdato,
    naetter: tur.naetter,
    personer: tur.personer,
    baereafstand_km: tur.baereafstand_km,
    besked_fra_ejer: tur.besked_fra_ejer,
    deltagere: tur.deltagere.map((d) => d.navn).filter(Boolean),
    vejr: laesVejr(tur.vejrsnapshot),
    afsnit,
    vaegt_i_alt_g: pakItems.reduce((s, i) => s + i.vaegt_g, 0),
    delt_den: nu.toISOString()
  };
}

function laesVejr(raa: string): VejrData | null {
  if (!raa) return null;
  try {
    const v = JSON.parse(raa) as VejrData;
    return Array.isArray(v?.dage) ? v : null;
  } catch {
    return null;
  }
}

// Snapshottet kommer fra serveren og kan i princippet være hvad som helst.
// Fejler læsningen, får gæsten en besked frem for en hvid side.
export function laesSnapshot(raa: unknown): Gaestesnapshot | null {
  if (typeof raa !== 'string' || raa === '') return null;

  let data: unknown;
  try {
    data = JSON.parse(raa);
  } catch {
    return null;
  }
  if (!data || typeof data !== 'object' || Array.isArray(data)) return null;

  const s = data as Record<string, unknown>;
  if (typeof s.version !== 'number' || s.version > SNAPSHOT_VERSION) return null;

  return {
    version: s.version,
    navn: tekst(s.navn),
    sted: tekst(s.sted),
    koordinater: koordinater(s.koordinater),
    startdato: tekst(s.startdato),
    slutdato: tekst(s.slutdato),
    naetter: tal(s.naetter),
    personer: tal(s.personer, 1),
    baereafstand_km: tal(s.baereafstand_km),
    besked_fra_ejer: tekst(s.besked_fra_ejer),
    deltagere: Array.isArray(s.deltagere) ? s.deltagere.map(String).filter(Boolean) : [],
    vejr: vejr(s.vejr),
    afsnit: afsnit(s.afsnit),
    vaegt_i_alt_g: tal(s.vaegt_i_alt_g),
    delt_den: tekst(s.delt_den)
  };
}

function tekst(v: unknown): string {
  return typeof v === 'string' ? v : '';
}

function tal(v: unknown, standard = 0): number {
  return typeof v === 'number' && Number.isFinite(v) ? v : standard;
}

function koordinater(v: unknown): { lat: number; lng: number } | null {
  if (!v || typeof v !== 'object') return null;
  const k = v as Record<string, unknown>;
  if (typeof k.lat !== 'number' || typeof k.lng !== 'number') return null;
  return { lat: k.lat, lng: k.lng };
}

function vejr(v: unknown): VejrData | null {
  if (!v || typeof v !== 'object') return null;
  const d = v as Record<string, unknown>;
  return Array.isArray(d.dage) ? (v as VejrData) : null;
}

function afsnit(v: unknown): GaesteAfsnit[] {
  if (!Array.isArray(v)) return [];

  return v
    .filter((a): a is Record<string, unknown> => !!a && typeof a === 'object')
    .map((a) => ({
      titel: tekst(a.titel),
      items: Array.isArray(a.items)
        ? a.items
            .filter((i): i is Record<string, unknown> => !!i && typeof i === 'object')
            // baerer mangler i snapshots lavet før feltet fandtes.
            .map((i) => ({
              navn: tekst(i.navn),
              vaegt_g: tal(i.vaegt_g),
              delt: i.delt === true,
              baerer: tekst(i.baerer)
            }))
        : []
    }));
}

// Linket gæsten får. Bygges ud fra det sted appen kører, så det virker både
// lokalt og i produktion.
export function deleLink(token: string, oprindelse: string = window.location.origin): string {
  return `${oprindelse}/?tur=${token}`;
}

// Tokenet fra adresselinjen, hvis appen er åbnet som gæst.
export function tokenFraAdresse(soeg: string = window.location.search): string | null {
  const token = new URLSearchParams(soeg).get('tur');
  // Hex fra nytDeletoken(). Andet end det er ikke et link vi har lavet, og
  // skal ikke sendes videre til serveren.
  return token && /^[0-9a-f]{32}$/.test(token) ? token : null;
}

// ─────────────────────────────────────────────
// Hentning
// ─────────────────────────────────────────────

export type GaesteSvar =
  | { slags: 'ok'; snapshot: Gaestesnapshot }
  | { slags: 'ikke_fundet' }
  | { slags: 'fejl' };

// Henter en delt tur uden at være logget ind. Ejerens navn følger ikke med —
// vi har kun en e-mail, og den er ikke gæstens.
//
// Filteret her er en bekvemmelighed, ikke en sikring — en gæst kan sende hvad
// som helst. Det der faktisk beskytter turene, er læsereglen på samlingen i
// PocketBase. Tokenet sendes også som query-parameter, så reglen kan
// sammenligne med den.
export async function hentDeltTur(token: string): Promise<GaesteSvar> {
  try {
    const svar = await pb.collection('ture').getList(1, 1, {
      filter: pb.filter('dele_token = {:token}', { token }),
      // Læses af reglen som @request.query.token.
      token
    });

    const record = svar.items[0];
    if (!record) return { slags: 'ikke_fundet' };

    const snapshot = laesSnapshot(record.dele_snapshot);
    if (!snapshot) return { slags: 'ikke_fundet' };

    return { slags: 'ok', snapshot };
  } catch (e) {
    // 404 og 403 betyder begge "den findes ikke for dig" — der er ingen grund
    // til at fortælle en fremmed hvilken af delene det er.
    const status = (e as { status?: number })?.status;
    if (status === 404 || status === 403 || status === 400) return { slags: 'ikke_fundet' };
    return { slags: 'fejl' };
  }
}

// ─────────────────────────────────────────────
// Er linket noget en gæst kan nå?
// ─────────────────────────────────────────────

export type Linkadvarsel = 'lokal' | 'preview' | null;

// Et gæstelink er kun så godt som den adresse appen kører på. Laver man det
// på sin egen maskine eller på en preview-udrulning, virker det for én selv
// og for ingen andre — og det opdager man først, når gæsten skriver tilbage.
export function linkadvarsel(oprindelse: string = window.location.origin): Linkadvarsel {
  let vaert: string;
  try {
    vaert = new URL(oprindelse).hostname.toLowerCase();
  } catch {
    return null;
  }

  if (erLokal(vaert)) return 'lokal';
  // Vercels grenpreviews har altid "-git-" i værtsnavnet. Andre previews kan
  // ikke skelnes fra et produktionsnavn, og der er et falsk alarm værre end
  // ingen — derfor vises værten altid ved siden af linket.
  if (vaert.endsWith('.vercel.app') && vaert.includes('-git-')) return 'preview';

  return null;
}

function erLokal(vaert: string): boolean {
  if (vaert === 'localhost' || vaert.endsWith('.localhost')) return true;
  if (vaert === '127.0.0.1' || vaert === '::1' || vaert === '[::1]') return true;
  if (vaert.endsWith('.local')) return true;

  // Adresser på det lokale net — en telefon på samme wifi kan nå dem, resten
  // af verden kan ikke.
  if (vaert.startsWith('192.168.') || vaert.startsWith('10.')) return true;
  const m = /^172\.(\d{1,2})\./.exec(vaert);
  return !!m && Number(m[1]) >= 16 && Number(m[1]) <= 31;
}

// Værten gæsten lander på, til at vise ved siden af linket.
export function linkvaert(oprindelse: string = window.location.origin): string {
  try {
    return new URL(oprindelse).host;
  } catch {
    return oprindelse;
  }
}
