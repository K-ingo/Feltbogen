import { describe, it, expect, beforeEach, vi } from 'vitest';

vi.mock('./pb', () => import('./test/pbMock'));

import { pbMock } from './test/pbMock';
import {
  laesMedbragt, laesDeltagelse, minDeltagelse, visningsnavn,
  medbragtPrDeltager, baererePrGear, samletMedbragtVaegt,
  hentDeltagelser, gemDeltagelse, forladTur, nyDeltagelse, SAMLING
} from './deltagelse';
import type { Deltagelse } from './deltagelse';

const deltager = (over: Partial<Deltagelse> = {}): Deltagelse => ({
  pb_id: 'd1', tur: 'pb-tur', user: 'bruger1', navn: 'Emil', medbragt: [], baerer: [], journal: [], ...over
});

beforeEach(() => pbMock.reset());

// Alt der kommer fra serveren, skal kunne være hvad som helst. En anden
// deltager kan skrive i sin egen række, og appen skal ikke vælte af det.
describe('laesMedbragt', () => {
  it('læser navn og vægt', () => {
    expect(laesMedbragt([{ navn: 'Sovepose', vaegt_g: 900 }]))
      .toEqual([{ navn: 'Sovepose', vaegt_g: 900 }]);
  });

  it('smider linjer uden navn væk', () => {
    expect(laesMedbragt([{ navn: '  ', vaegt_g: 900 }, { vaegt_g: 100 }])).toEqual([]);
  });

  it('retter en vægt der ikke er et tal op', () => {
    expect(laesMedbragt([{ navn: 'Kniv', vaegt_g: 'tung' }]))
      .toEqual([{ navn: 'Kniv', vaegt_g: 0 }]);
  });

  it('runder en vægt med decimaler af', () => {
    expect(laesMedbragt([{ navn: 'Kniv', vaegt_g: 40.6 }])[0].vaegt_g).toBe(41);
  });

  it('giver tom liste på noget der ikke er en liste', () => {
    expect(laesMedbragt('Sovepose')).toEqual([]);
    expect(laesMedbragt(null)).toEqual([]);
    expect(laesMedbragt([null, 'volapyk'])).toEqual([]);
  });
});

describe('laesDeltagelse', () => {
  it('læser en hel række', () => {
    const d = laesDeltagelse({
      id: 'd1', tur: 'pb-tur', user: 'u1', navn: 'Sofie',
      medbragt: [{ navn: 'Tarp', vaegt_g: 500 }], baerer: ['u-telt'],
      journal: [{ id: 'b1', tid: '2026-09-19T11:26:00.000Z', tekst: 'Sindssygt flot udsigt herfra.' }]
    } as never);

    expect(d).toEqual({
      pb_id: 'd1', tur: 'pb-tur', user: 'u1', navn: 'Sofie',
      medbragt: [{ navn: 'Tarp', vaegt_g: 500 }], baerer: ['u-telt'],
      journal: [{ id: 'b1', tid: '2026-09-19T11:26:00.000Z', tekst: 'Sindssygt flot udsigt herfra.' }]
    });
  });

  it('klarer en række hvor felterne mangler', () => {
    const d = laesDeltagelse({ id: 'd1' } as never);
    expect(d.navn).toBe('');
    expect(d.medbragt).toEqual([]);
    expect(d.baerer).toEqual([]);
  });
});

describe('minDeltagelse', () => {
  it('finder ens egen række', () => {
    const alle = [deltager({ user: 'a' }), deltager({ user: 'b', navn: 'Sofie' })];
    expect(minDeltagelse(alle, 'b')?.navn).toBe('Sofie');
  });

  it('giver ingenting når man ikke har skrevet sig på', () => {
    expect(minDeltagelse([deltager({ user: 'a' })], 'c')).toBeUndefined();
  });
});

describe('visningsnavn', () => {
  it('bruger navnet', () => {
    expect(visningsnavn(deltager({ navn: 'Emil' }))).toBe('Emil');
  });

  // Man er deltager fra det øjeblik man åbner linket, og navnet kommer først
  // bagefter. En tom linje på de andres liste hjælper ingen.
  it('siger "En deltager" når navnet mangler', () => {
    expect(visningsnavn(deltager({ navn: '   ' }))).toBe('En deltager');
  });
});

describe('medbragtPrDeltager', () => {
  it('samler hver persons grej med en vægt', () => {
    const alle = [deltager({
      navn: 'Emil',
      medbragt: [{ navn: 'Sovepose', vaegt_g: 900 }, { navn: 'Kniv', vaegt_g: 40 }]
    })];

    expect(medbragtPrDeltager(alle)).toEqual([
      { navn: 'Emil', gear: alle[0].medbragt, vaegt_g: 940 }
    ]);
  });

  // En der har åbnet linket uden at skrive noget, skal ikke fylde en overskrift
  // på de andres pakkeliste.
  it('springer dem over der ikke har skrevet noget', () => {
    expect(medbragtPrDeltager([deltager({ medbragt: [] })])).toEqual([]);
  });
});

