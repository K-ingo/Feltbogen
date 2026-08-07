import { useLiveQuery } from 'dexie-react-hooks';
import { db } from './db';

// Enhedens egne valg — ikke data, og derfor ikke noget der synkroniseres.
// To enheder kan sagtens have set forskellige ting.

export const ONBOARDING_SET = 'onboarding_set';
export const FAB_TIP_SET = 'fab_tip_set';
// Hvor grundigt et pak-af-tjek skal være. Det er en vane og ikke en egenskab
// ved turen — derfor et valg på enheden og ikke et felt på turen.
export const PAK_AF_NIVEAU_VALG = 'pak_af_niveau';

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
