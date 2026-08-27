import { describe, it, expect, beforeEach, vi } from 'vitest';

// Mockes før sync.ts indlæses, så modulet får erstatningen.
vi.mock('./pb', () => import('./test/pbMock'));

import { db } from './db';
import { pbMock, blokerNaesteUpdate } from './test/pbMock';
import {
  opretItem,
  opdaterItem,
  sletItem,
  opretGruppe,
  opretTur,
  sendAltUsendt,
  sendAfventende,
  hentFraPocketBase,
  afstemMedServer
} from './sync';
import { lavItem, lavGruppe, lavTur } from './test/data';

// Opdateringer samles i 800 ms før de sendes.
const FORSINKELSE = 800;

beforeEach(async () => {
  await db.items.clear();
  await db.grupper.clear();
  await db.ture.clear();
  await db.slettede.clear();
  pbMock.reset();
  vi.spyOn(console, 'error').mockImplementation(() => {});
  vi.spyOn(console, 'log').mockImplementation(() => {});
});

const pbKald = (metode: string) => pbMock.kald.filter((k) => k.metode === metode).length;

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
    await sendAfventende();

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
    await sendAfventende();

    expect((await db.items.get(id))?.pb_id).toBe('pb1');
    expect(pbMock.ids('items')).toEqual(['pb1']);
  });
});

// Uden dette bliver hvert tastetryk i et felt sin egen HTTP-request.
describe('opdateringer samles før de sendes', () => {
  it('skriver lokalt med det samme, uden at vente på serveren', async () => {
    const id = await opretItem(lavItem({ navn: 'Start' }));
    const kaldFoer = pbKald('update');

    await opdaterItem(id, { navn: 'Ændret' });

    // Lokalt er det på plads …
    expect((await db.items.get(id))?.navn).toBe('Ændret');
    // … men serveren er endnu ikke kontaktet.
    expect(pbKald('update')).toBe(kaldFoer);
  });

  it('samler en hel indtastning til én request', async () => {
    const id = await opretItem(lavItem({ navn: '' }));
    const kaldFoer = pbKald('update');

    for (const navn of ['T', 'To', 'Toa', 'Toak', 'Toaks']) {
      await opdaterItem(id, { navn });
    }
    await sendAfventende();

    expect(pbKald('update') - kaldFoer).toBe(1);
    // Og det er den sidste værdi der nåede op.
    expect(pbMock.records.get('items')?.get('pb1')?.navn).toBe('Toaks');
  });

  it('holder poster hver for sig', async () => {
    const et = await opretItem(lavItem({ navn: 'Et' }));
    const to = await opretItem(lavItem({ navn: 'To' }));
    const kaldFoer = pbKald('update');

    await opdaterItem(et, { vaegt_g: 1 });
    await opdaterItem(to, { vaegt_g: 2 });
    await sendAfventende();

    expect(pbKald('update') - kaldFoer).toBe(2);
  });

  it('sender af sig selv når man holder pause', async () => {
    const id = await opretItem(lavItem({ navn: 'Uden flush' }));
    const kaldFoer = pbKald('update');

    await opdaterItem(id, { navn: 'Sendt af timeren' });
    await new Promise((klar) => setTimeout(klar, FORSINKELSE + 200));

    expect(pbKald('update') - kaldFoer).toBe(1);
    expect(pbMock.records.get('items')?.get('pb1')?.navn).toBe('Sendt af timeren');
  });
});

