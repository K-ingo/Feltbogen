import { useLiveQuery } from 'dexie-react-hooks';
import { db } from './db';

// Enhedens egne valg — ikke data, og derfor ikke noget der synkroniseres.
// To enheder kan sagtens have set forskellige ting.

export const ONBOARDING_SET = 'onboarding_set';
export const FAB_TIP_SET = 'fab_tip_set';

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
