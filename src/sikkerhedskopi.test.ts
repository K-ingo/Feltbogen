import { describe, it, expect, beforeEach, vi } from 'vitest';

vi.mock('./pb', () => import('./test/pbMock'));

import { db } from './db';
import { pbMock } from './test/pbMock';
import { lavEksport, gendan } from './sikkerhedskopi';
import { sendAltUsendt, hentFraPocketBase, opretTur, opretBillede, sletTur } from './sync';
import { kanVises, hero } from './billeder';
import { KOPI_VERSION } from './dataudveksling';
import { lavBillede, lavItem, lavTur } from './test/data';

// Sikkerhedskopien hele vejen rundt: ud af basen, basen ryddet, ind igen —
// med billederne. Det er det, man gør, når telefonen er væk.

const BYTES = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 1, 2, 3, 250, 0, 7]);
const ORIGINAL = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 9, 8, 7]);

async function bytesAf(blob: Blob | null | undefined): Promise<number[]> {
  if (!blob) return [];
  return Array.from(new Uint8Array(await blob.arrayBuffer()));
}

async function rydBasen() {
  await Promise.all([
    db.items.clear(), db.grupper.clear(), db.ture.clear(), db.steder.clear(),
    db.personer.clear(), db.billeder.clear(), db.tur_dage.clear(), db.slettede.clear()
  ]);
}

beforeEach(async () => {
  await rydBasen();
  pbMock.reset();
  vi.spyOn(console, 'error').mockImplementation(() => {});
  vi.spyOn(console, 'log').mockImplementation(() => {});
});

const ingenHentning = async () => null;

describe('eksport med billeder', () => {
  it('tager billedfilen med i kopien', async () => {
    await db.ture.add(lavTur({ uid: 't-1' }));
    await db.billeder.add(lavBillede({
      uid: 'b-1', tur_uid: 't-1', blob: new Blob([BYTES], { type: 'image/jpeg' })
    }));

    const eksport = await lavEksport(ingenHentning);
    const kopi = JSON.parse(eksport.json);

    expect(kopi.version).toBe(KOPI_VERSION);
    expect(kopi.billeder).toHaveLength(1);
    expect(kopi.billeder[0].data).toMatch(/^data:image\/jpeg;base64,/);
    expect(eksport.billeder).toBe(1);
    expect(eksport.uden_fil).toBe(0);
    // id, pb_id og selve blob'en hører ikke hjemme i en fil.
    expect('blob' in kopi.billeder[0]).toBe(false);
    expect('pb_id' in kopi.billeder[0]).toBe(false);
  });

  it('henter et billede ned, der kun ligger på serveren', async () => {
    await db.billeder.add(lavBillede({ uid: 'b-1', url: 'https://pb.test/api/files/b/1/x.jpg' }));
    const hent = vi.fn(async () => new Blob([BYTES], { type: 'image/jpeg' }));

    const eksport = await lavEksport(hent);

    expect(hent).toHaveBeenCalledWith('https://pb.test/api/files/b/1/x.jpg');
    expect(JSON.parse(eksport.json).billeder[0].data).toMatch(/^data:image\/jpeg;base64,/);
    expect(eksport.uden_fil).toBe(0);
  });

  // Uden dækning eller ved timeout skal kopien stadig kunne laves — men den
  // skal sige, at den mangler noget.
  it('tæller billeder, der ikke kunne hentes, og beholder linket', async () => {
    await db.billeder.add(lavBillede({ uid: 'b-1', url: 'https://pb.test/x.jpg' }));
    const hent = vi.fn(async () => { throw new Error('timeout'); });

    const eksport = await lavEksport(hent);
    const [billede] = JSON.parse(eksport.json).billeder;

    expect(eksport.uden_fil).toBe(1);
    expect(billede.data).toBe('');
    expect(billede.url).toBe('https://pb.test/x.jpg');
  });
});

