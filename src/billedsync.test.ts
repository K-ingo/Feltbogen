import { describe, it, expect, beforeEach, vi } from 'vitest';

vi.mock('./pb', () => import('./test/pbMock'));

import { db } from './db';
import { pbMock } from './test/pbMock';
import {
  opdaterBillede,
  opretBillede,
  opretTur,
  sendAltUsendt,
  sletBillede,
  sletTur
} from './sync';
import { lavTur } from './test/data';

const FORSINKELSE = 800;

beforeEach(async () => {
  await Promise.all([db.items.clear(), db.ture.clear(), db.billeder.clear(), db.slettede.clear()]);
  pbMock.reset();
  vi.spyOn(console, 'error').mockImplementation(() => {});
  vi.spyOn(console, 'log').mockImplementation(() => {});
});

const foto = (felter: Record<string, unknown> = {}) => ({
  navn: 'IMG_0421.jpg',
  tur_uid: 't-1',
  tid: '2026-07-10T09:00:00Z',
  bredde: 1600,
  hoejde: 1200,
  byte: 240_000,
  blob: new Blob(['billeddata'], { type: 'image/jpeg' }),
  url: '',
  beskrivelse: '',
  oprettet: new Date(),
  aendret: new Date(),
  ...felter
});

const billedKald = (metode: string) =>
  pbMock.kald.filter((k) => k.metode === metode && k.samling === 'billeder').length;

describe('billeder op i PocketBase', () => {
  it('sender filen med og gemmer url\'en fra svaret', async () => {
    const id = await opretBillede(foto());

    const gemt = await db.billeder.get(id);
    expect(gemt?.pb_id).toBe('pb1');
    // Url'en kan kun komme fra serverens svar.
    expect(gemt?.url).toContain('pb1');
    expect(pbMock.records.get('billeder')?.get('pb1')?.fil).toBe(`${gemt?.uid}.jpg`);
  });

  // Det er hele pointen: man tager billeder i en skov uden dækning.
  it('gemmer billedet lokalt selvom serveren ikke kan nås', async () => {
    pbMock.offline = true;
    const id = await opretBillede(foto());

    const gemt = await db.billeder.get(id);
    expect(gemt?.blob).toBeInstanceOf(Blob);
    // Uden pb_id er posten stadig i kø — det er sådan sendAltUsendt finder den.
    expect(gemt?.pb_id).toBeUndefined();
    expect(gemt?.url).toBe('');
  });

  it('sender det op når der er dækning igen', async () => {
    pbMock.offline = true;
    const id = await opretBillede(foto());

    pbMock.offline = false;
    await sendAltUsendt();

    const gemt = await db.billeder.get(id);
    expect(gemt?.pb_id).toBe('pb1');
    expect(gemt?.url).toContain('pb1');
    expect(pbMock.ids('billeder')).toEqual(['pb1']);
  });

  // Filen fylder. En opdatering af beskrivelsen må ikke lægge den op igen.
  it('sender ikke filen med når kun beskrivelsen rettes', async () => {
    const id = await opretBillede(foto());
    expect(billedKald('create')).toBe(1);

    await opdaterBillede(id, { beskrivelse: 'Frost i tarpen' });
    await new Promise((r) => setTimeout(r, FORSINKELSE + 60));

    expect(billedKald('create')).toBe(1);
    const oppe = pbMock.records.get('billeder')?.get('pb1');
    expect(oppe?.beskrivelse).toBe('Frost i tarpen');
    // Filnavnet står stadig som det gjorde efter oprettelsen.
    expect(oppe?.fil).toContain('.jpg');
  });

  it('sletter billedet begge steder', async () => {
    const id = await opretBillede(foto());

    await sletBillede(id);

    expect(await db.billeder.count()).toBe(0);
    expect(pbMock.ids('billeder')).toEqual([]);
  });
});

describe('billeder følger turen', () => {
  const opretTurMedFotos = async () => {
    const turId = await opretTur(lavTur({ navn: 'Vinterlejr' }));
    const tur = await db.ture.get(turId);
    await opretBillede(foto({ tur_uid: tur!.uid, navn: 'a.jpg' }));
    await opretBillede(foto({ tur_uid: tur!.uid, navn: 'b.jpg' }));
    return { turId, turUid: tur!.uid };
  };

  // Et billede uden sin tur er ikke til at finde igen, og ville blive
  // liggende i basen for evigt.
  it('sletter turens billeder med turen', async () => {
    const { turId } = await opretTurMedFotos();
    expect(await db.billeder.count()).toBe(2);

    await sletTur(turId);

    expect(await db.ture.count()).toBe(0);
    expect(await db.billeder.count()).toBe(0);
    expect(pbMock.ids('billeder')).toEqual([]);
  });

  it('lægger billederne tilbage når sletningen fortrydes', async () => {
    const { turId, turUid } = await opretTurMedFotos();

    const genskab = await sletTur(turId);
    await genskab?.();

    expect(await db.ture.count()).toBe(1);
    const tilbage = await db.billeder.toArray();
    expect(tilbage).toHaveLength(2);
    // uid'et er identiteten, så billederne hører stadig til den samme tur.
    expect(tilbage.every((b) => b.tur_uid === turUid)).toBe(true);
    expect(tilbage.map((b) => b.navn).sort()).toEqual(['a.jpg', 'b.jpg']);
  });

  it('rører ikke billeder fra andre ture', async () => {
    const { turId } = await opretTurMedFotos();
    await opretBillede(foto({ tur_uid: 'en-anden-tur', navn: 'fremmed.jpg' }));

    await sletTur(turId);

    expect((await db.billeder.toArray()).map((b) => b.navn)).toEqual(['fremmed.jpg']);
  });
});
