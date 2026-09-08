import { useLiveQuery } from 'dexie-react-hooks';
import { db } from './db';
import { laes, saet } from './indstillinger';

// ─────────────────────────────────────────────
// Hvem den lokale base tilhører
//
// `logUd()` rydder kun sessionen; IndexedDB bliver liggende. For den samme
// person er det rigtigt — man skal ikke miste sit skab, fordi man logger ud —
// og brugerfladen lover det direkte.
//
// Logger en anden person så ind i samme browser, er der ingenting, der siger
// fra. Sync sender af sted som altid, og `tilPb(post, bruger.id)` sætter den
// nuværende brugers id på: den forrige ejers grej bliver oprettet under den
// nye konto. Hentningen lægger samtidig den nyes ting ned i de samme tabeller.
//
// Det, der manglede, var ikke en spærre men en oplysning: hvem tilhører de her
// data? Mærket her er svaret, og det ligger i `indstillinger`, fordi den tabel
// er enhedens egen og aldrig synkroniseres. Det overlever et log ud — det er
// hele pointen. Det siger, hvem dataene tilhører, ikke hvem der er logget ind.
//
// Kun id'et gemmes, ikke e-mailen. Id'et er nok til at sammenligne, og står en
// anden med telefonen, skal appen ikke fortælle hende, hvem den forrige ejer
// var.
// ─────────────────────────────────────────────

export const KONTO_EJER = 'konto_ejer';

export type Kontostatus =
  // Ikke logget ind. Alt bliver lokalt, og det er en gyldig måde at bruge
  // appen på.
  | 'uden_konto'
  // Basen har intet ejermærke: enten er der aldrig været en konto på den, eller
  // også er den fra før mærket fandtes. Den adopteres ved første synkronisering.
  | 'umaerket'
  // Mærket passer med den, der er logget ind. Det normale.
  | 'egen'
  // Mærket peger på en anden konto. Intet må sendes eller hentes, før brugeren
  // har taget stilling.
  | 'fremmed';

export async function laesEjer(): Promise<string | null> {
  return laes(KONTO_EJER);
}

export async function kontostatus(brugerId: string | null): Promise<Kontostatus> {
  if (!brugerId) return 'uden_konto';

  const ejer = await laesEjer();
  if (!ejer) return 'umaerket';
  return ejer === brugerId ? 'egen' : 'fremmed';
}

// Tager den umærkede base i eje. Data lavet uden konto er ens egne — det er
// den dokumenterede måde at komme i gang på — så et første login skal adoptere
// dem og ikke spørge om noget.
export async function adopterBase(brugerId: string): Promise<void> {
  await saet(KONTO_EJER, brugerId);
}

// Alt, hvad der hører til den forrige ejer. Rækkefølgen er ligegyldig, men
// listen er ikke: en tabel, der bliver glemt her, er data, der følger med over
// til den næste.
//
// `indstillinger` er med, og det er et bevidst valg. Kropsvægt, afgangs-tjekkets
// skabelon og de daglige kalorier er den forrige ejers persondata og hører ikke
// til hos den næste. Ejermærket skrives igen bagefter.
async function rydAlt(): Promise<void> {
  await Promise.all([
    db.items.clear(),
    db.grupper.clear(),
    db.ture.clear(),
    db.tur_dage.clear(),
    db.steder.clear(),
    db.personer.clear(),
    db.billeder.clear(),
    // Sporene efter sletninger, der aldrig nåede op. De peger på den forrige
    // ejers records og må ikke sendes af sted under den nye konto.
    db.slettede.clear(),
    // Gæstens egne ting: de delte ture, hun har kigget på, og hendes afkrydsning.
    db.delte_ture.clear(),
    db.afviste_forslag.clear(),
    db.indstillinger.clear()
  ]);
}

// Rydder enheden og giver den til den nye konto.
//
// Der er ingen fortryd. Skærmen, der kalder den, skal have sagt hvor meget der
// ikke er nået op, og have tilbudt en sikkerhedskopi først.
export async function rydEnhed(brugerId: string): Promise<void> {
  await rydAlt();
  await adopterBase(brugerId);
}

// Til skærmen. `undefined` mens svaret hentes, så der ikke blinker en
// kontoskift-advarsel forbi, før basen er læst.
export function useKontostatus(brugerId: string | null): Kontostatus | undefined {
  return useLiveQuery(() => kontostatus(brugerId), [brugerId]);
}
