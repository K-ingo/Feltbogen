import { db } from './db';
import {
  lavSikkerhedskopi,
  laesSikkerhedskopi,
  fletInd,
  pakBilleder,
  tilJson
} from './dataudveksling';
import type { Fletteresultat, HentBillede } from './dataudveksling';
import { hentMedTimeout, TIMEOUT_FIL_MS } from './netkald';

// Sikkerhedskopien mod basen: hvad der læses ud, og hvad der lægges ind.
//
// Reglerne for selve filen står i dataudveksling.ts og kan testes uden en
// base. Det her er de to steder, der rører basen — samlet, fordi tre skærme
// (Indstillinger, kontoskiftet og rundvisningen) gør det samme, og en tabel,
// der kun blev taget med ét af stederne, ville være en kopi, der lyver.

export interface Eksport {
  json: string;
  // Poster i alt, billederne medregnet.
  antal: number;
  billeder: number;
  // Billeder der kun lå på serveren og ikke kunne hentes ned. De er med som
  // url, men uden fil.
  uden_fil: number;
}

// Et billede, der kun ligger på serveren, hentes ned til kopien — med den
// lange grænse, fordi det er en fil.
export const hentBilledfil: HentBillede = async (url) => {
  const svar = await hentMedTimeout(url, {}, TIMEOUT_FIL_MS);
  if (!svar.ok) return null;
  return await svar.blob();
};

export async function lavEksport(hent: HentBillede = hentBilledfil): Promise<Eksport> {
  const [items, grupper, ture, steder, personer, billeder] = await Promise.all([
    db.items.toArray(),
    db.grupper.toArray(),
    db.ture.toArray(),
    db.steder.toArray(),
    db.personer.toArray(),
    db.billeder.toArray()
  ]);

  const pakket = await pakBilleder(billeder, hent);
  const kopi = lavSikkerhedskopi({ items, grupper, ture, steder, personer }, pakket.billeder);

  return {
    json: tilJson(kopi),
    antal: items.length + grupper.length + ture.length + steder.length + personer.length + billeder.length,
    billeder: billeder.length,
    uden_fil: pakket.uden_fil
  };
}

// Læser en kopi ind oveni det, der er. Kaster KopiFejl, hvis filen ikke kan
// læses; skrives der noget, skrives alt i én transaktion.
export async function gendan(raa: string): Promise<Fletteresultat> {
  const kopi = laesSikkerhedskopi(raa);

  const flettet = fletInd(
    kopi,
    {
      items: await db.items.toArray(),
      grupper: await db.grupper.toArray(),
      ture: await db.ture.toArray(),
      steder: await db.steder.toArray(),
      personer: await db.personer.toArray()
    },
    await db.billeder.toArray()
  );

  await db.transaction('rw', [db.items, db.grupper, db.ture, db.steder, db.personer, db.billeder], async () => {
    await db.items.bulkAdd(flettet.items);
    await db.grupper.bulkAdd(flettet.grupper);
    await db.ture.bulkAdd(flettet.ture);
    await db.steder.bulkAdd(flettet.steder);
    await db.personer.bulkAdd(flettet.personer);
    await db.billeder.bulkAdd(flettet.billeder);
  });

  return flettet;
}

// "feltbogen-2026-07-31.json" som en download.
export function gemSomFil(json: string, navn: string): void {
  const url = URL.createObjectURL(new Blob([json], { type: 'application/json' }));

  const link = document.createElement('a');
  link.href = url;
  link.download = navn;
  link.click();
  URL.revokeObjectURL(url);
}
