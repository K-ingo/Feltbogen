import { describe, it, expect } from 'vitest';

import {
  antalDage, datoFor, dageFor, nyDag, naesteNummer,
  omnummerering, flyt, dageUdenForTuren, manglendeDage, varierer,
  harBrugForDage, dagsplanResume
} from './turdag';
import { lavTur, lavTurDag } from './test/data';

const tur = (felter = {}) => lavTur({ uid: 'tur-1', startdato: '2026-07-10', naetter: 2, ...felter });
const dag = (dag_nr: number, felter = {}) => lavTurDag({ tur_uid: 'tur-1', dag_nr, ...felter });

describe('hvor mange dage turen varer', () => {
  it('regner to nætter som tre dage', () => {
    expect(antalDage(tur({ naetter: 2 }))).toBe(3);
  });

  // En dagstur er stadig én dag. Uden bunden ville den have nul.
  it('giver mindst én dag, også uden nætter', () => {
    expect(antalDage(tur({ naetter: 0 }))).toBe(1);
  });
});

// Datoen gemmes ikke. Det er hele pointen: flyttes turen, følger dagene med,
// og der er ingen anden sandhed at holde dem i sync med.
describe('datoen udledes af turens start', () => {
  it('regner dag 1 som startdatoen', () => {
    expect(datoFor(tur(), 1)).toBe('2026-07-10');
  });

  it('tæller en dag frem pr. nummer', () => {
    expect(datoFor(tur(), 3)).toBe('2026-07-12');
  });

  it('følger med, når turen flyttes', () => {
    const flyttet = tur({ startdato: '2026-08-01' });
    expect(datoFor(flyttet, 3)).toBe('2026-08-03');
  });

  it('krydser en månedsgrænse rigtigt', () => {
    expect(datoFor(tur({ startdato: '2026-07-30' }), 4)).toBe('2026-08-02');
  });

  // Et ærligt svar: dagen har et nummer, ikke en dato.
  it('svarer tomt, når turen ingen startdato har', () => {
    expect(datoFor(tur({ startdato: '' }), 1)).toBe('');
  });

  it('svarer tomt på en ulæselig dato', () => {
    expect(datoFor(tur({ startdato: 'i morgen' }), 1)).toBe('');
  });
});

describe('dagene for én tur', () => {
  it('tager kun turens egne, i rækkefølge', () => {
    const dage = [
      dag(2),
      lavTurDag({ tur_uid: 'en-anden-tur', dag_nr: 1 }),
      dag(1)
    ];

    expect(dageFor(dage, 'tur-1').map((d) => d.dag_nr)).toEqual([1, 2]);
  });

  it('giver en tom liste, når turen ingen dage har', () => {
    expect(dageFor([], 'tur-1')).toEqual([]);
  });
});

describe('en ny dag', () => {
  it('arver turens aktivitet og overnatning', () => {
    const ny = nyDag(tur({ aktivitet: 'kano', overnatning: 'telt' }), []);

    expect(ny.aktivitet).toBe('kano');
    expect(ny.overnatning).toBe('telt');
  });

  // At man sover samme sted hver nat er præcis det, en flerdagestur ikke gør.
  it('arver ikke destinationen', () => {
    const ny = nyDag(tur({ sted: 'Rold Skov' }), []);

    expect(ny.destination).toBe('');
    expect(ny.destination_sted_uid).toBe('');
  });

  it('får det næste ledige nummer', () => {
    expect(nyDag(tur(), [dag(1), dag(2)]).dag_nr).toBe(3);
  });

  it('tæller kun turens egne dage med', () => {
    const fremmed = lavTurDag({ tur_uid: 'en-anden-tur', dag_nr: 9 });

    expect(nyDag(tur(), [dag(1), fremmed]).dag_nr).toBe(2);
  });

  // Højeste plus én og ikke antallet: er dag 2 slettet uden omnummerering,
  // ville antallet give et nummer, der allerede er i brug.
  it('bruger højeste nummer og ikke antallet', () => {
    expect(naesteNummer([dag(1), dag(3)])).toBe(4);
  });
});

describe('omnummerering', () => {
  it('siger ingenting, når rækken er hel', () => {
    expect(omnummerering([dag(1), dag(2), dag(3)])).toEqual([]);
  });

  it('lukker hullet efter en slettet dag', () => {
    const aendringer = omnummerering([dag(1), dag(3)]);

    expect(aendringer).toHaveLength(1);
    expect(aendringer[0].dag_nr).toBe(2);
  });

  it('nævner kun dem, der faktisk flytter sig', () => {
    const dage = [dag(1), dag(5), dag(6)];
    const aendringer = omnummerering(dage);

    expect(aendringer.map((a) => a.dag.dag_nr)).toEqual([5, 6]);
  });
});

