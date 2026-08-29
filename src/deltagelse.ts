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

// En journalindgang skrevet af en deltager.
//
// Den ligger på deltagerens egen række og ikke i en samling for sig. Det er
// den samme grænse, resten af deltagelsen bruger: PocketBase kan kun give
// adgang til hele poster, så en deltager, der måtte skrive i turens journal,
// også kunne slette turen. Her kan hun kun røre sin egen række — og dermed
// kun sine egne indgange.
//
// Prisen er, at indgangene ikke kan sorteres af serveren. Det er en tur med en
// håndfuld mennesker og en håndfuld dage; de sorteres på skærmen.
export interface Bidrag {
  // Stabilt på tværs af enheder, så den samme indgang ikke kommer op to
  // gange. Se sync-reglerne i sync.ts.
  id: string;
  // ISO.
  tid: string;
  tekst: string;
  // Filnavnene på de billeder, der hører til indgangen, som PocketBase gemte
  // dem. Selve filerne ligger i rækkens `billeder`-felt; her står kun, hvilke
  // af dem der hører til hvilken indgang. Uden koblingen ville alle billeder
  // på en række se ud, som om de hørte til den nyeste note.
  billeder: string[];
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
  // Det hun har skrevet i turens journal.
  journal: Bidrag[];
  // Filnavnene på de billeder, rækken har liggende i PocketBase. Kun læst —
  // nye billeder sendes som filer, ikke som navne, og serveren bestemmer selv
  // det endelige navn.
  billedfiler: string[];
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

export function laesJournal(v: unknown): Bidrag[] {
  if (!Array.isArray(v)) return [];

  return v
    .filter((b): b is Record<string, unknown> => !!b && typeof b === 'object')
    .map((b) => ({
      id: tekst(b.id),
      tid: tekst(b.tid),
      tekst: tekst(b.tekst),
      billeder: Array.isArray(b.billeder) ? b.billeder.map(String).filter(Boolean) : []
    }))
    // En tom indgang er en halvfærdig indtastning, ikke turens historie.
    .filter((b) => b.tekst.trim() !== '');
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
    baerer: Array.isArray(r.baerer) ? r.baerer.map(String).filter(Boolean) : [],
    journal: laesJournal(r.journal),
    billedfiler: Array.isArray(r.billeder) ? r.billeder.map(String).filter(Boolean) : []
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
export async function gemDeltagelse(
  deltagelse: Deltagelse,
  token: string,
  // Nye billeder, allerede skaleret. De lægges til dem, rækken har i
  // forvejen — derfor `billeder+` og ikke `billeder`, som ville erstatte
  // hele feltet og slette de gamle.
  nyeBilleder: File[] = []
): Promise<Svar<Deltagelse>> {
  const bruger = nuvaerendeBruger();
  if (!bruger) return { slags: 'fejl' };

  const felter: Record<string, unknown> = {
    tur: deltagelse.tur,
    user: bruger.id,
    navn: deltagelse.navn,
    medbragt: deltagelse.medbragt,
    baerer: deltagelse.baerer,
    journal: deltagelse.journal
  };

  // Uden filer sendes almindelig JSON. Med filer skal det være FormData, og
  // så skal JSON-felterne skrives som tekst — PocketBase læser dem tilbage.
  let krop: Record<string, unknown> | FormData = felter;
  if (nyeBilleder.length > 0) {
    const form = new FormData();
    for (const [navn, vaerdi] of Object.entries(felter)) {
      form.append(navn, typeof vaerdi === 'string' ? vaerdi : JSON.stringify(vaerdi));
    }
    for (const fil of nyeBilleder) form.append(deltagelse.pb_id ? 'billeder+' : 'billeder', fil);
    krop = form;
  }

  try {
    const svar = deltagelse.pb_id
      ? await pb.collection(SAMLING).update(deltagelse.pb_id, krop, { token })
      : await pb.collection(SAMLING).create(krop, { token });
    return { slags: 'ok', data: laesDeltagelse(svar) };
  } catch {
    return { slags: 'fejl' };
  }
}

// Adressen på et billede, en deltager har lagt op. Filen ligger på hendes
// række, og navnet er det, serveren gav den.
export function billedurl(deltagelse: Deltagelse, filnavn: string): string {
  if (!deltagelse.pb_id) return '';
  return pb.files.getURL({ id: deltagelse.pb_id, collectionName: SAMLING }, filnavn);
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
  return { tur: turPbId, user: brugerId, navn, medbragt: [], baerer: [], journal: [], billedfiler: [] };
}