describe('gendannelse med billeder', () => {
  it('lægger billedet tilbage, så det kan vises igen', async () => {
    await db.ture.add(lavTur({ uid: 't-1', hero_billede: 'b-2' }));
    await db.billeder.bulkAdd([
      lavBillede({ uid: 'b-1', tur_uid: 't-1', tid: '2026-07-10T09:00:00Z', blob: new Blob([BYTES], { type: 'image/jpeg' }) }),
      lavBillede({
        uid: 'b-2', tur_uid: 't-1', tid: '2026-07-10T10:00:00Z', beskrivelse: 'Udsigten',
        blob: new Blob([BYTES], { type: 'image/jpeg' }),
        original_blob: new Blob([ORIGINAL], { type: 'image/png' })
      })
    ]);
    const { json } = await lavEksport(ingenHentning);

    await rydBasen();
    const resultat = await gendan(json);

    expect(resultat.billeder).toHaveLength(2);
    const billeder = await db.billeder.toArray();
    expect(billeder).toHaveLength(2);

    const b2 = billeder.find((b) => b.uid === 'b-2')!;
    expect(b2.blob).toBeInstanceOf(Blob);
    expect(b2.blob?.type).toBe('image/jpeg');
    expect(await bytesAf(b2.blob)).toEqual(Array.from(BYTES));
    expect(b2.original_blob?.type).toBe('image/png');
    expect(await bytesAf(b2.original_blob)).toEqual(Array.from(ORIGINAL));
    expect(b2.beskrivelse).toBe('Udsigten');
    expect(b2.tur_uid).toBe('t-1');

    // Kan vises uden net — billedet ligger på enheden igen.
    expect(kanVises(b2, false)).toBe(true);

    // Forsiden peger på det samme billede som før.
    const tur = (await db.ture.toArray())[0];
    expect(hero(billeder, tur)?.uid).toBe('b-2');
  });

  it('sender de gendannede billeder op ad den almindelige vej', async () => {
    await db.billeder.add(lavBillede({
      uid: 'b-1', pb_id: 'gammel', url: 'https://gammel.test/x.jpg',
      blob: new Blob([BYTES], { type: 'image/jpeg' })
    }));
    const { json } = await lavEksport(ingenHentning);

    await rydBasen();
    await gendan(json);

    const foer = (await db.billeder.toArray())[0];
    // Det gamle link peger på en record, der måske er væk.
    expect(foer.url).toBe('');
    expect(foer.pb_id).toBeUndefined();
    expect(foer.usendt_aendring).toBe(true);

    await sendAltUsendt();

    const efter = (await db.billeder.toArray())[0];
    expect(efter.pb_id).toBeTruthy();
    expect(efter.url).toContain(efter.pb_id!);
    expect(pbMock.records.get('billeder')?.get(efter.pb_id!)?.fil).toBe('b-1.jpg');
  });

  it('beholder linket på et billede, der kom med uden fil', async () => {
    await db.billeder.add(lavBillede({ uid: 'b-1', url: 'https://pb.test/x.jpg' }));
    const { json } = await lavEksport(ingenHentning);

    await rydBasen();
    await gendan(json);

    const [billede] = await db.billeder.toArray();
    expect(billede.blob).toBeNull();
    expect(billede.url).toBe('https://pb.test/x.jpg');
    expect(kanVises(billede, true)).toBe(true);
  });

  it('fordobler ikke billeder, når den samme kopi læses ind to gange', async () => {
    await db.billeder.add(lavBillede({ uid: 'b-1', blob: new Blob([BYTES], { type: 'image/jpeg' }) }));
    await db.items.add(lavItem({ uid: 'i-1' }));
    const { json } = await lavEksport(ingenHentning);

    const anden = await gendan(json);

    expect(anden.tilfoejet).toBe(0);
    expect(anden.fandtes).toBe(2);
    expect(await db.billeder.count()).toBe(1);
  });

  it('læser en ældre kopi uden billeder', async () => {
    const v2 = JSON.stringify({
      version: 2, lavet: '', items: [lavItem({ uid: 'i-1' })], grupper: [], ture: [], steder: [], personer: []
    });

    const resultat = await gendan(v2);

    expect(resultat.tilfoejet).toBe(1);
    expect(resultat.billeder).toEqual([]);
  });
});

