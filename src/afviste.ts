import { useLiveQuery } from 'dexie-react-hooks';
import { db } from './db';
import type { Reference } from './db';
import { aftrykAf } from './forslag';
import type { Forslag } from './forslag';

// Hvad man har sagt nej tak til, og hvor længe det gælder.
//
// Motoren foreslår, skærmen handler — og det her er den ene ting, skærmen
// skal huske mellem to besøg. Reglen er brugerens egen: siger man "vægten er
// fin", er den fin, indtil man ændrer noget, der gør spørgsmålet nyt. Ikke
// indtil man går ud af turen og ind i den igen.
//
// Afvisningen hænger på turen. Det samme forslag på startskærmen og inde på
// turen er det samme forslag — afviser man det ét sted, er det væk begge
// steder, for det var ikke stedet, man svarede på.
//
// Rækkerne bliver liggende på enheden og synkroniseres ikke. To enheder må
// gerne have hørt forskellige ting; det er ikke data om turen.

// Aftrykkene for én tur. `undefined` mens de hentes — det er ikke det samme
// som "ingen afvist", og forskellen er synlig: uden den ville et afvist
// forslag nå at blinke forbi, hver gang skærmen åbnes.
export function useAfviste(turUid: Reference | null | undefined): Set<string> | undefined {
  const raekker = useLiveQuery(
    async () => (turUid ? db.afviste_forslag.where('tur_uid').equals(turUid).toArray() : []),
    [turUid]
  );
  return raekker && new Set(raekker.map((r) => r.aftryk));
}

// Nej tak. Én række pr. forslag pr. tur: afviser man det samme forslag igen
// på et nyt grundlag, er det det nye aftryk, der skal gælde — ikke to.
export async function afvisForslag(turUid: Reference, forslag: Forslag): Promise<void> {
  await db.afviste_forslag.put({
    tur_uid: turUid,
    forslag_id: forslag.id,
    aftryk: aftrykAf(forslag),
    afvist: new Date()
  });
}

// Alt hvad turen har fået nej til. Bruges når turen forsvinder — en slettet
// tur, en kladde man begynder forfra på — så rækkerne ikke bliver liggende og
// tier et forslag ihjel på noget, der ikke findes mere.
//
// Rækkerne gives tilbage, så en fortrydelse kan lægge dem på plads igen.
export async function rydAfvisninger(turUid: Reference): Promise<() => Promise<void>> {
  const raekker = await db.afviste_forslag.where('tur_uid').equals(turUid).toArray();
  await db.afviste_forslag.where('tur_uid').equals(turUid).delete();

  return async () => {
    if (raekker.length > 0) await db.afviste_forslag.bulkPut(raekker);
  };
}
