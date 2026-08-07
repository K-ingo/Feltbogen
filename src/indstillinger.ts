import { useLiveQuery } from 'dexie-react-hooks';
import { db, AKTIVITETSNIVEAU } from './db';
import type { Aktivitetsniveau } from './db';
import type { Kropsdata } from './smartMotor';

// Enhedens egne valg — ikke data, og derfor ikke noget der synkroniseres.
// To enheder kan sagtens have set forskellige ting.

export const ONBOARDING_SET = 'onboarding_set';
export const FAB_TIP_SET = 'fab_tip_set';
// Hvor grundigt et pak-af-tjek skal være. Det er en vane og ikke en egenskab
// ved turen — derfor et valg på enheden og ikke et felt på turen.
export const PAK_AF_NIVEAU_VALG = 'pak_af_niveau';

// Kroppen bag tallene. Motoren regnede før med en gennemsnitsdansker; med de
// her kan den regne med brugeren. De hører til enheden på samme måde som
// resten — det er ikke data om turene, og de skal ikke med i en sikkerhedskopi
// af inventaret.
// Afgangs-tjeklistens skabelon, gemt som JSON. Se afgangsTjek.ts for
// læsningen — indstillingstabellen kan kun tekst.
export const AFGANGS_SKABELON = 'afgangs_tjek_skabelon';

export const KROPSVAEGT = 'kropsvaegt_kg';
export const AKTIVITETSNIVEAU_VALG = 'aktivitetsniveau';
export const DAGLIG_KALORIE = 'daglig_kalorie';

export async function saet(noegle: string, vaerdi: string): Promise<void> {
  await db.indstillinger.put({ noegle, vaerdi });
}

export async function laes(noegle: string): Promise<string | null> {
  return (await db.indstillinger.get(noegle))?.vaerdi ?? null;
}

export async function markerSet(noegle: string): Promise<void> {
  await saet(noegle, new Date().toISOString());
}

// undefined mens svaret hentes, så en skærm kan lade være med at blinke
// onboardingen forbi på vej ind.
export function useErSet(noegle: string): boolean | undefined {
  return useLiveQuery(async () => (await laes(noegle)) !== null, [noegle]);
}

// Rå tekst, som den står. null mens den hentes og når nøglen aldrig er sat —
// kalderen afgør selv hvad der er standarden.
export function useTekst(noegle: string): string | null {
  return useLiveQuery(() => laes(noegle), [noegle]) ?? null;
}

// Et valg fra en fast liste. Står der noget uventet i basen — en ældre udgave
// af appen, en håndredigering — falder den tilbage på standarden frem for at
// give skærmen en værdi den ikke kan vise.
export function useValg<T extends string>(
  noegle: string,
  tilladte: readonly T[],
  standard: T
): T {
  const gemt = useLiveQuery(() => laes(noegle), [noegle]);
  return tilladte.includes(gemt as T) ? (gemt as T) : standard;
}

// Kropsdataene samlet, klar til at give videre til motoren. Felter der ikke er
// sat udelades helt — så falder beregningen tilbage på sine egne konstanter i
// stedet for at regne med et nul.
export function useKropsdata(): Kropsdata {
  const vaegt = useLiveQuery(() => laes(KROPSVAEGT));
  const kalorier = useLiveQuery(() => laes(DAGLIG_KALORIE));
  const gemtNiveau = useLiveQuery(() => laes(AKTIVITETSNIVEAU_VALG));

  const niveau = AKTIVITETSNIVEAU.includes(gemtNiveau as Aktivitetsniveau)
    ? (gemtNiveau as Aktivitetsniveau)
    : undefined;

  return {
    ...(positivtTal(vaegt) ? { kropsvaegt_kg: Number(vaegt) } : {}),
    ...(niveau ? { aktivitetsniveau: niveau } : {}),
    ...(positivtTal(kalorier) ? { daglig_kalorie: Number(kalorier) } : {})
  };
}

function positivtTal(v: string | null | undefined): boolean {
  if (!v) return false;
  const n = Number(v);
  return Number.isFinite(n) && n > 0;
}
