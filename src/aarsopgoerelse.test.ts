import { describe, it, expect } from 'vitest';
import {
  aarMedTure,
  aarsopgoerelseAtSe,
  aarsoverskrift,
  aarstalFor,
  fordeling,
  koldesteNat,
  laengsteBaering,
  laengsteTur,
  mestBesoegte,
  rejsefaeller,
  tureIAaret,
  vaadesteTur,
  vejrPaaTuren
} from './aarsopgoerelse';
import { lavItem, lavSted, lavTur } from './test/data';

// Turene i testene skal have været noget. lavTur() laver kladder.
const tur = (felter: Parameters<typeof lavTur>[0] = {}) =>
  lavTur({ status: 'afsluttet', ...felter });

const udsigt = (dage: { dato: string; temp_min?: number; nedboer_mm?: number }[]) =>
  JSON.stringify({
    dage: dage.map((d) => ({
      dato: d.dato,
      temp_min: d.temp_min ?? 10,
      temp_max: 18,
      nedboer_mm: d.nedboer_mm ?? 0,
      vind_ms: 4,
      vejrkode: 1,
      sol_op: '05:00',
      sol_ned: '21:00'
    })),
    observationer: [],
    hentet: '2026-07-01T00:00:00Z'
  });

describe('tureIAaret', () => {
  it('tager årets ture i datorækkefølge', () => {
    const ture = [
      tur({ navn: 'Sen', startdato: '2026-09-01' }),
      tur({ navn: 'Tidlig', startdato: '2026-03-01' }),
      tur({ navn: 'Året før', startdato: '2025-06-01' })
    ];

    expect(tureIAaret(ture, 2026).map((t) => t.navn)).toEqual(['Tidlig', 'Sen']);
  });

  // En kladde er en plan man aldrig gjorde færdig.
  it('tæller ikke kladder med', () => {
    const ture = [
      tur({ navn: 'Reel', startdato: '2026-05-01' }),
      lavTur({ navn: 'Kladde', startdato: '2026-05-02', status: 'kladde' })
    ];

    expect(tureIAaret(ture, 2026).map((t) => t.navn)).toEqual(['Reel']);
  });

  // At tælle efter status alene ville gøre opgørelsen afhængig af oprydning.
  it('tæller en tur med der aldrig blev sat til afsluttet', () => {
    expect(tureIAaret([tur({ status: 'klar', startdato: '2026-05-01' })], 2026)).toHaveLength(1);
  });

  it('ser bort fra ture uden brugbar dato', () => {
    expect(tureIAaret([tur({ startdato: '' }), tur({ startdato: 'vrøvl' })], 2026)).toEqual([]);
  });
});

describe('aarMedTure', () => {
  it('giver årene med noget i, nyeste først', () => {
    const ture = [
      tur({ startdato: '2024-05-01' }),
      tur({ startdato: '2026-05-01' }),
      tur({ startdato: '2026-08-01' }),
      lavTur({ startdato: '2025-05-01', status: 'kladde' })
    ];

    expect(aarMedTure(ture)).toEqual([2026, 2024]);
  });

  it('giver ingen år uden ture', () => {
    expect(aarMedTure([])).toEqual([]);
  });
});

describe('aarstalFor', () => {
  const ture = [
    tur({ startdato: '2026-05-01', naetter: 2, baereafstand_km: 8, feltnoter: [{ id: 'a', tid: '', tekst: 'x' }] }),
    tur({ startdato: '2026-07-01', naetter: 3, baereafstand_km: 12 }),
    tur({ startdato: '2025-07-01', naetter: 9, baereafstand_km: 40 })
  ];

  const items = [
    lavItem({ koebsdato: '3/2026', pris_kr: 900 }),
    lavItem({ koebsdato: '11/2026', pris_kr: 400, antal: 2 }),
    lavItem({ koebsdato: '4/2025', pris_kr: 5000 }),
    lavItem({ koebsdato: '', pris_kr: 700 })
  ];

  it('lægger året sammen', () => {
    const tal = aarstalFor(ture, items, 2026);

    expect(tal).toMatchObject({ aar: 2026, ture: 2, naetter: 5, km: 20, feltnoter: 1 });
  });

  // Tre nætter er fire dage ude, og en dagstur er én.
  it('regner dage ude som nætter plus hjemrejsedagen', () => {
    expect(aarstalFor(ture, items, 2026).dage).toBe(7);
    expect(aarstalFor([tur({ startdato: '2026-05-01', naetter: 0 })], [], 2026).dage).toBe(1);
  });

  it('tæller nyt grej efter købsåret og ganger antallet med', () => {
    const tal = aarstalFor(ture, items, 2026);

    expect(tal.nytGrej).toBe(2);
    expect(tal.nytGrejKr).toBe(900 + 400 * 2);
  });

  // Ellers ville gearet lande i det år man tilfældigvis oprettede posten.
  it('tæller ikke grej uden købsdato', () => {
    expect(aarstalFor([], [lavItem({ koebsdato: '', pris_kr: 700 })], 2026).nytGrej).toBe(0);
  });

  it('tæller alle rejsefæller, ikke kun dem der bliver vist', () => {
    const stort = tur({
      startdato: '2026-06-01',
      deltagere: 'abcdefg'.split('').map((n) => ({
        id: n, navn: n.toUpperCase(), overnatning: null,
        personligt_gear_ids: [], baerer_delt_ids: [], person_uid: ''
      }))
    });

    expect(aarstalFor([stort], [], 2026).rejsefaeller).toBe(7);
  });

  it('giver nuller for et år uden ture', () => {
    expect(aarstalFor([], [], 2020)).toMatchObject({ ture: 0, naetter: 0, dage: 0, km: 0 });
  });
});

