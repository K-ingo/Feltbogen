import { describe, it, expect, beforeEach } from 'vitest';
import Dexie from 'dexie';
import { db } from './db';
import { saet, laes, markerSet, ONBOARDING_SET } from './indstillinger';
import { lavItem } from './test/data';

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
