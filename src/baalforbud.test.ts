import { describe, it, expect } from 'vitest';
import { baaltjek } from './baalforbud';
import type { VejrDag } from './smartMotor';

const dag = (dato: string, temp_max: number, nedboer_mm: number): VejrDag => ({
  dato,
  temp_min: temp_max - 8,
  temp_max,
  nedboer_mm,
  vind_ms: 4,
  vejrkode: 1,
  sol_op: '05:00',
  sol_ned: '21:00'
});

describe('baaltjek', () => {
  it('kalder det tørt når der ikke er meldt regn og det er varmt', () => {
    const tjek = baaltjek([dag('2026-07-10', 26, 0), dag('2026-07-11', 24, 0)])!;

    expect(tjek.toerhed).toBe('toert');
    expect(tjek.toerreDage).toBe(2);
    expect(tjek.tekst).toContain('afbrændingsforbud');
  });

  it('kalder det vådt når der er meldt regn', () => {
    const tjek = baaltjek([dag('2026-07-10', 18, 6), dag('2026-07-11', 17, 4)])!;

    expect(tjek.toerhed).toBe('vaadt');
    expect(tjek.nedboer_mm).toBe(10);
    expect(tjek.tekst).toContain('Tørt brænde');
  });

  // Tørt men koldt er ikke det samme som brandfare. En frostklar novemberdag
  // skal ikke give den samme besked som en hedebølge.
  it('kalder det ikke tørt når det er koldt', () => {
    const tjek = baaltjek([dag('2026-11-10', 6, 0), dag('2026-11-11', 5, 0)])!;

    expect(tjek.toerhed).toBe('almindeligt');
    expect(tjek.toerreDage).toBe(2);
  });

  it('kalder en blandet udsigt for almindelig', () => {
    const tjek = baaltjek([dag('2026-07-10', 25, 0), dag('2026-07-11', 22, 3)])!;

    expect(tjek.toerhed).toBe('almindeligt');
    expect(tjek.tekst).toContain('1 af turens 2 dage');
  });

  it('siger det i ental på en dagstur', () => {
    expect(baaltjek([dag('2026-07-10', 26, 0)])!.tekst).toContain('turens dag');
  });

  it('giver intet uden en udsigt', () => {
    expect(baaltjek([])).toBeNull();
  });

  // Det er ikke DMI's indeks, og det skal stå — ellers ligner det noget det
  // ikke er.
  it('siger hvad det ikke er', () => {
    const tjek = baaltjek([dag('2026-07-10', 26, 0)])!;

    expect(tjek.begrundelse).toContain('skovbrandindeks');
    expect(tjek.begrundelse).toContain('beredskab');
  });

  it('klarer en udsigt med huller i tallene', () => {
    const hul = { ...dag('2026-07-10', 26, 0), nedboer_mm: NaN, temp_max: NaN };
    const tjek = baaltjek([hul])!;

    expect(tjek.nedboer_mm).toBe(0);
    expect(tjek.varmest).toBe(0);
    // Uden en temperatur er der ikke grundlag for at kalde det tørt.
    expect(tjek.toerhed).toBe('almindeligt');
  });
});
