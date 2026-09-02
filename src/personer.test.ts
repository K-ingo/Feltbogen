import { describe, it, expect } from 'vitest';
import {
  antalTurePrPerson,
  deltagerFraNavn,
  deltagerFraPerson,
  foreslaaPersoner,
  personForDeltager,
  personprofil,
  tureMedPerson,
  ukendteNavne
} from './personerLogik';
import type { Deltager } from './db';
import { lavItem, lavPerson, lavTur } from './test/data';

const deltager = (navn: string, person_uid = ''): Deltager => ({
  id: `d-${navn}`,
  navn,
  overnatning: null,
  personligt_gear_ids: [],
  baerer_delt_ids: [],
  person_uid
});

describe('tureMedPerson', () => {
  it('finder turene personen var med på, nyeste først', () => {
    const ture = [
      lavTur({ navn: 'Gammel', startdato: '2025-05-01', deltagere: [deltager('Mikkel', 'p-1')] }),
      lavTur({ navn: 'Ny', startdato: '2026-05-01', deltagere: [deltager('Mikkel', 'p-1')] }),
      lavTur({ navn: 'Uden', startdato: '2026-06-01', deltagere: [deltager('Emil', 'p-2')] })
    ];

    expect(tureMedPerson(ture, 'p-1').map((t) => t.navn)).toEqual(['Ny', 'Gammel']);
  });

  // Fritekst er ikke en person. To "Mikkel"'er uden kobling er to fremmede,
  // og det er netop dét person-tabellen er til for at rette op på.
  it('tæller ikke deltagere der kun er skrevet i hånden', () => {
    const ture = [lavTur({ deltagere: [deltager('Mikkel')] })];
    expect(tureMedPerson(ture, 'p-1')).toEqual([]);
  });
});

describe('antalTurePrPerson', () => {
  it('tæller ture pr. person', () => {
    const ture = [
      lavTur({ deltagere: [deltager('Mikkel', 'p-1'), deltager('Emil', 'p-2')] }),
      lavTur({ deltagere: [deltager('Mikkel', 'p-1')] })
    ];

    const antal = antalTurePrPerson(ture);

    expect(antal.get('p-1')).toBe(2);
    expect(antal.get('p-2')).toBe(1);
  });

  // Ellers ville en fejlindtastning se ud som et venskab.
  it('tæller en tur én gang selvom personen står på den to gange', () => {
    const ture = [lavTur({ deltagere: [deltager('Mikkel', 'p-1'), deltager('Mikkel igen', 'p-1')] })];
    expect(antalTurePrPerson(ture).get('p-1')).toBe(1);
  });

  it('tæller ikke tomme koblinger som en person', () => {
    expect(antalTurePrPerson([lavTur({ deltagere: [deltager('Mikkel')] })]).has('')).toBe(false);
  });
});

describe('foreslaaPersoner', () => {
  const mikkel = lavPerson({ uid: 'p-1', navn: 'Mikkel' });
  const maja = lavPerson({ uid: 'p-2', navn: 'Maja' });

  it('matcher på navn uden hensyn til store bogstaver', () => {
    expect(foreslaaPersoner([mikkel, maja], [], 'mik').map((p) => p.navn)).toEqual(['Mikkel']);
  });

  it('viser alle når der ikke er skrevet noget endnu', () => {
    expect(foreslaaPersoner([mikkel, maja], [], '')).toHaveLength(2);
  });

  it('sætter dem man rejser mest med øverst', () => {
    const ture = [
      lavTur({ deltagere: [deltager('Maja', 'p-2')] }),
      lavTur({ deltagere: [deltager('Maja', 'p-2')] }),
      lavTur({ deltagere: [deltager('Mikkel', 'p-1')] })
    ];

    expect(foreslaaPersoner([mikkel, maja], ture, '').map((p) => p.navn)).toEqual(['Maja', 'Mikkel']);
  });

  // De kan ikke tilføjes igen, så de er ikke forslag.
  it('holder dem der allerede er på turen ude', () => {
    expect(foreslaaPersoner([mikkel, maja], [], '', ['p-1']).map((p) => p.navn)).toEqual(['Maja']);
  });

  it('lader tomme koblinger på turen være uden at skjule nogen', () => {
    expect(foreslaaPersoner([mikkel, maja], [], '', ['', ''])).toHaveLength(2);
  });
});

