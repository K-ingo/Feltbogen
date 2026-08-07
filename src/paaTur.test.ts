import { describe, it, expect } from 'vitest';
import { dageTilbage, dagsnavn, naesteSkift, vejrForDag } from './paaTur';
import type { VejrDag, VejrData } from './smartMotor';
import { lavTur } from './test/data';

const NU = new Date('2026-07-30T12:00:00');

const dag = (dato: string, felter: Partial<VejrDag> = {}): VejrDag => ({
  dato,
  temp_min: 12,
  temp_max: 20,
  nedboer_mm: 0,
  vind_ms: 3,
  vejrkode: 0,
  sol_op: '05:12',
  sol_ned: '21:34',
  ...felter
});

const vejr = (dage: VejrDag[]): VejrData => ({ dage, observationer: [], hentet: '' });

describe('vejrForDag', () => {
  it('finder dagen i dag', () => {
    const data = vejr([dag('2026-07-29'), dag('2026-07-30', { temp_max: 26 })]);
    expect(vejrForDag(data, NU)?.temp_max).toBe(26);
  });

  it('giver null når udsigten ikke dækker i dag', () => {
    expect(vejrForDag(vejr([dag('2026-08-05')]), NU)).toBeNull();
    expect(vejrForDag(null, NU)).toBeNull();
  });
});

describe('naesteSkift', () => {
  it('finder den første våde dag forude', () => {
    const data = vejr([dag('2026-07-31'), dag('2026-08-01', { nedboer_mm: 9 })]);

    const skift = naesteSkift(data, NU);

    expect(skift?.dag.dato).toBe('2026-08-01');
    expect(skift?.aarsag).toBe('9 mm regn');
  });

  it('fanger også blæst og frostnætter', () => {
    expect(naesteSkift(vejr([dag('2026-08-01', { vind_ms: 11 })]), NU)?.aarsag).toBe('11 m/s vind');
    expect(naesteSkift(vejr([dag('2026-08-01', { temp_min: -1 })]), NU)?.aarsag).toBe('ned til -1°C');
  });

  // Vådt er det der ødelægger en tur; det skal nævnes først når flere ting
  // rammer den samme dag.
  it('nævner vådt før blæst', () => {
    const data = vejr([dag('2026-08-01', { nedboer_mm: 8, vind_ms: 12 })]);
    expect(naesteSkift(data, NU)?.aarsag).toBe('8 mm regn');
  });

  // Man kan se ud ad hængekøjen — det er det forude man ikke kan.
  it('ser bort fra i dag og dagene bagud', () => {
    const data = vejr([dag('2026-07-29', { nedboer_mm: 20 }), dag('2026-07-30', { nedboer_mm: 20 })]);
    expect(naesteSkift(data, NU)).toBeNull();
  });

  it('tier når vejret holder sig roligt', () => {
    expect(naesteSkift(vejr([dag('2026-08-01'), dag('2026-08-02')]), NU)).toBeNull();
  });

  it('klarer at der ingen udsigt er hentet', () => {
    expect(naesteSkift(null, NU)).toBeNull();
    expect(naesteSkift(vejr([]), NU)).toBeNull();
  });

  it('tager den første dag der skifter, ikke den værste', () => {
    const data = vejr([
      dag('2026-08-01', { nedboer_mm: 6 }),
      dag('2026-08-02', { nedboer_mm: 30 })
    ]);

    expect(naesteSkift(data, NU)?.dag.dato).toBe('2026-08-01');
  });
});

describe('dageTilbage', () => {
  it('tæller dage til slutdatoen', () => {
    expect(dageTilbage(lavTur({ slutdato: '2026-08-02' }), NU)).toBe('3 dage tilbage');
    expect(dageTilbage(lavTur({ slutdato: '2026-07-31' }), NU)).toBe('1 dag tilbage');
  });

  it('siger sidste dag på slutdatoen', () => {
    expect(dageTilbage(lavTur({ slutdato: '2026-07-30' }), NU)).toBe('Sidste dag');
  });

  it('siger til når slutdatoen er passeret', () => {
    expect(dageTilbage(lavTur({ slutdato: '2026-07-28' }), NU)).toBe('Slutdatoen er passeret');
  });

  it('falder tilbage på startdatoen når der ingen slutdato er', () => {
    expect(dageTilbage(lavTur({ startdato: '2026-08-01', slutdato: '' }), NU)).toBe('2 dage tilbage');
  });

  it('siger ingenting når turen ingen datoer har', () => {
    expect(dageTilbage(lavTur({ startdato: '', slutdato: '' }), NU)).toBe('');
  });
});

describe('dagsnavn', () => {
  it('skriver ugedagen ud på dansk', () => {
    expect(dagsnavn('2026-08-01')).toBe('lørdag');
  });

  it('giver datoen tilbage når den ikke kan læses', () => {
    expect(dagsnavn('vrøvl')).toBe('vrøvl');
  });
});
