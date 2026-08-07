import { describe, it, expect, beforeEach, vi } from 'vitest';

vi.mock('./pb', () => import('./test/pbMock'));

import { db } from './db';
import { pbMock } from './test/pbMock';
import { opretItem, opretGruppe, hentFraPocketBase, sendAltUsendt, fjernDubletter } from './sync';
import { itemsPaaTur } from './smartMotor';
import { lavItem, lavGruppe, lavTur } from './test/data';

beforeEach(async () => {
  await db.items.clear();
  await db.grupper.clear();
  await db.ture.clear();
  await db.slettede.clear();
  pbMock.reset();
  vi.spyOn(console, 'error').mockImplementation(() => {});
  vi.spyOn(console, 'log').mockImplementation(() => {});
});

// Dexies ++id tælles op pr. enhed, så id 1 betyder noget forskelligt to
// steder. Referencer skal derfor bruge uid. Uden det pegede en gruppe hentet
// fra en anden enhed på tilfældigt gear.
describe('data fra en anden enhed', () => {
  it('gruppen peger på det rigtige gear, selvom lokale id\'er er forskudt', async () => {
    // Enhed B har allerede sit eget item, så autoincrement starter forskudt.
    await opretItem(lavItem({ navn: 'B sit eget item' }));

    // Sådan ser enhed A's data ud på serveren.
    pbMock.seed('items', 'pbOekse', { uid: 'uid-oekse', navn: 'Fiskars X7 økse', antal: 1 });
    pbMock.seed('items', 'pbGryde', { uid: 'uid-gryde', navn: 'Toaks 1L gryde', antal: 1 });
    pbMock.seed('grupper', 'pbGruppe', {
      uid: 'uid-gruppe',
      navn: 'Bushcraft-værktøj',
      item_ids: ['uid-oekse']
    });

    await hentFraPocketBase();

    const gruppe = (await db.grupper.toArray())[0];
    const items = await db.items.toArray();
    const iGruppen = items.filter((i) => gruppe.item_ids.includes(i.uid));

    expect(iGruppen.map((i) => i.navn)).toEqual(['Fiskars X7 økse']);
  });

  it('turens pakkeliste rammer rigtigt på tværs af enheder', async () => {
    await opretItem(lavItem({ navn: 'Lokalt støj-item' }));

    pbMock.seed('items', 'pbTarp', { uid: 'uid-tarp', navn: 'TTTM Full Moon Tarp', antal: 1 });
    pbMock.seed('grupper', 'pbG', { uid: 'uid-g', navn: 'Hængekøje', item_ids: ['uid-tarp'] });
    pbMock.seed('ture', 'pbTur', { uid: 'uid-tur', navn: 'Uge 32', gruppe_ids: ['uid-g'] });

    await hentFraPocketBase();

    const tur = (await db.ture.toArray())[0];
    const grupper = await db.grupper.toArray();
    const items = await db.items.toArray();

    expect(itemsPaaTur(tur, grupper, items).map((i) => i.navn)).toEqual(['TTTM Full Moon Tarp']);
  });

  it('en gruppe lavet offline peger stadig rigtigt efter den er sendt op', async () => {
    pbMock.offline = true;
    const itemId = await opretItem(lavItem({ navn: 'Opinel No. 7' }));
    const item = await db.items.get(itemId);
    await opretGruppe(lavGruppe({ navn: 'Værktøj', item_ids: [item!.uid] }));
    pbMock.offline = false;

    await sendAltUsendt();

    // Referencen på serveren er uid'et, ikke et lokalt tal.
    const gruppePaaServer = [...(pbMock.records.get('grupper')?.values() ?? [])][0];
    expect(gruppePaaServer.item_ids).toEqual([item!.uid]);
    expect(gruppePaaServer.uid).toBe((await db.grupper.toArray())[0].uid);
  });

  it('henter ikke sin egen post ned igen som dublet', async () => {
    // Posten er sendt op af denne enhed og ligger nu på serveren.
    await opretItem(lavItem({ navn: 'Min egen' }));

    await hentFraPocketBase();

    expect(await db.items.count()).toBe(1);
  });

  it('falder tilbage til record-id når serveren ikke har uid-feltet', async () => {
    // Ældre records — eller en PocketBase-samling uden uid-felt.
    pbMock.seed('items', 'pbGammel', { navn: 'Gammelt item', antal: 1 });

    await hentFraPocketBase();

    const item = (await db.items.toArray())[0];
    // Record-id'et er også globalt unikt, så alle enheder når frem til samme
    // værdi og er dermed enige om identiteten.
    expect(item.uid).toBe('pbGammel');
  });
});

describe('uid tildeles ved oprettelse', () => {
  it('giver hver post et uid, også uden forbindelse', async () => {
    pbMock.offline = true;

    const id = await opretItem(lavItem({ navn: 'Offline-item' }));

    const item = await db.items.get(id);
    expect(item?.uid).toBeTruthy();
    expect(item?.pb_id).toBeUndefined();
  });

  it('giver to poster forskellige uid', async () => {
    const a = await opretItem(lavItem({ navn: 'En' }));
    const b = await opretItem(lavItem({ navn: 'To' }));

    expect((await db.items.get(a))?.uid).not.toBe((await db.items.get(b))?.uid);
  });

  it('sender uid med op til PocketBase', async () => {
    const id = await opretItem(lavItem({ navn: 'Sendt op' }));
    const lokal = await db.items.get(id);

    const paaServer = [...(pbMock.records.get('items')?.values() ?? [])][0];
    expect(paaServer.uid).toBe(lokal?.uid);
  });

  it('bevarer uid gennem en tur med deltagere', async () => {
    const item = lavItem({ uid: 'uid-sovepose', navn: 'Moonquilt' });
    const tur = lavTur({
      deltagere: [{
        id: 'd1',
        navn: 'Emil',
        overnatning: null,
        personligt_gear_ids: [item.uid],
        baerer_delt_ids: [],
        person_uid: ''
      }]
    });
    await db.items.add(item);
    await db.ture.add(tur);

    const gemt = (await db.ture.toArray())[0];
    expect(gemt.deltagere[0].personligt_gear_ids).toEqual(['uid-sovepose']);
  });
});