describe('deltagerFraPerson', () => {
  it('tager navn og standardovernatning med', () => {
    const person = lavPerson({ uid: 'p-1', navn: 'Mikkel', standard_overnatning: 'haengekoeje' });
    const d = deltagerFraPerson(person);

    expect(d.navn).toBe('Mikkel');
    expect(d.overnatning).toBe('haengekoeje');
    expect(d.person_uid).toBe('p-1');
    expect(d.personligt_gear_ids).toEqual([]);
  });

  it('lader overnatningen stå åben når personen ikke har en standard', () => {
    expect(deltagerFraPerson(lavPerson()).overnatning).toBeNull();
  });
});

describe('deltagerFraNavn', () => {
  // Man skal kunne få nogen med på turen uden først at føre kartotek.
  it('laver en deltager uden kobling', () => {
    const d = deltagerFraNavn('  Mikkel  ');

    expect(d.navn).toBe('Mikkel');
    expect(d.person_uid).toBe('');
    expect(d.overnatning).toBeNull();
  });
});

describe('personForDeltager', () => {
  it('slår personen op på koblingen', () => {
    const mikkel = lavPerson({ uid: 'p-1', navn: 'Mikkel' });
    expect(personForDeltager(deltager('Mikkel', 'p-1'), [mikkel])?.navn).toBe('Mikkel');
  });

  it('giver null uden kobling, og når personen er slettet', () => {
    const mikkel = lavPerson({ uid: 'p-1' });
    expect(personForDeltager(deltager('Mikkel'), [mikkel])).toBeNull();
    expect(personForDeltager(deltager('Mikkel', 'p-væk'), [mikkel])).toBeNull();
  });
});

describe('ukendteNavne', () => {
  it('finder navne fra turene der ikke er personer endnu', () => {
    const ture = [lavTur({ deltagere: [deltager('Mikkel'), deltager('Maja')] })];
    const personer = [lavPerson({ navn: 'Maja' })];

    expect(ukendteNavne(ture, personer)).toEqual(['Mikkel']);
  });

  it('nævner det samme navn én gang på tværs af flere ture', () => {
    const ture = [
      lavTur({ deltagere: [deltager('Mikkel')] }),
      lavTur({ deltagere: [deltager('mikkel')] })
    ];

    expect(ukendteNavne(ture, [])).toHaveLength(1);
  });

  it('springer deltagere over der allerede er koblet', () => {
    const ture = [lavTur({ deltagere: [deltager('Mikkel', 'p-1')] })];
    expect(ukendteNavne(ture, [])).toEqual([]);
  });

  it('ser bort fra tomme navne', () => {
    expect(ukendteNavne([lavTur({ deltagere: [deltager('  ')] })], [])).toEqual([]);
  });
});

// ─────────────────────────────────────────────
// Personens profil (specens §17)
// ─────────────────────────────────────────────

