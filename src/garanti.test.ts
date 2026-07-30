import { describe, it, expect } from 'vitest';
import { laesDanskDato, dageTil, garantiAdvarsel } from './smartMotor';
import { lavItem } from './test/data';

describe('laesDanskDato', () => {
  it('læser DD/MM/ÅÅÅÅ', () => {
    const d = laesDanskDato('15/01/2025');
    expect(d?.getDate()).toBe(15);
    expect(d?.getMonth()).toBe(0);
    expect(d?.getFullYear()).toBe(2025);
  });

  it('afviser en dato der ikke findes', () => {
    // Uden tjek ville Date rulle 31/02 videre til 3. marts.
    expect(laesDanskDato('31/02/2025')).toBeNull();
    expect(laesDanskDato('32/01/2025')).toBeNull();
  });

  it('afviser volapyk og tomme værdier', () => {
    expect(laesDanskDato('')).toBeNull();
    expect(laesDanskDato('i morgen')).toBeNull();
    expect(laesDanskDato('2025-01-15')).toBeNull();
    expect(laesDanskDato('15/01')).toBeNull();
  });
});

describe('dageTil', () => {
  const nu = new Date('2026-07-30T14:00:00');

  it('regner hele dage, uafhængigt af klokkeslæt', () => {
    expect(dageTil(new Date('2026-08-02T01:00:00'), nu)).toBe(3);
    expect(dageTil(new Date('2026-07-30T23:59:00'), nu)).toBe(0);
  });

  it('giver negativt for datoer der er passeret', () => {
    expect(dageTil(new Date('2026-07-25T10:00:00'), nu)).toBe(-5);
  });
});

describe('garantiAdvarsel', () => {
  const nu = new Date('2026-07-30T12:00:00');
  const medGaranti = (udloeber: string, paamindelse = 30) =>
    lavItem({ garanti: { laengde_aar: 2, udloeber_dato: udloeber, paamindelse_dage: paamindelse } });

  it('advarer når udløbet nærmer sig', () => {
    expect(garantiAdvarsel(medGaranti('13/08/2026'), nu)).toBe('Garanti udløber om 14 dage');
  });

  it('bruger ental ved én dag', () => {
    expect(garantiAdvarsel(medGaranti('31/07/2026'), nu)).toBe('Garanti udløber om 1 dag');
  });

  it('siger til på selve dagen', () => {
    expect(garantiAdvarsel(medGaranti('30/07/2026'), nu)).toBe('Garanti udløber i dag');
  });

  it('bliver ved med at advare efter udløb', () => {
    expect(garantiAdvarsel(medGaranti('20/07/2026'), nu)).toBe('Garanti udløb for 10 dage siden');
  });

  it('tier når der er langt igen', () => {
    expect(garantiAdvarsel(medGaranti('13/08/2027'), nu)).toBeNull();
  });

  it('respekterer et kortere påmindelsesvindue', () => {
    // 14 dage til udløb, men brugeren vil kun advares 7 dage før.
    expect(garantiAdvarsel(medGaranti('13/08/2026', 7), nu)).toBeNull();
    expect(garantiAdvarsel(medGaranti('04/08/2026', 7), nu)).toBe('Garanti udløber om 5 dage');
  });

  it('tier når der ikke er nogen garanti', () => {
    expect(garantiAdvarsel(lavItem({ garanti: null }), nu)).toBeNull();
    expect(garantiAdvarsel(medGaranti(''), nu)).toBeNull();
    expect(garantiAdvarsel(medGaranti('ikke en dato'), nu)).toBeNull();
  });
});
