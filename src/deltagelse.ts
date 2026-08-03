import { pb, nuvaerendeBruger } from './pb';
import type { RecordModel } from 'pocketbase';
import type { Reference } from './db';

// Deltagelse i en tur man ikke selv ejer.
//
// Et gæstelink er en invitation, ikke en nøgle: man skal være logget ind for
// at åbne den. Til gengæld kan man så skrive sig på — hvad man selv tager med,
// og hvad man bærer af ejerens fælles grej.
//
// Bidragene ligger i deres egen samling og ikke på turen. Det er med vilje:
// PocketBase kan kun give adgang til hele poster, ikke til enkelte felter, så
// måtte en deltager skrive på turen, kunne hun også slette den. Her kan hun
// kun røre sin egen række.
//
// Det man tager med, står som navn og vægt og ikke som en henvisning til ens
// eget inventar. Ingen kan læse hinandens gearliste — man deler kun det man
// selv skriver på turen.

export const SAMLING = 'turdeltagelse';

export interface MedbragtGear {
  navn: string;
  vaegt_g: number;
}

export interface Deltagelse {
  pb_id?: string;
  // Turens record-id i PocketBase. Deltagelsen hænger på turen og ikke på
  // tokenet, så den overlever at ejeren laver et nyt link.
  tur: string;
  user: string;
  navn: string;
  medbragt: MedbragtGear[];
  // uid'er på ejerens fælles gear, som denne deltager har sagt ja til at bære.
  baerer: Reference[];
}

// ─────────────────────────────────────────────
// Læsning
// Serveren kan sende hvad som helst, så alt køres igennem her på vej ind.
// ─────────────────────────────────────────────

function tekst(v: unknown): string {
  return typeof v === 'string' ? v : '';
}

function tal(v: unknown): number {
  return typeof v === 'number' && Number.isFinite(v) ? Math.round(v) : 0;
}

export function laesMedbragt(v: unknown): MedbragtGear[] {
  if (!Array.isArray(v)) return [];

  return v
    .filter((g): g is Record<string, unknown> => !!g && typeof g === 'object')
    .map((g) => ({ navn: tekst(g.navn), vaegt_g: tal(g.vaegt_g) }))
    // En linje uden navn er en halvfærdig indtastning, ikke noget der skal
    // stå på andres pakkeliste.
    .filter((g) => g.navn.trim() !== '');
}

export function laesDeltagelse(r: RecordModel): Deltagelse {
  return {
    pb_id: r.id,
    tur: tekst(r.tur),
    user: tekst(r.user),
    navn: tekst(r.navn),
    medbragt: laesMedbragt(r.medbragt),
    baerer: Array.isArray(r.baerer) ? r.baerer.map(String).filter(Boolean) : []
  };
}

// ─────────────────────────────────────────────
// Opslag brugt af begge sider
// Rene funktioner, så de kan testes uden en server.
// ─────────────────────────────────────────────

// Ens egen række, hvis man allerede har skrevet sig på.
export function minDeltagelse(alle: Deltagelse[], brugerId: string): Deltagelse | undefined {
  return alle.find((d) => d.user === brugerId);
}

// Navnet man viser for en deltager. Tomt navn er almindeligt lige efter man
// er kommet ind ad linket, og "En deltager" er bedre end en tom linje.
export function visningsnavn(d: Deltagelse): string {
  return d.navn.trim() || 'En deltager';
}

// Alt hvad deltagerne selv tager med, samlet pr. person. Tomme rækker falder
// fra — de fylder kun på ejerens skærm.
export function medbragtPrDeltager(alle: Deltagelse[]): { navn: string; gear: MedbragtGear[]; vaegt_g: number }[] {
  return alle
    .map((d) => ({
      navn: visningsnavn(d),
      gear: d.medbragt,
      vaegt_g: d.medbragt.reduce((s, g) => s + g.vaegt_g, 0)
    }))
    .filter((d) => d.gear.length > 0);
}

// Hvem har sagt ja til at bære hvad. To der melder sig på samme grej er ikke
// en fejl her — det er noget ejeren skal kunne se og tage stilling til.
export function baererePrGear(alle: Deltagelse[]): Map<Reference, string[]> {
  const pr = new Map<Reference, string[]>();

  alle.forEach((d) => {
    d.baerer.forEach((uid) => {
      pr.set(uid, [...(pr.get(uid) ?? []), visningsnavn(d)]);
    });
  });

  return pr;
}

export function samletMedbragtVaegt(alle: Deltagelse[]): number {
  return alle.reduce((s, d) => s + d.medbragt.reduce((n, g) => n + g.vaegt_g, 0), 0);
}

// ─────────────────────────────────────────────
// Serverkald
//
// Tokenet følger med som query-parameter, fordi læsereglen i PocketBase
// sammenligner med den — præcis som når turen selv hentes.
// ─────────────────────────────────────────────

export type Svar<T> = { slags: 'ok'; data: T } | { slags: 'fejl' };

export async function hentDeltagelser(turPbId: string, token: string): Promise<Svar<Deltagelse[]>> {
  try {
    const svar = await pb.collection(SAMLING).getFullList({
      filter: pb.filter('tur = {:tur}', { tur: turPbId }),
      token
    });
    return { slags: 'ok', data: svar.map(laesDeltagelse) };
  } catch {
    return { slags: 'fejl' };
  }
}

// Skriver ens egen række. Findes den ikke, oprettes den — man bliver deltager
// ved at skrive sig på, ikke ved at ejeren gør noget.
export async function gemDeltagelse(deltagelse: Deltagelse, token: string): Promise<Svar<Deltagelse>> {
  const bruger = nuvaerendeBruger();
  if (!bruger) return { slags: 'fejl' };

  const krop = {
    tur: deltagelse.tur,
    user: bruger.id,
    navn: deltagelse.navn,
    medbragt: deltagelse.medbragt,
    baerer: deltagelse.baerer
  };

  try {
    const svar = deltagelse.pb_id
      ? await pb.collection(SAMLING).update(deltagelse.pb_id, krop, { token })
      : await pb.collection(SAMLING).create(krop, { token });
    return { slags: 'ok', data: laesDeltagelse(svar) };
  } catch {
    return { slags: 'fejl' };
  }
}

// Melder man fra, forsvinder ens grej fra de andres liste igen.
export async function forladTur(pbId: string): Promise<boolean> {
  try {
    await pb.collection(SAMLING).delete(pbId);
    return true;
  } catch {
    return false;
  }
}

// En tom række til en der lige er kommet ind ad linket.
export function nyDeltagelse(turPbId: string, brugerId: string, navn = ''): Deltagelse {
  return { tur: turPbId, user: brugerId, navn, medbragt: [], baerer: [] };
}