describe('personprofil', () => {
  const emil = lavPerson({ uid: 'p-emil', navn: 'Emil' });
  const telt = lavItem({ uid: 'i-telt', navn: 'Telt', vaegt_g: 2400, delt: true });
  const pose = lavItem({ uid: 'i-pose', navn: 'Sovepose', vaegt_g: 1100 });
  const oekse = lavItem({ uid: 'i-oekse', navn: 'Økse', vaegt_g: 700 });
  const inventar = [telt, pose, oekse];

  const medEmil = (personligt: string[], delt: string[] = [], felter = {}) => lavTur({
    deltagere: [{
      id: crypto.randomUUID(), navn: 'Emil', overnatning: null,
      personligt_gear_ids: personligt, baerer_delt_ids: delt, person_uid: 'p-emil'
    }],
    ...felter
  });

  it('samler personens ture, nyeste først', () => {
    const profil = personprofil(emil, [
      medEmil(['i-pose'], [], { navn: 'Gammel', startdato: '2026-05-01' }),
      medEmil(['i-pose'], [], { navn: 'Ny', startdato: '2026-08-01' })
    ], inventar);

    expect(profil.ture.map((t) => t.navn)).toEqual(['Ny', 'Gammel']);
  });

  it('tæller det gear hun oftest har med, hyppigst først', () => {
    const profil = personprofil(emil, [
      medEmil(['i-pose'], ['i-telt']),
      medEmil(['i-pose']),
      medEmil(['i-pose', 'i-oekse'])
    ], inventar);

    expect(profil.typiskGear.map((g) => [g.item.navn, g.ture])).toEqual([
      ['Sovepose', 3],
      ['Telt', 1],
      ['Økse', 1]
    ]);
  });

  it('tæller en tur én gang, selvom navnet står to gange på den', () => {
    const dobbelt = lavTur({
      deltagere: [
        { id: 'a', navn: 'Emil', overnatning: null, personligt_gear_ids: ['i-pose'], baerer_delt_ids: [], person_uid: 'p-emil' },
        { id: 'b', navn: 'Emil', overnatning: null, personligt_gear_ids: ['i-pose'], baerer_delt_ids: [], person_uid: 'p-emil' }
      ]
    });

    expect(personprofil(emil, [dobbelt], inventar).typiskGear[0].ture).toBe(1);
  });

  it('regner den typiske vægt af det hun bar', () => {
    const profil = personprofil(emil, [
      medEmil(['i-pose'], ['i-telt']),   // 3500
      medEmil(['i-pose'])                 // 1100
    ], inventar);

    expect(profil.baerer).toEqual({ snit_g: 2300, ture: 2 });
  });

  // En tur hvor grejet aldrig blev fordelt, siger ingenting om hvad hun
  // plejer at slæbe. At tælle den med som nul ville trække snittet ned på
  // noget, appen ikke ved.
  it('regner ikke ture uden fordelt grej med i snittet', () => {
    const profil = personprofil(emil, [
      medEmil(['i-pose'], ['i-telt']),
      medEmil([]),
      medEmil([])
    ], inventar);

    expect(profil.ture).toHaveLength(3);
    expect(profil.baerer).toEqual({ snit_g: 3500, ture: 1 });
  });

  it('giver ingen vægt når hun aldrig har båret noget', () => {
    expect(personprofil(emil, [medEmil([])], inventar).baerer).toBeNull();
  });

  it('giver en tom profil for en person uden ture', () => {
    const profil = personprofil(emil, [], inventar);

    expect(profil.ture).toEqual([]);
    expect(profil.typiskGear).toEqual([]);
    expect(profil.baerer).toBeNull();
  });

  // Gear kan slettes, mens turene bliver stående. Så er der ikke noget at
  // vise — men vægten hun bar dengang, er stadig det den var.
  it('springer gear over der ikke findes i inventaret længere', () => {
    const profil = personprofil(emil, [medEmil(['i-pose', 'i-vaek'])], inventar);

    expect(profil.typiskGear.map((g) => g.item.navn)).toEqual(['Sovepose']);
  });

  it('viser højst fem stykker gear', () => {
    const mange = Array.from({ length: 8 }, (_, n) =>
      lavItem({ uid: `i-${n}`, navn: `Ting ${n}`, vaegt_g: 100 })
    );
    const profil = personprofil(emil, [medEmil(mange.map((i) => i.uid))], mange);

    expect(profil.typiskGear).toHaveLength(5);
  });
});
