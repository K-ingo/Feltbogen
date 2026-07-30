import { describe, it, expect } from 'vitest';
import Dexie from 'dexie';
import { migrerTilUid } from './db';

// Skemaet som det så ud før uid blev indført.
const V4_STORES = {
  items: '++id, navn, status, oprettet',
  grupper: '++id, navn, oprettet',
  ture: '++id, navn, startdato, status, oprettet',
  slettede: '++id, samling, pb_id, [samling+pb_id]'
};

const V5_STORES = {
  items: '++id, &uid, navn, status, oprettet',
  grupper: '++id, &uid, navn, oprettet',
  ture: '++id, &uid, navn, startdato, status, oprettet',
  slettede: '++id, samling, pb_id, [samling+pb_id]'
};

// Bygger en base i det gamle format, fylder den, og åbner den så med v5 —
// præcis det der sker på en enhed der opdaterer appen.
async function migrer(navn: string, fyld: (db: Dexie) => Promise<void>) {
  const gammel = new Dexie(navn);
  gammel.version(4).stores(V4_STORES);
  await gammel.open();
  await fyld(gammel);
  gammel.close();

  const ny = new Dexie(navn);
  ny.version(4).stores(V4_STORES);
  ny.version(5).stores(V5_STORES).upgrade(migrerTilUid);
  await ny.open();
  return ny;
}

const gammeltItem = (id: number, navn: string, pb_id?: string) => ({
  id, navn, pb_id,
  vaegt_g: 100, pris_kr: 0, dimensioner: '', antal: 1, delt: false, status: 'ejer',
  tags: [], kraever: [], komplementer: [],
  koebt_hos: '', koebsdato: '', koebslink: '', ordrenummer: '', garanti: null, noter: '',
  oprettet: new Date('2026-01-01'), aendret: new Date('2026-01-01')
});

describe('migration fra lokale id\'er til uid', () => {
  it('giver alle poster et uid og skriver gruppens referencer om', async () => {
    const db = await migrer('MigTest1', async (gammel) => {
      await gammel.table('items').bulkAdd([
        gammeltItem(1, 'Toaks 1L gryde'),
        gammeltItem(2, 'Fiskars X7 økse')
      ]);
      // Gruppen pegede på lokalt id 2 — øksen.
      await gammel.table('grupper').add({
        id: 1, navn: 'Bushcraft-værktøj', tags: [], item_ids: [2], noter: '',
        oprettet: new Date('2026-01-01'), aendret: new Date('2026-01-01')
      });
    });

    const items = await db.table('items').toArray();
    const gruppe = await db.table('grupper').get(1);

    expect(items.every((i) => typeof i.uid === 'string' && i.uid.length > 0)).toBe(true);

    // Referencen skal nu være øksens uid — og stadig pege på øksen.
    const oekse = items.find((i) => i.navn === 'Fiskars X7 økse');
    expect(gruppe.item_ids).toEqual([oekse.uid]);
    db.close();
  });

  it('skriver turens grupper, løse items og deltagere om', async () => {
    const db = await migrer('MigTest2', async (gammel) => {
      await gammel.table('items').bulkAdd([
        gammeltItem(1, 'Sovepose'),
        gammeltItem(2, 'Pandelampe')
      ]);
      await gammel.table('grupper').add({
        id: 1, navn: 'Søvn', tags: [], item_ids: [1], noter: '',
        oprettet: new Date('2026-01-01'), aendret: new Date('2026-01-01')
      });
      await gammel.table('ture').add({
        id: 1, navn: 'Uge 32', sted: '', koordinater: null,
        startdato: '2026-08-01', slutdato: '2026-08-03', naetter: 2, personer: 2,
        overnatning: 'shelter', aktivitet: 'bushcraft', terraen: 'skov',
        baereafstand_km: 0, erfaring: 'oevet', status: 'kladde',
        gruppe_ids: [1],
        loese_item_ids: [2],
        deltagere: [{
          id: 'd1', navn: 'Emil', overnatning: null,
          personligt_gear_ids: [1], baerer_delt_ids: [2]
        }],
        budget_linjer: [], besked_fra_ejer: '', noter: '', vejrsnapshot: '',
        oprettet: new Date('2026-01-01'), aendret: new Date('2026-01-01')
      });
    });

    const items = await db.table('items').toArray();
    const gruppe = await db.table('grupper').get(1);
    const tur = await db.table('ture').get(1);

    const sovepose = items.find((i) => i.navn === 'Sovepose');
    const lampe = items.find((i) => i.navn === 'Pandelampe');

    expect(tur.gruppe_ids).toEqual([gruppe.uid]);
    expect(tur.loese_item_ids).toEqual([lampe.uid]);
    expect(tur.deltagere[0].personligt_gear_ids).toEqual([sovepose.uid]);
    expect(tur.deltagere[0].baerer_delt_ids).toEqual([lampe.uid]);
    db.close();
  });

  it('bruger pb_id som uid for poster der allerede ligger på serveren', async () => {
    // Så bliver enheden enig med enhver anden enhed, der har hentet samme
    // record ned, uden at skulle synkronisere et nyt uid rundt.
    const db = await migrer('MigTest3', async (gammel) => {
      await gammel.table('items').add(gammeltItem(1, 'Allerede synkroniseret', 'pbXYZ'));
    });

    expect((await db.table('items').get(1)).uid).toBe('pbXYZ');
    db.close();
  });

  it('dropper referencer til gear der er slettet', async () => {
    const db = await migrer('MigTest4', async (gammel) => {
      await gammel.table('items').add(gammeltItem(1, 'Findes'));
      // id 99 blev slettet på et tidspunkt, men lå stadig i gruppen.
      await gammel.table('grupper').add({
        id: 1, navn: 'Med hul', tags: [], item_ids: [1, 99], noter: '',
        oprettet: new Date('2026-01-01'), aendret: new Date('2026-01-01')
      });
    });

    const item = await db.table('items').get(1);
    expect((await db.table('grupper').get(1)).item_ids).toEqual([item.uid]);
    db.close();
  });

  it('klarer en tom base', async () => {
    const db = await migrer('MigTest5', async () => {});
    expect(await db.table('items').count()).toBe(0);
    db.close();
  });
});