describe('højdepunkter', () => {
  it('finder den længste tur og den længste bæring', () => {
    const ture = [
      tur({ navn: 'Kort', naetter: 1, baereafstand_km: 20 }),
      tur({ navn: 'Lang', naetter: 6, baereafstand_km: 3 })
    ];

    expect(laengsteTur(ture)?.tur.navn).toBe('Lang');
    expect(laengsteTur(ture)?.tal).toBe(6);
    expect(laengsteBaering(ture)?.tur.navn).toBe('Kort');
  });

  // Et nul er ikke et højdepunkt.
  it('tier når ingen tur har noget at prale af', () => {
    expect(laengsteTur([tur({ naetter: 0 })])).toBeNull();
    expect(laengsteBaering([tur({ baereafstand_km: 0 })])).toBeNull();
  });
});

describe('vejrPaaTuren', () => {
  it('tager kun de dage der ligger inden for turen', () => {
    const t = tur({
      startdato: '2026-07-10',
      slutdato: '2026-07-11',
      vejrsnapshot: udsigt([
        { dato: '2026-07-09' },
        { dato: '2026-07-10' },
        { dato: '2026-07-11' },
        { dato: '2026-07-12' }
      ])
    });

    expect(vejrPaaTuren(t).map((d) => d.dato)).toEqual(['2026-07-10', '2026-07-11']);
  });

  it('klarer en tur uden udsigt og en udsigt der er vrøvl', () => {
    expect(vejrPaaTuren(tur({ vejrsnapshot: '' }))).toEqual([]);
    expect(vejrPaaTuren(tur({ vejrsnapshot: 'ikke json' }))).toEqual([]);
    expect(vejrPaaTuren(tur({ vejrsnapshot: '{"dage":"nej"}' }))).toEqual([]);
  });
});

describe('koldesteNat', () => {
  it('finder den koldeste nat på tværs af turene', () => {
    const ture = [
      tur({ navn: 'Mild', startdato: '2026-05-01', slutdato: '2026-05-02',
        vejrsnapshot: udsigt([{ dato: '2026-05-01', temp_min: 7 }]) }),
      tur({ navn: 'Kold', startdato: '2026-11-01', slutdato: '2026-11-03',
        vejrsnapshot: udsigt([
          { dato: '2026-11-01', temp_min: 2 },
          { dato: '2026-11-02', temp_min: -4 }
        ]) })
    ];

    expect(koldesteNat(ture)).toMatchObject({ dato: '2026-11-02', grader: -4 });
    expect(koldesteNat(ture)?.tur.navn).toBe('Kold');
  });

  it('tier når ingen tur har en udsigt', () => {
    expect(koldesteNat([tur()])).toBeNull();
  });
});

describe('vaadesteTur', () => {
  it('lægger nedbøren sammen over turens dage', () => {
    const ture = [
      tur({ navn: 'Tør', startdato: '2026-05-01', slutdato: '2026-05-02',
        vejrsnapshot: udsigt([{ dato: '2026-05-01', nedboer_mm: 1 }]) }),
      tur({ navn: 'Våd', startdato: '2026-08-01', slutdato: '2026-08-02',
        vejrsnapshot: udsigt([
          { dato: '2026-08-01', nedboer_mm: 12 },
          { dato: '2026-08-02', nedboer_mm: 9 }
        ]) })
    ];

    expect(vaadesteTur(ture)).toMatchObject({ mm: 21 });
    expect(vaadesteTur(ture)?.tur.navn).toBe('Våd');
  });

  // Et helt tørt år har ingen vådeste tur.
  it('tier når der ikke faldt en dråbe', () => {
    expect(vaadesteTur([tur({ vejrsnapshot: udsigt([{ dato: '2026-07-10' }]) })])).toBeNull();
  });
});