// Debouncing udskyder sync, så en ændring kan mangle at nå op hvis appen
// lukkes. Flaget gør at den bliver prøvet igen.
describe('uafsendte ændringer prøves igen', () => {
  it('markerer posten indtil serveren har kvitteret', async () => {
    const id = await opretItem(lavItem({ navn: 'Start' }));

    await opdaterItem(id, { navn: 'Venter' });
    expect((await db.items.get(id))?.usendt_aendring).toBe(true);

    await sendAfventende();
    expect((await db.items.get(id))?.usendt_aendring).toBe(false);
  });

  it('beholder markeringen når sync fejler', async () => {
    const id = await opretItem(lavItem({ navn: 'Start' }));
    pbMock.offline = true;

    await opdaterItem(id, { navn: 'Nåede ikke op' });
    await sendAfventende();

    expect((await db.items.get(id))?.usendt_aendring).toBe(true);
  });

  it('sender ændringen ved næste opstart', async () => {
    const id = await opretItem(lavItem({ navn: 'Start' }));
    pbMock.offline = true;
    await opdaterItem(id, { navn: 'Efter genstart' });
    await sendAfventende();

    // Appen åbnes igen, nu med forbindelse.
    pbMock.offline = false;
    const resultat = await sendAltUsendt();

    expect(resultat).toEqual({ antal: 1, fejl: 0 });
    expect(pbMock.records.get('items')?.get('pb1')?.navn).toBe('Efter genstart');
    expect((await db.items.get(id))?.usendt_aendring).toBe(false);
  });

  it('rydder ikke markeringen hvis posten blev redigeret igen undervejs', async () => {
    const id = await opretItem(lavItem({ navn: 'Start' }));
    await opdaterItem(id, { navn: 'Første' });

    // Hold serveren i luften, så vi med sikkerhed rammer vinduet mellem
    // "kaldet er sendt" og "svaret er kommet".
    const { naaet, slip } = blokerNaesteUpdate();
    const foerste = sendAfventende();
    await naaet;

    // Ny redigering netop nu må ikke få flaget ryddet af det første svar.
    await opdaterItem(id, { navn: 'Anden' });
    slip();
    await foerste;

    expect((await db.items.get(id))?.usendt_aendring).toBe(true);

    // Og den anden ændring kommer op bagefter.
    await sendAfventende();
    expect(pbMock.records.get('items')?.get('pb1')?.navn).toBe('Anden');
    expect((await db.items.get(id))?.usendt_aendring).toBe(false);
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

describe('fortryd sletning', () => {
  it('lægger posten tilbage med samme uid', async () => {
    const id = await opretItem(lavItem({ navn: 'Fortrudt', vaegt_g: 640 }));
    const uid = (await db.items.get(id))?.uid;

    const genskab = await sletItem(id);
    expect(await db.items.count()).toBe(0);

    await genskab?.();

    const tilbage = await db.items.get(id);
    expect(tilbage?.navn).toBe('Fortrudt');
    expect(tilbage?.vaegt_g).toBe(640);
    expect(tilbage?.uid).toBe(uid);
  });

  // Det egentlige argument for at beholde uid'et: grupper og pakkelister
  // peger på det, og en fortrudt sletning skal være hel.
  it('får grejet tilbage i de grupper det lå i', async () => {
    const itemId = await opretItem(lavItem({ navn: 'Tarp' }));
    const uid = (await db.items.get(itemId))!.uid;
    await opretGruppe(lavGruppe({ navn: 'Sommer', item_ids: [uid] }));

    const genskab = await sletItem(itemId);
    await genskab?.();

    const gruppe = (await db.grupper.toArray())[0];
    const item = await db.items.get(itemId);
    expect(gruppe.item_ids).toContain(item?.uid);
  });

  it('opretter posten på ny i PocketBase', async () => {
    const id = await opretItem(lavItem({ navn: 'Op igen' }));

    const genskab = await sletItem(id);
    expect(pbMock.ids('items')).toEqual([]);

    await genskab?.();

    expect(pbMock.ids('items')).toHaveLength(1);
    // Den gamle post deroppe er væk, så den genskabte skal have sit eget id.
    expect(await db.items.get(id)).toMatchObject({ pb_id: 'pb2' });
  });

  // Sletningen står ved magt indtil den fortrydes. Sker det aldrig, må
  // sporet stadig få serveren til at glemme posten.
  it('lader sporet fjerne den gamle post når sletningen skete offline', async () => {
    const id = await opretItem(lavItem({ navn: 'Slettet uden dækning' }));
    pbMock.offline = true;
    const genskab = await sletItem(id);

    pbMock.offline = false;
    await genskab?.();
    await sendAltUsendt();

    // Den gamle pb1 er væk, den genskabte har sit eget id — og der er kun én.
    expect(pbMock.ids('items')).toEqual(['pb2']);
    expect(await db.slettede.count()).toBe(0);
    expect(await db.items.count()).toBe(1);
  });

  it('giver ingen vej tilbage når der ikke var noget at slette', async () => {
    expect(await sletItem(9999)).toBeNull();
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

// Kaldes ved opstart og når forbindelsen kommer tilbage midt i en session.
describe('afstemMedServer', () => {
  it('sender det usendte op og henter det vi mangler ned', async () => {
    pbMock.offline = true;
    await opretItem(lavItem({ navn: 'Lavet i skoven' }));
    pbMock.offline = false;
    pbMock.seed('items', 'pbAndenEnhed', { navn: 'Lavet på pc', antal: 1 });

    await afstemMedServer();

    const navne = (await db.items.toArray()).map((i) => i.navn).sort();
    expect(navne).toEqual(['Lavet i skoven', 'Lavet på pc']);
    // Den offline-oprettede har nu et pb_id.
    expect((await db.items.where('navn').equals('Lavet i skoven').first())?.pb_id).toBeTruthy();
  });

  it('lægger samtidige kørsler sammen, så en post ikke oprettes to gange', async () => {
    pbMock.offline = true;
    await opretItem(lavItem({ navn: 'Kun én gang' }));
    pbMock.offline = false;
    const kaldFoer = pbKald('create');

    // Flakkende forbindelse kan udløse online-eventet flere gange i samme tick.
    const foerste = afstemMedServer();
    const anden = afstemMedServer();

    expect(anden).toBe(foerste);
    await Promise.all([foerste, anden]);

    expect(pbKald('create') - kaldFoer).toBe(1);
    expect(pbMock.ids('items')).toHaveLength(1);
  });

  it('starter en ny kørsel når den forrige er færdig', async () => {
    const foerste = afstemMedServer();
    await foerste;

    const anden = afstemMedServer();
    expect(anden).not.toBe(foerste);
    await anden;
  });

  it('fejler ikke selvom serveren er utilgængelig', async () => {
    await opretItem(lavItem({ navn: 'Findes lokalt' }));
    pbMock.offline = true;

    await expect(afstemMedServer()).resolves.toBeUndefined();
    expect(await db.items.count()).toBe(1);
  });
});


// ─────────────────────────────────────────────
// Sender vi hele posten op?
//
// `hero_billede` og `booking` blev læst ned fra PocketBase og aldrig sendt op.
// Hver funktion for sig var rigtig, og turen mistede sin forside alligevel:
// et felt der kun læses, bliver slettet, fordi serverens tomme værdi vinder
// den næste flettning. Fejlen levede, indtil nogen tilfældigt kiggede på den.
//
// Grunden til at den kunne leve så længe, er at PocketBase ikke siger fra.
// Sender man et felt, skemaet ikke kender, dropper den det lydløst — og
// sender man det slet ikke, sker der pr. definition ingenting.
//
// Testen herunder er ikke en test af et bestemt felt. Den læser felterne på
// posten og kræver, at hvert eneste af dem er med i det, der bliver sendt.
// Lægger nogen et felt på `Tur` uden at føre det ind i `tilPb`, falder den —
// og det er præcis det øjeblik, fejlen ellers ville blive født i.
// ─────────────────────────────────────────────

// Det der med vilje bliver hjemme. `id` er Dexies egen tæller, `pb_id` og
// `server_aendret` hører til synkroniseringen selv, og `usendt_aendring` er
// et lokalt flag. `oprettet` og `aendret` sættes af serveren som `created` og
// `updated` og må ikke skrives ovenfra.
const KUN_LOKALT = ['id', 'pb_id', 'server_aendret', 'usendt_aendring', 'oprettet', 'aendret'];

describe('alle felter kommer med op', () => {
  it('sender hvert felt på turen til PocketBase', async () => {
    const { id: _id, uid: _uid, ...tur } = lavTur();
    void _id;
    void _uid;

    await opretTur(tur);

    const sendt = pbMock.records.get('ture')?.get('pb1');
    expect(sendt).toBeDefined();

    const glemte = Object.keys(tur).filter((felt) => !KUN_LOKALT.includes(felt) && !(felt in sendt!));
    expect(glemte).toEqual([]);
  });

  it('sender hvert felt på et stykke grej', async () => {
    const { id: _id, uid: _uid, ...item } = lavItem();
    void _id;
    void _uid;

    await opretItem(item);

    const sendt = pbMock.records.get('items')?.get('pb1');
    const glemte = Object.keys(item).filter((felt) => !KUN_LOKALT.includes(felt) && !(felt in sendt!));
    expect(glemte).toEqual([]);
  });

  it('sender hvert felt på et grejsæt', async () => {
    const { id: _id, uid: _uid, ...gruppe } = lavGruppe();
    void _id;
    void _uid;

    await opretGruppe(gruppe);

    const sendt = pbMock.records.get('grupper')?.get('pb1');
    const glemte = Object.keys(gruppe).filter((felt) => !KUN_LOKALT.includes(felt) && !(felt in sendt!));
    expect(glemte).toEqual([]);
  });
});
