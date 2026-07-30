import { describe, it, expect, beforeEach, vi } from 'vitest';

// Mockes før sync.ts indlæses, så modulet får erstatningen.
vi.mock('./pb', () => import('./test/pbMock'));

import { db } from './db';
import { pbMock } from './test/pbMock';
import {
  opretItem,
  opdaterItem,
  sletItem,
  opretGruppe,
  sendAltUsendt,
  hentFraPocketBase
} from './sync';
import { lavItem, lavGruppe } from './test/data';

beforeEach(async () => {
  await db.items.clear();
  await db.grupper.clear();
  await db.ture.clear();
  await db.slettede.clear();
  pbMock.reset();
  vi.spyOn(console, 'error').mockImplementation(() => {});
  vi.spyOn(console, 'log').mockImplementation(() => {});
});

describe('opret', () => {
  it('skriver lokalt og sender til PocketBase', async () => {
    const id = await opretItem(lavItem({ navn: 'Toaks 1L gryde' }));

    const lokal = await db.items.get(id);
    expect(lokal?.navn).toBe('Toaks 1L gryde');
    expect(lokal?.pb_id).toBe('pb1');
    expect(pbMock.ids('items')).toEqual(['pb1']);
  });

  it('gemmer lokalt selvom PocketBase er nede', async () => {
    pbMock.offline = true;

    const id = await opretItem(lavItem({ navn: 'Offline-item' }));

    const lokal = await db.items.get(id);
    expect(lokal?.navn).toBe('Offline-item');
    expect(lokal?.pb_id).toBeUndefined();
  });
});

describe('opdater', () => {
  it('sender ændringen videre og rører aendret', async () => {
    const id = await opretItem(lavItem({ navn: 'Før', vaegt_g: 100 }));
    const foer = await db.items.get(id);

    await opdaterItem(id, { navn: 'Efter', vaegt_g: 155 });

    const efter = await db.items.get(id);
    expect(efter?.navn).toBe('Efter');
    expect(efter?.aendret.getTime()).toBeGreaterThanOrEqual(foer!.aendret.getTime());
    expect(pbMock.records.get('items')?.get('pb1')?.navn).toBe('Efter');
  });

  it('opretter i PocketBase hvis posten kun fandtes lokalt', async () => {
    pbMock.offline = true;
    const id = await opretItem(lavItem({ navn: 'Offline' }));
    pbMock.offline = false;

    await opdaterItem(id, { vaegt_g: 200 });

    expect((await db.items.get(id))?.pb_id).toBe('pb1');
    expect(pbMock.ids('items')).toEqual(['pb1']);
  });
});

describe('slet', () => {
  it('sletter både lokalt og i PocketBase', async () => {
    const id = await opretItem(lavItem({ navn: 'Væk' }));

    await sletItem(id);

    expect(await db.items.get(id)).toBeUndefined();
    expect(pbMock.ids('items')).toEqual([]);
    // Sletningen lykkedes, så der skal ikke ligge et spor tilbage.
    expect(await db.slettede.count()).toBe(0);
  });

  it('efterlader intet spor når posten aldrig nåede PocketBase', async () => {
    pbMock.offline = true;
    const id = await opretItem(lavItem({ navn: 'Kun lokal' }));

    await sletItem(id);

    expect(await db.items.get(id)).toBeUndefined();
    expect(await db.slettede.count()).toBe(0);
  });

  it('husker sletningen når PocketBase ikke kan nås', async () => {
    const id = await opretItem(lavItem({ navn: 'Slettet offline' }));
    pbMock.offline = true;

    await sletItem(id);

    expect(await db.items.get(id)).toBeUndefined();
    const spor = await db.slettede.toArray();
    expect(spor).toHaveLength(1);
    expect(spor[0]).toMatchObject({ samling: 'items', pb_id: 'pb1' });
  });

  it('behandler en post der allerede er slettet på serveren som færdig', async () => {
    const id = await opretItem(lavItem({ navn: 'Dobbeltslettet' }));
    // Fjernet af en anden enhed → PocketBase svarer 404.
    pbMock.records.get('items')?.delete('pb1');

    await sletItem(id);

    expect(await db.slettede.count()).toBe(0);
  });
});

