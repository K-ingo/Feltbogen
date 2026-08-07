import { describe, it, expect } from 'vitest';
import {
  TURKORT_VERSION,
  erOverskredet,
  kortlink,
  lavTurkort,
  laesTurkort,
  nytTurkorttoken,
  returtekst,
  turkortLink,
  turkorttokenFraAdresse
} from './turkort';
import { lavTur } from './test/data';

const NU = new Date('2026-07-30T12:00:00');

const tur = () => lavTur({
  navn: 'Rold Skov',
  sted: 'Rebild',
  koordinater: { lat: 56.83, lng: 9.85 },
  startdato: '2026-07-28',
  slutdato: '2026-08-02',
  status: 'aktiv',
  turkort_retur: '2026-08-02T19:00',
  turkort_besked: 'Ring til Mikkel på 12345678'
});

describe('nytTurkorttoken', () => {
  it('giver 32 hex-tegn', () => {
    expect(nytTurkorttoken()).toMatch(/^[0-9a-f]{32}$/);
  });

  it('giver et nyt hver gang', () => {
    expect(nytTurkorttoken()).not.toBe(nytTurkorttoken());
  });
});

describe('lavTurkort', () => {
  it('tager de fire ting modtageren skal bruge med', () => {
    const kort = lavTurkort(tur(), '', NU);

    expect(kort.navn).toBe('Rold Skov');
    expect(kort.koordinater).toEqual({ lat: 56.83, lng: 9.85 });
    expect(kort.forventet_retur).toBe('2026-08-02T19:00');
    expect(kort.besked).toBe('Ring til Mikkel på 12345678');
    expect(kort.version).toBe(TURKORT_VERSION);
  });

  // Et navn kan en pårørende finde på et kort; koordinater skal tastes ind.
  it('foretrækker det gemte steds navn frem for fritekst', () => {
    expect(lavTurkort(tur(), 'Rold Skov — nordre shelter', NU).sted)
      .toBe('Rold Skov — nordre shelter');
    expect(lavTurkort(tur(), '', NU).sted).toBe('Rebild');
  });

  // Bedre end et link der pludselig er dødt.
  it('markerer kortet som udløbet når turen er afsluttet', () => {
    expect(lavTurkort(tur(), '', NU).udloebet).toBe(false);
    expect(lavTurkort({ ...tur(), status: 'afsluttet' }, '', NU).udloebet).toBe(true);
  });

  // Turen bærer meget mere end det her — noter, budget, deltagere, gear. Intet
  // af det må kunne læses af en der har linket.
  it('tager ikke andet med fra turen', () => {
    const fuld = { ...tur(), noter: 'hemmeligt', besked_fra_ejer: 'også hemmeligt' };
    const felter = Object.keys(lavTurkort(fuld, '', NU));

    expect(felter).toEqual([
      'version', 'navn', 'sted', 'koordinater', 'startdato', 'slutdato',
      'forventet_retur', 'besked', 'udloebet', 'lavet_den'
    ]);
  });
});

describe('laesTurkort', () => {
  it('læser et kort den selv har lavet', () => {
    const kort = lavTurkort(tur(), '', NU);
    expect(laesTurkort(JSON.stringify(kort))).toEqual(kort);
  });

  it('afviser noget der ikke er et kort', () => {
    expect(laesTurkort('')).toBeNull();
    expect(laesTurkort('ikke json')).toBeNull();
    expect(laesTurkort('[]')).toBeNull();
    expect(laesTurkort('{"navn":"uden version"}')).toBeNull();
    expect(laesTurkort(null)).toBeNull();
  });

  // En nyere app kan have lavet et kort vi ikke forstår. Bedre en besked end
  // en halvt læst side.
  it('afviser en nyere version end den vi kender', () => {
    expect(laesTurkort(JSON.stringify({ version: TURKORT_VERSION + 1 }))).toBeNull();
  });

  it('fylder manglende felter ud frem for at vælte', () => {
    const kort = laesTurkort(JSON.stringify({ version: 1, navn: 'Kun navn' }));

    expect(kort?.navn).toBe('Kun navn');
    expect(kort?.koordinater).toBeNull();
    expect(kort?.besked).toBe('');
    expect(kort?.udloebet).toBe(false);
  });
});

describe('links', () => {
  it('bygger et turkortlink ud fra den adresse appen kører på', () => {
    expect(turkortLink('abc', 'https://feltbogen.dk')).toBe('https://feltbogen.dk/?turkort=abc');
  });

  it('læser tokenet fra adresselinjen', () => {
    const token = 'a'.repeat(32);
    expect(turkorttokenFraAdresse(`?turkort=${token}`)).toBe(token);
  });

  // Andet end vores eget format skal ikke sendes videre til serveren.
  it('afviser noget der ikke ligner et token vi har lavet', () => {
    expect(turkorttokenFraAdresse('?turkort=kort')).toBeNull();
    expect(turkorttokenFraAdresse('?turkort=' + 'z'.repeat(32))).toBeNull();
    expect(turkorttokenFraAdresse('?tur=' + 'a'.repeat(32))).toBeNull();
    expect(turkorttokenFraAdresse('')).toBeNull();
  });

  it('laver et kortlink af koordinater', () => {
    expect(kortlink({ lat: 56.83, lng: 9.85 })).toContain('mlat=56.83');
    expect(kortlink(null)).toBe('');
  });
});

describe('returtekst', () => {
  it('skriver dato og klokkeslæt ud på dansk', () => {
    expect(returtekst('2026-08-02T19:00')).toBe('søndag den 2. august kl. 19.00');
  });

  // En dato uden klokkeslæt er stadig en dato — der skal ikke stå kl. 00.00.
  it('lader klokkeslættet stå når det ikke er oplyst', () => {
    expect(returtekst('2026-08-02')).toBe('søndag den 2. august');
  });

  it('siger til når der ikke er oplyst noget', () => {
    expect(returtekst('')).toBe('Ikke oplyst');
    expect(returtekst('vrøvl')).toBe('Ikke oplyst');
  });
});

describe('erOverskredet', () => {
  const kort = (felter: Partial<ReturnType<typeof lavTurkort>>) =>
    ({ ...lavTurkort(tur(), '', NU), ...felter });

  it('er sandt når hjemkomsttidspunktet er passeret', () => {
    expect(erOverskredet(kort({ forventet_retur: '2026-07-30T09:00' }), NU)).toBe(true);
  });

  it('er falsk når tidspunktet ligger forude', () => {
    expect(erOverskredet(kort({ forventet_retur: '2026-08-02T19:00' }), NU)).toBe(false);
  });

  // Er han kommet hjem, er der ingenting at være bekymret over.
  it('er falsk på et udløbet kort, uanset tidspunktet', () => {
    expect(erOverskredet(kort({ forventet_retur: '2026-07-01T09:00', udloebet: true }), NU)).toBe(false);
  });

  it('er falsk når der ikke er oplyst et tidspunkt', () => {
    expect(erOverskredet(kort({ forventet_retur: '' }), NU)).toBe(false);
    expect(erOverskredet(kort({ forventet_retur: 'vrøvl' }), NU)).toBe(false);
  });
});
