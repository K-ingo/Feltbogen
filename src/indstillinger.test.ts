import { describe, it, expect, beforeEach } from 'vitest';
import Dexie from 'dexie';
import { db } from './db';
import { saet, laes, markerSet, ONBOARDING_SET } from './indstillinger';
import { lavItem, lavTur } from './test/data';

beforeEach(async () => {
  await db.indstillinger.clear();
  await db.items.clear();
});

describe('indstillinger', () => {
  it('gemmer og læser en værdi', async () => {
    await saet('proeve', 'ja');
    expect(await laes('proeve')).toBe('ja');
  });

  it('giver null for en nøgle der aldrig er sat', async () => {
    expect(await laes('findes-ikke')).toBeNull();
  });

  it('overskriver en værdi frem for at lægge en ny ved siden af', async () => {
    await saet('proeve', 'en');
    await saet('proeve', 'to');

    expect(await laes('proeve')).toBe('to');
    expect(await db.indstillinger.count()).toBe(1);
  });

  it('markerSet sætter et tidsstempel man kan se på', async () => {
    await markerSet(ONBOARDING_SET);

    const vaerdi = await laes(ONBOARDING_SET);
    expect(vaerdi).not.toBeNull();
    expect(Number.isNaN(new Date(vaerdi!).getTime())).toBe(false);
  });
});

// v6 tilføjer kun en tabel, men en migration der taber data er stadig værd at
// have et net under.
describe('migration til v6', () => {
  const V5_STORES = {
    items: '++id, &uid, navn, status, oprettet',
    grupper: '++id, &uid, navn, oprettet',
    ture: '++id, &uid, navn, startdato, status, oprettet',
    slettede: '++id, samling, pb_id, [samling+pb_id]'
  };
  const V6_STORES = { ...V5_STORES, indstillinger: '&noegle' };

  it('beholder eksisterende gear når indstillingstabellen kommer til', async () => {
    const navn = `MigrationV6_${crypto.randomUUID()}`;

    const gammel = new Dexie(navn);
    gammel.version(5).stores(V5_STORES);
    await gammel.open();
    await gammel.table('items').add(lavItem({ uid: 'u-1', navn: 'Moonquilt' }));
    gammel.close();

    const ny = new Dexie(navn);
    ny.version(5).stores(V5_STORES);
    ny.version(6).stores(V6_STORES);
    await ny.open();

    expect((await ny.table('items').toArray()).map((i) => i.navn)).toEqual(['Moonquilt']);
    expect(await ny.table('indstillinger').count()).toBe(0);
    ny.close();
  });
});

// v9 lægger to tabeller til. Ingen upgrade-funktion — men en migration der
// taber data er stadig værd at have et net under.
describe('migration til v9', () => {
  const V8_STORES = {
    items: '++id, &uid, navn, status, oprettet',
    grupper: '++id, &uid, navn, oprettet',
    ture: '++id, &uid, navn, startdato, status, oprettet, dele_token',
    slettede: '++id, samling, pb_id, [samling+pb_id]',
    indstillinger: '&noegle',
    delte_ture: '++id, &token, gemt'
  };
  const V9_STORES = {
    ...V8_STORES,
    steder: '++id, &uid, navn, oprettet',
    personer: '++id, &uid, navn, oprettet'
  };

  it('beholder gear og ture når steder og personer kommer til', async () => {
    const navn = `MigrationV9_${crypto.randomUUID()}`;

    const gammel = new Dexie(navn);
    gammel.version(8).stores(V8_STORES);
    await gammel.open();
    await gammel.table('items').add(lavItem({ uid: 'u-1', navn: 'Moonquilt' }));
    await gammel.table('ture').add(lavTur({ uid: 't-1', navn: 'Rold Skov' }));
    gammel.close();

    const ny = new Dexie(navn);
    ny.version(8).stores(V8_STORES);
    ny.version(9).stores(V9_STORES);
    await ny.open();

    expect((await ny.table('items').toArray()).map((i) => i.navn)).toEqual(['Moonquilt']);
    expect((await ny.table('ture').toArray()).map((t) => t.navn)).toEqual(['Rold Skov']);
    expect(await ny.table('steder').count()).toBe(0);
    expect(await ny.table('personer').count()).toBe(0);
    ny.close();
  });

  // Ture fra før v9 har hverken sted_uid eller person_uid. Tomt er den
  // rigtige værdi: de er ikke koblet til noget.
  it('lader ældre ture stå uden kobling frem for at gætte en', async () => {
    const navn = `MigrationV9Kobling_${crypto.randomUUID()}`;

    const gammel = new Dexie(navn);
    gammel.version(8).stores(V8_STORES);
    await gammel.open();
    await gammel.table('ture').add({
      uid: 't-1',
      navn: 'Feddet',
      sted: 'Feddet Strandcamping',
      deltagere: [{ id: 'd1', navn: 'Mikkel', overnatning: null, personligt_gear_ids: [], baerer_delt_ids: [] }],
      oprettet: new Date('2026-01-01'),
      aendret: new Date('2026-01-01')
    });
    gammel.close();

    const ny = new Dexie(navn);
    ny.version(8).stores(V8_STORES);
    ny.version(9).stores(V9_STORES);
    await ny.open();

    const tur = await ny.table('ture').get(1);
    expect(tur.sted).toBe('Feddet Strandcamping');
    expect(tur.sted_uid).toBeUndefined();
    expect(tur.deltagere[0].person_uid).toBeUndefined();
    ny.close();
  });
});