// Regression (0.2.20): opret tur med billeder og sync → eksportér → slet turen
// og sync → importér mens man er logget ind → ryd site data og log ind igen.
// Posterne kom op (POST 200), men gravstenene fra sletningen lå stadig, og
// hentningen skjulte dem — på denne enhed og alle andre.
describe('gendannelse vinder over gravsten', () => {
  const gravsten = () => [...(pbMock.records.get('slettede')?.values() ?? [])];

  async function turMedBilleder() {
    const turId = await opretTur(lavTur({ navn: 'Møn' }));
    const tur = (await db.ture.get(turId))!;
    for (const navn of ['a.jpg', 'b.jpg', 'c.jpg']) {
      await opretBillede(lavBillede({ tur_uid: tur.uid, navn, blob: new Blob([BYTES], { type: 'image/jpeg' }) }));
    }
    return { turId, tur };
  }

  it('kommer tilbage efter ryddet site data og nyt login', async () => {
    const { turId, tur } = await turMedBilleder();
    const kopi = (await lavEksport(ingenHentning)).json;

    await sletTur(turId);
    await sendAltUsendt();
    expect(gravsten()).toHaveLength(4);
    expect(await db.ture.count()).toBe(0);

    const flettet = await gendan(kopi);
    expect(flettet.tilfoejet).toBe(4);
    await sendAltUsendt();

    // Gravstenene for de gendannede poster er taget af.
    expect(gravsten()).toEqual([]);

    // Site data ryddet, logget ind igen: alt skal hentes fra serveren.
    await rydBasen();
    await hentFraPocketBase();

    expect(await db.ture.toArray()).toEqual([expect.objectContaining({ uid: tur.uid, navn: 'Møn' })]);
    expect(await db.billeder.where('tur_uid').equals(tur.uid).count()).toBe(3);
  });

  it('bliver stående ved næste hentning på samme enhed', async () => {
    const { turId, tur } = await turMedBilleder();
    const kopi = (await lavEksport(ingenHentning)).json;
    await sletTur(turId);

    await gendan(kopi);
    await sendAltUsendt();
    await hentFraPocketBase();
    await hentFraPocketBase();

    expect(await db.ture.where('uid').equals(tur.uid).count()).toBe(1);
    expect(await db.billeder.count()).toBe(3);
  });

  // Uden forbindelse kan gravstenen ikke tages af med det samme. Det record,
  // der kommer op bagefter, er nyere end den, og så vinder det alligevel.
  it('vinder også, når kopien blev læst ind uden forbindelse', async () => {
    const { turId, tur } = await turMedBilleder();
    const kopi = (await lavEksport(ingenHentning)).json;
    await sletTur(turId);

    pbMock.offline = true;
    await gendan(kopi);
    pbMock.offline = false;
    await sendAltUsendt();
    expect(gravsten()).toHaveLength(4);

    await rydBasen();
    await hentFraPocketBase();

    expect(await db.ture.where('uid').equals(tur.uid).count()).toBe(1);
    expect(await db.billeder.count()).toBe(3);
  });

  // Sletningen nåede aldrig op, før kopien blev læst ind. Sporet må ikke
  // sende en gravsten op bagefter, der er nyere end den gendannede post.
  it('lægger ikke en ventende gravsten oven på det gendannede', async () => {
    const { turId, tur } = await turMedBilleder();
    const kopi = (await lavEksport(ingenHentning)).json;

    pbMock.offline = true;
    await sletTur(turId);
    await gendan(kopi);
    pbMock.offline = false;
    await sendAltUsendt();

    expect(gravsten()).toEqual([]);
    expect(await db.slettede.count()).toBe(0);

    await rydBasen();
    await hentFraPocketBase();
    expect(await db.ture.where('uid').equals(tur.uid).count()).toBe(1);
    expect(await db.billeder.count()).toBe(3);
  });

  it('rører ikke gravsten for poster, kopien ikke indeholdt', async () => {
    pbMock.seed('slettede', 'grav-x', { samling: 'items', uid: 'u-andet' });
    const { tur } = await turMedBilleder();
    const kopi = (await lavEksport(ingenHentning)).json;
    await rydBasen();

    await gendan(kopi);

    expect(gravsten()).toEqual([expect.objectContaining({ uid: 'u-andet' })]);
    expect(await db.ture.where('uid').equals(tur.uid).count()).toBe(1);
  });
});