describe('flyt en dag', () => {
  it('bytter to dage om', () => {
    const dage = [dag(1, { noter: 'først' }), dag(2, { noter: 'sidst' })];

    const aendringer = flyt(dage, 1, 2);

    const nummerFor = (noter: string) =>
      aendringer.find((a) => a.dag.noter === noter)?.dag_nr;
    expect(nummerFor('først')).toBe(2);
    expect(nummerFor('sidst')).toBe(1);
  });

  it('flytter mellemliggende dage med', () => {
    const dage = [dag(1, { noter: 'a' }), dag(2, { noter: 'b' }), dag(3, { noter: 'c' })];

    const aendringer = flyt(dage, 3, 1);

    expect(aendringer.find((a) => a.dag.noter === 'c')?.dag_nr).toBe(1);
    expect(aendringer.find((a) => a.dag.noter === 'a')?.dag_nr).toBe(2);
  });

  it('gør ingenting, når dagen skal blive hvor den er', () => {
    expect(flyt([dag(1), dag(2)], 1, 1)).toEqual([]);
  });

  it('gør ingenting, når nummeret ikke findes', () => {
    expect(flyt([dag(1), dag(2)], 1, 9)).toEqual([]);
  });
});

// Advarslerne blokerer aldrig — man skal kunne planlægge en dag mere, før man
// har rettet nætterne. Appen skal bare have sagt det.
describe('dage uden for turens længde', () => {
  it('siger fra, når der er planlagt for mange', () => {
    const udenfor = dageUdenForTuren(tur({ naetter: 1 }), [dag(1), dag(2), dag(3)]);

    expect(udenfor.map((d) => d.dag_nr)).toEqual([3]);
  });

  it('er tilfreds, når dagene passer', () => {
    expect(dageUdenForTuren(tur({ naetter: 2 }), [dag(1), dag(2), dag(3)])).toEqual([]);
  });
});

describe('manglende dage', () => {
  // Ingen dage er ikke et hul — det er en tur, der ikke har brug for dem.
  it('kalder ikke en tur uden dage for mangelfuld', () => {
    expect(manglendeDage(tur(), [])).toBe(0);
  });

  it('tæller de dage, der står tilbage, når nogen er begyndt', () => {
    expect(manglendeDage(tur({ naetter: 2 }), [dag(1)])).toBe(2);
  });

  it('siger nul, når alle dage er beskrevet', () => {
    expect(manglendeDage(tur({ naetter: 1 }), [dag(1), dag(2)])).toBe(0);
  });
});

describe('skifter turen slags undervejs', () => {
  it('nej, når alle dage er ens', () => {
    expect(varierer([dag(1), dag(2)], 'tur-1')).toBe(false);
  });

  it('ja, når aktiviteten skifter', () => {
    expect(varierer([dag(1, { aktivitet: 'vandretur' }), dag(2, { aktivitet: 'kano' })], 'tur-1')).toBe(true);
  });

  it('ja, når overnatningen skifter', () => {
    expect(varierer([dag(1, { overnatning: 'shelter' }), dag(2, { overnatning: 'telt' })], 'tur-1')).toBe(true);
  });

  it('nej, når der kun er én dag', () => {
    expect(varierer([dag(1)], 'tur-1')).toBe(false);
  });
});

describe('har turen brug for dage', () => {
  // En dagstur har én dag, og en dagsplan for den ene dag siger ikke noget,
  // turen ikke allerede siger.
  it('nej til en dagstur', () => {
    expect(harBrugForDage(tur({ naetter: 0 }))).toBe(false);
  });

  it('ja fra første overnatning', () => {
    expect(harBrugForDage(tur({ naetter: 1 }))).toBe(true);
  });
});

describe('linjen under overskriften', () => {
  it('siger til, når intet er planlagt', () => {
    expect(dagsplanResume(tur({ naetter: 2 }), [])).toBe('3 dage · ikke planlagt');
  });

  it('viser hvor langt man er, og hvad turen består af', () => {
    const dage = [
      dag(1, { aktivitet: 'vandretur' }),
      dag(2, { aktivitet: 'kano' }),
      dag(3, { aktivitet: 'vandretur' })
    ];

    expect(dagsplanResume(tur({ naetter: 2 }), dage)).toBe('3 af 3 dage · vandretur, kano');
  });

  it('siger hvor mange der mangler', () => {
    expect(dagsplanResume(tur({ naetter: 2 }), [dag(1)])).toContain('2 mangler');
  });

  // Etiketterne er de danske, ikke nøglerne uden æ/ø/å.
  it('skriver aktiviteten ud på dansk', () => {
    expect(dagsplanResume(tur({ naetter: 1 }), [dag(1, { aktivitet: 'bushcraft' })]))
      .toContain('bushcraft');
  });
});
