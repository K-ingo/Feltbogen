import { describe, it, expect, beforeEach, vi } from 'vitest';

vi.mock('./pb', () => import('./test/pbMock'));

import { db } from './db';
import { opretTur, sletTur } from './sync';
import { afvisForslag, rydAfvisninger } from './afviste';
import { aftrykAf, forslagTilTur } from './forslag';
import type { Forslag } from './forslag';
import { lavItem, lavTur } from './test/data';

beforeEach(async () => {
  await Promise.all([db.afviste_forslag.clear(), db.ture.clear(), db.slettede.clear()]);
});

const TUR = 'tur-1';

function etForslag(overskriv: Partial<Forslag> = {}): Forslag {
  return {
    id: 'vaegt:telt',
    type: 'vaegt',
    titel: 'Lettere gear i skabet',
    detalje: '1.2 kg at hente på 2 ting',
    begrundelse: 'Fordi.',
    virkning: { vaegt_g: -1200, antal: 2 },
    tiltro: 'mellem',
    handling: { tag_imod: 'Se byttene', afvis: 'Vægten er fin' },
    ...overskriv
  };
}

async function aftrykFor(turUid: string): Promise<Set<string>> {
  const raekker = await db.afviste_forslag.where('tur_uid').equals(turUid).toArray();
  return new Set(raekker.map((r) => r.aftryk));
}

describe('afvisForslag', () => {
  it('husker afvisningen på tværs af besøg', async () => {
    await afvisForslag(TUR, etForslag());
    expect(await aftrykFor(TUR)).toEqual(new Set([aftrykAf(etForslag())]));
  });

  it('holder kun én række pr. forslag pr. tur', async () => {
    await afvisForslag(TUR, etForslag());
    await afvisForslag(TUR, etForslag({ detalje: '0.9 kg at hente på 1 ting' }));

    const raekker = await db.afviste_forslag.where('tur_uid').equals(TUR).toArray();
    expect(raekker).toHaveLength(1);
    // Det er det nye grundlag der gælder — ellers ville det gamle nej blive
    // ved med at dække noget, man ikke har set.
    expect(raekker[0].aftryk).toBe(aftrykAf(etForslag({ detalje: '0.9 kg at hente på 1 ting' })));
  });

  it('holder turene adskilt', async () => {
    await afvisForslag(TUR, etForslag());
    expect(await aftrykFor('tur-2')).toEqual(new Set());
  });

  // Det samme forslag på startskærmen og inde på turen er det samme forslag.
  it('gælder samme forslag uanset hvilken skærm det blev afvist fra', async () => {
    const tungt = lavItem({ navn: 'Stort telt', vaegt_g: 4000, tags: ['ly'] });
    const let_ = lavItem({ navn: 'Tarp', vaegt_g: 600, tags: ['ly'] });
    const tur = lavTur({ loese_item_ids: [tungt.uid] });

    const fraStartskaermen = forslagTilTur(tur, [], [tungt, let_], [])[0];
    await afvisForslag(tur.uid, fraStartskaermen);

    const fraTuren = forslagTilTur(tur, [], [tungt, let_], [])[0];
    expect(await aftrykFor(tur.uid)).toContain(aftrykAf(fraTuren));
  });
});

describe('rydAfvisninger', () => {
  it('fjerner turens afvisninger og lader de andres stå', async () => {
    await afvisForslag(TUR, etForslag());
    await afvisForslag('tur-2', etForslag());

    await rydAfvisninger(TUR);

    expect(await aftrykFor(TUR)).toEqual(new Set());
    expect(await aftrykFor('tur-2')).toHaveProperty('size', 1);
  });

  it('kan lægge dem tilbage, hvis sletningen fortrydes', async () => {
    await afvisForslag(TUR, etForslag());
    const genskab = await rydAfvisninger(TUR);

    await genskab();

    expect(await aftrykFor(TUR)).toEqual(new Set([aftrykAf(etForslag())]));
  });
});

// Afvisningen huskes, og derfor skal der være en vej tilbage fra et fejltryk.
describe('fortryd afvisningen', () => {
  it('fjerner rækken igen', async () => {
    const genskab = await afvisForslag(TUR, etForslag());

    await genskab();

    expect(await aftrykFor(TUR)).toEqual(new Set());
  });

  it('lægger den forrige afvisning tilbage, ikke ingenting', async () => {
    const gammelt = etForslag({ detalje: '0.9 kg at hente på 1 ting' });
    await afvisForslag(TUR, gammelt);
    const genskab = await afvisForslag(TUR, etForslag());

    await genskab();

    // Det gamle nej stod stadig ved magt, da man afviste igen — så det er
    // dét, man kommer tilbage til.
    expect(await aftrykFor(TUR)).toEqual(new Set([aftrykAf(gammelt)]));
  });
});

// Afvisningerne hører til turen. Bliver den slettet, skal de ikke blive
// liggende og tie et forslag ihjel på noget, der ikke findes mere.
describe('sletTur', () => {
  it('rydder turens afvisninger med', async () => {
    const id = await opretTur(lavTur({ navn: 'Rold Skov' }));
    const tur = await db.ture.get(id);
    await afvisForslag(tur!.uid, etForslag());

    await sletTur(id);

    expect(await aftrykFor(tur!.uid)).toEqual(new Set());
  });

  it('lægger dem tilbage når sletningen fortrydes', async () => {
    const id = await opretTur(lavTur({ navn: 'Rold Skov' }));
    const tur = await db.ture.get(id);
    await afvisForslag(tur!.uid, etForslag());

    const genskab = await sletTur(id);
    await genskab!();

    expect(await aftrykFor(tur!.uid)).toEqual(new Set([aftrykAf(etForslag())]));
  });
});
