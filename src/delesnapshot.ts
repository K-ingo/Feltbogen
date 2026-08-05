import { db } from './db';
import type { Tur, Gruppe, Item } from './db';
import { lavSnapshot } from './gaest';
import type { Gaestesnapshot } from './gaest';
import { itemsPaaTur } from './smartMotor';
import { opdaterTur, saetEfterSkrivning } from './sync';

// Gæstens udgave af en delt tur skal følge med af sig selv.
//
// Øjebliksbilledet blev før kun lavet når man trykkede "del" eller "opdatér".
// Rettede man turen bagefter — eller bare omdøbte et stykke gear — så man
// selv det nye, mens de andre stadig så det gamle. Det opdager man først når
// nogen møder op med det forkerte.
//
// Derfor bygges det om efter hver skrivning. Det er ikke kun turen der tæller:
// pakkelisten er sat sammen af items og grupper, så en rettelse dér ændrer
// også det gæsten skal se.

// Skrivninger kommer i klumper — et tastetryk ad gangen mens man skriver et
// navn. Der ventes lidt, så en hel indtastning giver én ombygning.
const FORSINKELSE_MS = 900;

let timer: ReturnType<typeof setTimeout> | null = null;

export function planlaegFriskning(): void {
  if (timer) clearTimeout(timer);
  timer = setTimeout(() => {
    timer = null;
    void friskDelteSnapshots();
  }, FORSINKELSE_MS);
}

// Bygger øjebliksbilledet om for hver delt tur, hvor indholdet har ændret sig.
//
// Returnerer hvor mange der blev skrevet — nul er det normale, og det er
// pointen: uden en ændring skrives der ingenting, og så kan ombygningen ikke
// udløse sig selv i ring.
export async function friskDelteSnapshots(nu: Date = new Date()): Promise<number> {
  const delte = await db.ture.filter((t) => t.dele_token !== '').toArray();
  if (delte.length === 0) return 0;

  const [items, grupper] = await Promise.all([db.items.toArray(), db.grupper.toArray()]);

  let skrevet = 0;
  for (const tur of delte) {
    if (await friskEn(tur, grupper, items, nu)) skrevet++;
  }
  return skrevet;
}

async function friskEn(tur: Tur, grupper: Gruppe[], items: Item[], nu: Date): Promise<boolean> {
  if (tur.id === undefined) return false;

  const frisk = lavSnapshot(tur, grupper, itemsPaaTur(tur, grupper, items), nu);
  if (uaendret(tur.dele_snapshot, frisk)) return false;

  await opdaterTur(tur.id, { dele_snapshot: JSON.stringify(frisk) });
  return true;
}

// Sammenligningen ser bort fra tidsstemplet. Det er nyt ved hver kørsel, og
// uden at skære det væk ville hver ombygning se en ændring og skrive igen —
// i ring, for evigt.
function uaendret(gammel: string, frisk: Gaestesnapshot): boolean {
  if (!gammel) return false;

  try {
    const foer = JSON.parse(gammel) as Gaestesnapshot;
    return JSON.stringify({ ...foer, delt_den: '' }) === JSON.stringify({ ...frisk, delt_den: '' });
  } catch {
    // Er det gamle ikke til at læse, er det bedre at skrive et nyt.
    return false;
  }
}

// Kobles på ved opstart. sync.ts kender ikke til deling — den kalder bare den
// her, og så slipper vi for en import der peger begge veje.
saetEfterSkrivning(planlaegFriskning);