describe('baererePrGear', () => {
  it('slår op fra gear til dem der har meldt sig', () => {
    const alle = [
      deltager({ user: 'a', navn: 'Emil', baerer: ['u-telt'] }),
      deltager({ user: 'b', navn: 'Sofie', baerer: ['u-telt', 'u-gryde'] })
    ];

    const pr = baererePrGear(alle);
    expect(pr.get('u-telt')).toEqual(['Emil', 'Sofie']);
    expect(pr.get('u-gryde')).toEqual(['Sofie']);
  });

  // To der melder sig på samme telt er ikke en fejl her — det er noget
  // ejeren skal kunne se og tage stilling til.
  it('skjuler ikke at to har meldt sig på det samme', () => {
    const alle = [
      deltager({ user: 'a', navn: 'Emil', baerer: ['u-telt'] }),
      deltager({ user: 'b', navn: 'Sofie', baerer: ['u-telt'] })
    ];
    expect(baererePrGear(alle).get('u-telt')).toHaveLength(2);
  });

  it('er tom uden deltagere', () => {
    expect(baererePrGear([]).size).toBe(0);
  });
});

describe('samletMedbragtVaegt', () => {
  it('lægger alles grej sammen', () => {
    const alle = [
      deltager({ user: 'a', medbragt: [{ navn: 'Sovepose', vaegt_g: 900 }] }),
      deltager({ user: 'b', medbragt: [{ navn: 'Tarp', vaegt_g: 500 }] })
    ];
    expect(samletMedbragtVaegt(alle)).toBe(1400);
  });

  it('er nul uden deltagere', () => {
    expect(samletMedbragtVaegt([])).toBe(0);
  });
});

describe('hentDeltagelser', () => {
  it('henter kun dem der hører til turen', async () => {
    pbMock.seed(SAMLING, 'd1', { tur: 'pb-tur', user: 'a', navn: 'Emil', medbragt: [], baerer: [] });
    pbMock.seed(SAMLING, 'd2', { tur: 'anden-tur', user: 'b', navn: 'Sofie', medbragt: [], baerer: [] });

    const svar = await hentDeltagelser('pb-tur', 'token');
    expect(svar.slags).toBe('ok');
    if (svar.slags === 'ok') {
      expect(svar.data).toHaveLength(1);
      expect(svar.data[0].navn).toBe('Emil');
    }
  });

  it('siger fejl uden forbindelse frem for at vælte', async () => {
    pbMock.offline = true;
    expect((await hentDeltagelser('pb-tur', 'token')).slags).toBe('fejl');
  });
});

describe('gemDeltagelse', () => {
  it('opretter rækken første gang', async () => {
    const svar = await gemDeltagelse(
      { ...nyDeltagelse('pb-tur', 'bruger1', 'Emil'), medbragt: [{ navn: 'Kniv', vaegt_g: 40 }] },
      'token'
    );

    expect(svar.slags).toBe('ok');
    expect(pbMock.ids(SAMLING)).toHaveLength(1);
  });

  it('opdaterer den samme række anden gang', async () => {
    const foerste = await gemDeltagelse(nyDeltagelse('pb-tur', 'bruger1', 'Emil'), 'token');
    if (foerste.slags !== 'ok') throw new Error('kunne ikke oprette');

    await gemDeltagelse({ ...foerste.data, navn: 'Emil K' }, 'token');

    expect(pbMock.ids(SAMLING)).toHaveLength(1);
    const svar = await hentDeltagelser('pb-tur', 'token');
    if (svar.slags === 'ok') expect(svar.data[0].navn).toBe('Emil K');
  });

  // Rækken hører til den der er logget ind, uanset hvad kladden påstår.
  // Serveren håndhæver det samme i sin regel — det her er bæltet.
  it('skriver altid den indloggede som ejer af rækken', async () => {
    await gemDeltagelse({ ...nyDeltagelse('pb-tur', 'en-anden', 'Emil') }, 'token');

    const svar = await hentDeltagelser('pb-tur', 'token');
    if (svar.slags === 'ok') expect(svar.data[0].user).toBe('bruger1');
  });

  it('siger fejl uden forbindelse', async () => {
    pbMock.offline = true;
    expect((await gemDeltagelse(nyDeltagelse('pb-tur', 'bruger1'), 'token')).slags).toBe('fejl');
  });
});

describe('forladTur', () => {
  it('fjerner rækken', async () => {
    const svar = await gemDeltagelse(nyDeltagelse('pb-tur', 'bruger1', 'Emil'), 'token');
    if (svar.slags !== 'ok') throw new Error('kunne ikke oprette');

    expect(await forladTur(svar.data.pb_id!)).toBe(true);
    expect(pbMock.ids(SAMLING)).toHaveLength(0);
  });

  it('siger fra frem for at vælte når rækken er væk', async () => {
    expect(await forladTur('findes-ikke')).toBe(false);
  });
});

// Deltagelsen må aldrig kunne røre selve turen — det er hele grunden til at
// den ligger i sin egen samling.
describe('afgrænsning', () => {
  it('rører ikke ture-samlingen', async () => {
    await gemDeltagelse(nyDeltagelse('pb-tur', 'bruger1', 'Emil'), 'token');
    await forladTur('d1').catch(() => undefined);

    expect(pbMock.kald.filter((k) => k.samling === 'ture')).toHaveLength(0);
  });
});