// PocketBase dropper lydløst felter der ikke findes i samlingens skema. Har
// samlingen intet uid-felt, kom posten tilbage med et andet uid end det
// lokale — og blev hentet ned igen som en dublet ved hver opstart.
describe('samling uden uid-felt i PocketBase', () => {
  it('henter ikke sine egne poster ned igen som dubletter', async () => {
    pbMock.udenUidFelt = true;

    await opretItem(lavItem({ navn: 'Test1' }));
    await opretItem(lavItem({ navn: 'Test2' }));
    await opretItem(lavItem({ navn: 'Test3' }));

    await hentFraPocketBase();

    const navne = (await db.items.toArray()).map((i) => i.navn).sort();
    expect(navne).toEqual(['Test1', 'Test2', 'Test3']);
  });

  it('dubler heller ikke ved gentagne opstarter', async () => {
    pbMock.udenUidFelt = true;
    await opretItem(lavItem({ navn: 'Kun én' }));

    await hentFraPocketBase();
    await hentFraPocketBase();
    await hentFraPocketBase();

    expect(await db.items.count()).toBe(1);
  });

  it('gælder også ture og grupper', async () => {
    pbMock.udenUidFelt = true;
    await opretGruppe(lavGruppe({ navn: 'Køkken' }));

    await hentFraPocketBase();

    expect(await db.grupper.count()).toBe(1);
  });
});

// Dubletterne der allerede er opstået skal ryddes op, uden at originalen på
// serveren forsvinder: begge lokale poster peger på samme record.
describe('oprydning af eksisterende dubletter', () => {
  it('fjerner dubletten lokalt og beholder den ældste', async () => {
    pbMock.udenUidFelt = true;
    await opretItem(lavItem({ navn: 'Test1' }));
    const original = (await db.items.toArray())[0];

    // Sådan så basen ud efter fejlen: samme pb_id, andet uid.
    await db.items.add(lavItem({ navn: 'Test1', uid: original.pb_id!, pb_id: original.pb_id }));
    expect(await db.items.count()).toBe(2);

    const fjernet = await fjernDubletter();

    expect(fjernet).toBe(1);
    const tilbage = await db.items.toArray();
    expect(tilbage).toHaveLength(1);
    expect(tilbage[0].uid).toBe(original.uid);
  });

  it('rører ikke posten i PocketBase', async () => {
    pbMock.udenUidFelt = true;
    await opretItem(lavItem({ navn: 'Test1' }));
    const original = (await db.items.toArray())[0];
    await db.items.add(lavItem({ navn: 'Test1', uid: original.pb_id!, pb_id: original.pb_id }));

    await fjernDubletter();

    // Begge lokale poster pegede på samme record — den skal stadig være der.
    expect(pbMock.ids('items')).toEqual([original.pb_id]);
    expect(await db.slettede.count()).toBe(0);
  });

  it('flytter gruppens reference over på den post der blev beholdt', async () => {
    pbMock.udenUidFelt = true;
    await opretItem(lavItem({ navn: 'Gryde' }));
    const original = (await db.items.toArray())[0];
    const dubletUid = original.pb_id!;
    await db.items.add(lavItem({ navn: 'Gryde', uid: dubletUid, pb_id: original.pb_id }));

    // Gruppen kom til at pege på dubletten.
    await db.grupper.add(lavGruppe({ navn: 'Køkken', item_ids: [dubletUid] }));

    await fjernDubletter();

    const gruppe = (await db.grupper.toArray())[0];
    expect(gruppe.item_ids).toEqual([original.uid]);
  });

  it('flytter også turens referencer og deltagernes gear', async () => {
    pbMock.udenUidFelt = true;
    await opretItem(lavItem({ navn: 'Sovepose' }));
    const original = (await db.items.toArray())[0];
    const dubletUid = original.pb_id!;
    await db.items.add(lavItem({ navn: 'Sovepose', uid: dubletUid, pb_id: original.pb_id }));

    await db.ture.add(lavTur({
      loese_item_ids: [dubletUid],
      deltagere: [{ id: 'd1', navn: 'Emil', overnatning: null, personligt_gear_ids: [dubletUid], baerer_delt_ids: [], person_uid: '' }]
    }));

    await fjernDubletter();

    const tur = (await db.ture.toArray())[0];
    expect(tur.loese_item_ids).toEqual([original.uid]);
    expect(tur.deltagere[0].personligt_gear_ids).toEqual([original.uid]);
  });

  it('gør ingenting når der ikke er dubletter', async () => {
    await opretItem(lavItem({ navn: 'Alene' }));
    expect(await fjernDubletter()).toBe(0);
    expect(await db.items.count()).toBe(1);
  });

  it('rører ikke poster der kun findes lokalt', async () => {
    pbMock.offline = true;
    await opretItem(lavItem({ navn: 'Uden pb_id A' }));
    await opretItem(lavItem({ navn: 'Uden pb_id B' }));

    expect(await fjernDubletter()).toBe(0);
    expect(await db.items.count()).toBe(2);
  });
});
