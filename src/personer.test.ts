import { describe, it, expect } from 'vitest';
import {
  antalTurePrPerson,
  deltagerFraNavn,
  deltagerFraPerson,
  foreslaaPersoner,
  personForDeltager,
  tureMedPerson,
  ukendteNavne
} from './personer';
import type { Deltager } from './db';
import { lavPerson, lavTur } from './test/data';

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
