import type { GaesteJournal, Gaestesnapshot } from './gaest';
import type { Deltagelse } from './deltagelse';
import { visningsnavn } from './deltagelse';

// Turens journal, som den ser ud, når flere har været med til at skrive den.
//
// Journalen har hidtil været ejerens: `feltnoter` står som JSON på hendes tur,
// og en gæst kan hverken læse eller skrive dem. Men en tur er noget, man var
// på sammen, og historien om den hører til hos alle, der var med.
//
// Indgangene kommer to steder fra, og det er med vilje:
//
// Ejerens står i snapshottet. Det er frosset, da linket blev lavet — skriver
// hun mere bagefter, kommer det med, næste gang gæsten henter forfra.
//
// Deltagernes står på deres egne deltagelsesrækker. Det er den samme grænse,
// resten af deltagelsen bruger: PocketBase giver kun adgang til hele poster,
// så måtte en deltager skrive i turens journal direkte, kunne hun også slette
// turen. På sin egen række kan hun kun røre sine egne indgange.
//
// Her lægges de to sammen til én liste. Det er dét, der gør journalen fælles:
// ikke at alle skriver i den samme post, men at alle læser den samme historie.

export interface Journalindgang {
  id: string;
  // ISO.
  tid: string;
  tekst: string;
  // Hvem der skrev den. Tom betyder ejeren — hendes navn står ikke i
  // snapshottet, og på hendes egen tur er "hvem" underforstået.
  navn: string;
  // Om det er læserens egen indgang. Kun de egne kan rettes.
  min: boolean;
}

export interface Journaldag {
  // Datoen som ISO-dag, fx "2026-09-19". Tom hvis tiden ikke kunne læses.
  dato: string;
  // Hvilken dag på turen det er. 0 når turen ikke har en startdato at tælle
  // fra, eller når indgangen ligger før den.
  nummer: number;
  indgange: Journalindgang[];
}

// Alle indgange, nyeste dag først, med dagene talt fra turens start.
//
// Ejerens navn gives med udefra: snapshottet kender det ikke, og et tomt navn
// på hendes egne indgange ville se ud, som om ingen havde skrevet dem.
export function journalen(
  snapshot: Gaestesnapshot,
  deltagelser: Deltagelse[],
  mig?: string,
  ejerens_navn = 'Ejeren'
): Journaldag[] {
  const alle: Journalindgang[] = [
    ...(snapshot.journal ?? []).map((n: GaesteJournal) => ({
      id: n.id,
      tid: n.tid,
      tekst: n.tekst,
      navn: n.skrevet_af || ejerens_navn,
      min: false
    })),
    ...deltagelser.flatMap((d) => d.journal.map((b) => ({
      id: b.id,
      tid: b.tid,
      tekst: b.tekst,
      navn: visningsnavn(d),
      min: !!mig && d.user === mig
    })))
  ];

  const dage = new Map<string, Journalindgang[]>();
  for (const indgang of alle) {
    const dato = isodag(indgang.tid);
    if (!dage.has(dato)) dage.set(dato, []);
    dage.get(dato)!.push(indgang);
  }

  return [...dage.entries()]
    // Nyeste dag først: det man lige har oplevet, er det man vil læse igen.
    // Inde i dagen står de i den rækkefølge, de skete.
    .sort((a, b) => b[0].localeCompare(a[0]))
    .map(([dato, indgange]) => ({
      dato,
      nummer: dagnummer(snapshot.startdato, dato),
      indgange: [...indgange].sort((a, b) => a.tid.localeCompare(b.tid))
    }));
}

// "Dag 2". Talt fra turens startdato, så en indgang har det samme nummer,
// uanset hvornår man læser den — i modsætning til "i forgårs".
export function dagnummer(startdato: string, dato: string): number {
  if (!startdato || !dato) return 0;

  const start = new Date(startdato);
  const dag = new Date(dato);
  if (Number.isNaN(start.getTime()) || Number.isNaN(dag.getTime())) return 0;

  const dage = Math.round((dag.getTime() - start.getTime()) / 86400000);
  return dage >= 0 ? dage + 1 : 0;
}

function isodag(tid: string): string {
  const d = new Date(tid);
  return Number.isNaN(d.getTime()) ? '' : d.toISOString().slice(0, 10);
}

// Hvor mange der har skrevet med. Bruges til at sige, om journalen er ejerens
// alene eller turens fælles.
export function antalSkribenter(dage: Journaldag[]): number {
  return new Set(dage.flatMap((d) => d.indgange.map((i) => i.navn))).size;
}

// En ny indgang på ens egen række. Id'et er stabilt fra det øjeblik, den
// skrives, så den samme indgang ikke kan komme op to gange.
export function nytBidrag(tekst: string, nu: Date = new Date()) {
  return { id: crypto.randomUUID(), tid: nu.toISOString(), tekst: tekst.trim() };
}