// Kernen i fejlen: en post slettet offline blev hentet tilbage ved næste start.
describe('slettede poster genopstår ikke', () => {
  it('henter ikke en offline-slettet post tilbage', async () => {
    const id = await opretItem(lavItem({ navn: 'Skal blive væk' }));
    pbMock.offline = true;
    await sletItem(id);

    // Appen starter igen, stadig uden forbindelse til serveren.
    pbMock.offline = false;
    await hentFraPocketBase();

    expect(await db.items.count()).toBe(0);
    // Sporet holdes indtil serveren har bekræftet sletningen.
    expect(await db.slettede.count()).toBe(1);
  });

  it('fjerner posten på serveren næste gang der er forbindelse', async () => {
    const id = await opretItem(lavItem({ navn: 'Slettes senere' }));
    pbMock.offline = true;
    await sletItem(id);

    pbMock.offline = false;
    await sendAltUsendt();

    expect(pbMock.ids('items')).toEqual([]);
    expect(await db.slettede.count()).toBe(0);

    // Og den kommer stadig ikke tilbage.
    await hentFraPocketBase();
    expect(await db.items.count()).toBe(0);
  });

  it('holder sporet hvis serveren stadig ikke kan nås', async () => {
    const id = await opretItem(lavItem({ navn: 'Stadig offline' }));
    pbMock.offline = true;
    await sletItem(id);

    const resultat = await sendAltUsendt();

    expect(resultat.fejl).toBe(1);
    expect(await db.slettede.count()).toBe(1);
  });

  it('rører kun den samling sletningen hører til', async () => {
    const itemId = await opretItem(lavItem({ navn: 'Item' }));
    await opretGruppe(lavGruppe({ navn: 'Gruppe' }));
    pbMock.offline = true;
    await sletItem(itemId);
    pbMock.offline = false;

    await hentFraPocketBase();

    // Gruppen har samme pb-id-mønster, men må ikke rammes af item-sporet.
    expect(await db.items.count()).toBe(0);
    expect(await db.grupper.count()).toBe(1);
  });
});

describe('sendAltUsendt', () => {
  it('sender poster oprettet offline op', async () => {
    pbMock.offline = true;
    await opretItem(lavItem({ navn: 'En' }));
    await opretItem(lavItem({ navn: 'To' }));
    pbMock.offline = false;

    const resultat = await sendAltUsendt();

    expect(resultat).toEqual({ antal: 2, fejl: 0 });
    expect(pbMock.ids('items')).toHaveLength(2);
    expect((await db.items.toArray()).every((i) => i.pb_id)).toBe(true);
  });

  it('sender ikke det samme igen', async () => {
    await opretItem(lavItem({ navn: 'Allerede sendt' }));

    expect(await sendAltUsendt()).toEqual({ antal: 0, fejl: 0 });
  });
});

describe('hentFraPocketBase', () => {
  it('henter records vi ikke har lokalt, og oversætter felterne', async () => {
    pbMock.seed('items', 'pb9', {
      navn: 'Petromax Dutch Oven FT9',
      vaegt_g: 8100,
      pris_kr: 715,
      delt: true,
      status: 'ejer',
      tags: ['bål', 'gruppe'],
      antal: 1
    });

    await hentFraPocketBase();

    const items = await db.items.toArray();
    expect(items).toHaveLength(1);
    expect(items[0]).toMatchObject({
      pb_id: 'pb9',
      navn: 'Petromax Dutch Oven FT9',
      vaegt_g: 8100,
      delt: true,
      tags: ['bål', 'gruppe']
    });
    expect(items[0].oprettet).toBeInstanceOf(Date);
  });

  it('henter ikke poster vi allerede har', async () => {
    await opretItem(lavItem({ navn: 'Findes' }));

    await hentFraPocketBase();

    expect(await db.items.count()).toBe(1);
  });

  it('erstatter manglende og forkerte felter med brugbare standardværdier', async () => {
    // Sådan kan en record se ud hvis den er skrevet af en ældre version.
    pbMock.seed('items', 'pb9', { navn: 'Halv record', vaegt_g: 'ikke et tal', status: 'volapyk' });

    await hentFraPocketBase();

    const item = (await db.items.toArray())[0];
    expect(item.vaegt_g).toBe(0);
    expect(item.status).toBe('ejer');
    expect(item.tags).toEqual([]);
    expect(item.garanti).toBeNull();
  });

  it('lader lokale data være i fred når serveren ikke svarer', async () => {
    await opretItem(lavItem({ navn: 'Min ting' }));
    pbMock.offline = true;

    await hentFraPocketBase();

    expect(await db.items.count()).toBe(1);
  });
});
