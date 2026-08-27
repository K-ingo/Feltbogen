import { describe, it, expect, beforeEach, vi } from 'vitest';

vi.mock('./pb', () => import('./test/pbMock'));

import { db } from './db';
import { pbMock } from './test/pbMock';
import {
  opretItem,
  opdaterItem,
  opretGruppe,
  opretTur,
  hentFraPocketBase,
  sendAltUsendt,
  sendAfventende
} from './sync';
import { lavItem, lavGruppe, lavTur } from './test/data';

beforeEach(async () => {
  await db.items.clear();
  await db.grupper.clear();
  await db.ture.clear();
  await db.slettede.clear();
  pbMock.reset();
  vi.spyOn(console, 'error').mockImplementation(() => {});
  vi.spyOn(console, 'warn').mockImplementation(() => {});
  vi.spyOn(console, 'log').mockImplementation(() => {});
});

// Opretter et item, sender det op og venter til køen er tom, så posten står
// som "enig med serveren" inden testen begynder.
async function itemPaaServeren(felter = {}) {
  const id = await opretItem(lavItem({ navn: 'Moonquilt', ...felter }));
  await sendAfventende();
  return { id, post: (await db.items.get(id))! };
}

describe('ændringer fra en anden enhed hentes ned', () => {
  it('opdaterer en post der er rettet på serveren', async () => {
    const { id, post } = await itemPaaServeren({ vaegt_g: 780 });

    pbMock.roer('items', post.pb_id!, { navn: 'Moonquilt PRO', vaegt_g: 810 });
    await hentFraPocketBase();

    const efter = await db.items.get(id);
    expect(efter?.navn).toBe('Moonquilt PRO');
    expect(efter?.vaegt_g).toBe(810);
  });

  it('rører ikke posten når serveren ikke har ændret sig', async () => {
    const { id } = await itemPaaServeren();
    await opdaterItem(id, { navn: 'Rettet lokalt' });
    await sendAfventende();

    // Ingen ændring deroppe siden sidst.
    await hentFraPocketBase();

    expect((await db.items.get(id))?.navn).toBe('Rettet lokalt');
  });

  it('laver ikke en dublet ud af en post den henter ned', async () => {
    const { post } = await itemPaaServeren();

    pbMock.roer('items', post.pb_id!, { navn: 'Rettet andetsteds' });
    await hentFraPocketBase();
    await hentFraPocketBase();

    expect(await db.items.count()).toBe(1);
  });

  // Uden det her ville næste hentning tro at posten var rørt igen.
  it('husker serverens tidsstempel, så den samme ændring ikke hentes to gange', async () => {
    const { id, post } = await itemPaaServeren();

    pbMock.roer('items', post.pb_id!, { navn: 'Ny' });
    await hentFraPocketBase();
    const efterFoerste = await db.items.get(id);

    await opdaterItem(id, { navn: 'Rettet her bagefter' });
    await hentFraPocketBase();

    expect(efterFoerste?.server_aendret).toBeTruthy();
    expect((await db.items.get(id))?.navn).toBe('Rettet her bagefter');
  });

  it('gælder også grupper', async () => {
    await opretGruppe(lavGruppe({ navn: 'Køkken' }));
    await sendAfventende();
    const gruppe = (await db.grupper.toArray())[0];

    pbMock.roer('grupper', gruppe.pb_id!, { navn: 'Køkkengrej' });
    await hentFraPocketBase();

    expect((await db.grupper.toArray())[0].navn).toBe('Køkkengrej');
  });
});

describe('når begge sider har ændret sig vinder den nyeste', () => {
  it('serverens udgave vinder når den er nyest', async () => {
    const { id, post } = await itemPaaServeren();

    // Redigeret her mens vi var offline...
    await db.items.update(id, {
      navn: 'Lokal ændring',
      aendret: new Date('2026-07-01T09:00:00Z'),
      usendt_aendring: true
    });
    // ...og deroffen bagefter.
    pbMock.roer('items', post.pb_id!, { navn: 'Server-ændring' });

    await hentFraPocketBase();

    expect((await db.items.get(id))?.navn).toBe('Server-ændring');
  });

  it('den lokale udgave vinder når den er nyest og bliver sendt op', async () => {
    const { id, post } = await itemPaaServeren();

    pbMock.roer('items', post.pb_id!, { navn: 'Ældre server-ændring' });
    await db.items.update(id, {
      navn: 'Nyere lokal ændring',
      aendret: new Date('2030-01-01T00:00:00Z'),
      usendt_aendring: true
    });

    await hentFraPocketBase();
    expect((await db.items.get(id))?.navn).toBe('Nyere lokal ændring');

    await sendAltUsendt();
    expect(pbMock.records.get('items')?.get(post.pb_id!)?.navn).toBe('Nyere lokal ændring');
  });

  it('rydder markeringen når serverens udgave overtager', async () => {
    const { id, post } = await itemPaaServeren();

    await db.items.update(id, {
      navn: 'Taber',
      aendret: new Date('2026-07-01T09:00:00Z'),
      usendt_aendring: true
    });
    pbMock.roer('items', post.pb_id!, { navn: 'Vinder' });

    await hentFraPocketBase();

    expect((await db.items.get(id))?.usendt_aendring).toBe(false);
  });
});