describe('mestBesoegte', () => {
  it('samler ture på det gemte sted', () => {
    const sted = lavSted({ uid: 's-1', navn: 'Rold Skov' });
    const ture = [
      tur({ sted_uid: 's-1', sted: 'et eller andet', naetter: 2 }),
      tur({ sted_uid: 's-1', sted: '', naetter: 3 })
    ];

    expect(mestBesoegte(ture, [sted])[0]).toEqual({ navn: 'Rold Skov', ture: 2, naetter: 5 });
  });

  // Et sted man har skrevet i hånden er stadig et sted man var.
  it('samler også på fritekst, uanset store og små bogstaver', () => {
    const ture = [tur({ sted: 'Klosterheden' }), tur({ sted: 'klosterheden' })];

    expect(mestBesoegte(ture, [])).toHaveLength(1);
    expect(mestBesoegte(ture, [])[0]).toMatchObject({ navn: 'Klosterheden', ture: 2 });
  });

  it('sætter det mest besøgte først og springer ture uden sted over', () => {
    const ture = [
      tur({ sted: 'Én gang' }),
      tur({ sted: 'To gange' }),
      tur({ sted: 'To gange' }),
      tur({ sted: '  ' })
    ];

    expect(mestBesoegte(ture, []).map((s) => s.navn)).toEqual(['To gange', 'Én gang']);
  });
});

describe('rejsefaeller', () => {
  const deltager = (navn: string, person_uid = '') => ({
    id: navn, navn, overnatning: null,
    personligt_gear_ids: [], baerer_delt_ids: [], person_uid
  });

  it('tæller hvor mange ture man var afsted med hver', () => {
    const ture = [
      tur({ deltagere: [deltager('Mikkel'), deltager('Sofie')] }),
      tur({ deltagere: [deltager('Mikkel')] })
    ];

    expect(rejsefaeller(ture)).toEqual([
      { navn: 'Mikkel', ture: 2 },
      { navn: 'Sofie', ture: 1 }
    ]);
  });

  it('samler på person_uid når koblingen findes', () => {
    const ture = [
      tur({ deltagere: [deltager('Mikkel', 'p-1')] }),
      tur({ deltagere: [deltager('Mikkel H.', 'p-1')] })
    ];

    expect(rejsefaeller(ture)).toEqual([{ navn: 'Mikkel', ture: 2 }]);
  });

  // Den samme person to gange på én tur er stadig én tur sammen.
  it('tæller ikke en deltager to gange på samme tur', () => {
    expect(rejsefaeller([tur({ deltagere: [deltager('Mikkel'), deltager('mikkel')] })]))
      .toEqual([{ navn: 'Mikkel', ture: 1 }]);
  });

  it('ser bort fra navnløse deltagere', () => {
    expect(rejsefaeller([tur({ deltagere: [deltager('  ')] })])).toEqual([]);
  });
});

describe('fordeling', () => {
  it('tæller kendetegnet op og skriver det på dansk', () => {
    const ture = [
      tur({ overnatning: 'haengekoeje' }),
      tur({ overnatning: 'haengekoeje' }),
      tur({ overnatning: 'telt' })
    ];

    expect(fordeling(ture, (t) => t.overnatning)).toEqual([
      { vaerdi: 'hængekøje', antal: 2 },
      { vaerdi: 'telt', antal: 1 }
    ]);
  });
});

describe('aarsoverskrift', () => {
  const tal = (felter: Partial<ReturnType<typeof aarstalFor>>) =>
    ({ aar: 2026, ture: 0, naetter: 0, dage: 0, km: 0, nytGrej: 0, nytGrejKr: 0, feltnoter: 0, rejsefaeller: 0, ...felter });

  it('skriver året ud i én sætning', () => {
    expect(aarsoverskrift(tal({ ture: 12, naetter: 45 }))).toBe('12 ture og 45 nætter ude.');
  });

  it('siger det i ental når der kun var én', () => {
    expect(aarsoverskrift(tal({ ture: 1, naetter: 1 }))).toBe('Én tur og én nat ude.');
  });

  // Et år med dagsture er ikke et år uden ture.
  it('skelner mellem ingen ture og ingen nætter', () => {
    expect(aarsoverskrift(tal({ ture: 0 }))).toBe('Ingen ture det år.');
    expect(aarsoverskrift(tal({ ture: 3, naetter: 0 }))).toBe('3 ture, alle hjemme igen samme dag.');
  });
});

describe('aarsopgoerelseAtSe', () => {
  const januar = new Date('2027-01-15T10:00:00');
  const juni = new Date('2027-06-15T10:00:00');
  const ture = [tur({ startdato: '2026-08-01' })];

  it('viser sidste år frem i januar', () => {
    expect(aarsopgoerelseAtSe(ture, januar)).toBe(2026);
  });

  // Et tilbageblik der bliver stående til juni er ikke et tilbageblik.
  it('tier resten af året', () => {
    expect(aarsopgoerelseAtSe(ture, juni)).toBeNull();
  });

  it('tier når der ikke var nogen ture sidste år', () => {
    expect(aarsopgoerelseAtSe([tur({ startdato: '2025-08-01' })], januar)).toBeNull();
    expect(aarsopgoerelseAtSe([], januar)).toBeNull();
  });
});