// Grupper og ture peger på items med uid. Serveren kan sende et andet uid
// tilbage — den har ikke nødvendigvis feltet — og skriver man det ind, river
// man referencerne over.
describe('uid overlever en hentning', () => {
  it('beholder det lokale uid når serverens udgave overtager', async () => {
    const { id, post } = await itemPaaServeren();
    const uidFoer = post.uid;

    pbMock.roer('items', post.pb_id!, { navn: 'Rettet', uid: 'et-helt-andet-uid' });
    await hentFraPocketBase();

    const efter = await db.items.get(id);
    expect(efter?.navn).toBe('Rettet');
    expect(efter?.uid).toBe(uidFoer);
  });

  it('gruppens reference peger stadig rigtigt bagefter', async () => {
    pbMock.udenUidFelt = true;
    const { id, post } = await itemPaaServeren({ navn: 'Gryde' });
    await opretGruppe(lavGruppe({ navn: 'Køkken', item_ids: [post.uid] }));
    await sendAfventende();

    pbMock.roer('items', post.pb_id!, { navn: 'Toaks 1L' });
    await hentFraPocketBase();

    const gruppe = (await db.grupper.toArray())[0];
    const item = await db.items.get(id);
    expect(item?.navn).toBe('Toaks 1L');
    expect(gruppe.item_ids).toEqual([item!.uid]);
  });
});

describe('en post lavet offline mødes med sin egen record', () => {
  it('knytter sig til den frem for at ligge dobbelt', async () => {
    pbMock.offline = true;
    const id = await opretItem(lavItem({ navn: 'Offline' }));
    pbMock.offline = false;

    // Den samme post nåede op fra en anden enhed imens — fx fordi begge
    // enheder havde læst den samme sikkerhedskopi ind. Samme uid, anden
    // record end den denne enhed ville have lavet.
    const uid = (await db.items.get(id))!.uid;
    pbMock.seed('items', 'pbAndet', { uid, navn: 'Fra en anden enhed', antal: 1 });

    await hentFraPocketBase();

    expect(await db.items.count()).toBe(1);
    expect((await db.items.get(id))?.pb_id).toBe('pbAndet');
  });
});

describe('sletning holder', () => {
  it('henter ikke en post tilbage der er slettet lokalt', async () => {
    const { post } = await itemPaaServeren();
    await db.items.clear();
    await db.slettede.add({ samling: 'items', pb_id: post.pb_id!, slettet: new Date() });

    pbMock.roer('items', post.pb_id!, { navn: 'Rørt efter sletningen' });
    await hentFraPocketBase();

    expect(await db.items.count()).toBe(0);
  });
});


// Et felt der læses ned uden også at blive sendt op, er ikke et halvt felt —
// det er et felt der bliver slettet. Serverens udgave vinder ved en flettning
// og skriver den tomme værdi ind over den lokale.
describe('felter på en tur overlever at turen bliver hentet ned', () => {
  async function turPaaServeren(felter = {}) {
    const id = await opretTur(lavTur(felter));
    await sendAfventende();
    return { id, post: (await db.ture.get(id))! };
  }

  it('mister ikke forsidebilledet når turen rettes et andet sted', async () => {
    const { id, post } = await turPaaServeren({ hero_billede: 'billede-uid-1' });

    // En anden enhed retter navnet. Serverens udgave er nyest og vinder.
    pbMock.roer('ture', post.pb_id!, { navn: 'Rettet på PC' });
    await hentFraPocketBase();

    const efter = await db.ture.get(id);
    expect(efter?.navn).toBe('Rettet på PC');
    expect(efter?.hero_billede).toBe('billede-uid-1');
  });

  it('mister ikke bookingen når turen rettes et andet sted', async () => {
    const booking = { link: 'https://udinaturen.dk/shelter/42', booket: true, reference: 'ABC-123' };
    const { id, post } = await turPaaServeren({ booking });

    pbMock.roer('ture', post.pb_id!, { navn: 'Rettet på PC' });
    await hentFraPocketBase();

    expect((await db.ture.get(id))?.booking).toEqual(booking);
  });
});
