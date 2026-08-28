import { describe, it, expect } from 'vitest';
import { formatterPeriode, kortDag, datoTekst, maanedsnavn } from './datotekst';

describe('formatterPeriode', () => {
  it('skriver måneden én gang inden for samme måned', () => {
    expect(formatterPeriode('2026-07-21', '2026-07-23')).toBe('21.–23. juli');
  });

  it('skriver måneden begge steder over et månedsskifte', () => {
    expect(formatterPeriode('2026-07-30', '2026-08-02')).toBe('30. juli – 2. august');
  });

  it('skriver måneden begge steder over et årsskifte', () => {
    expect(formatterPeriode('2026-12-30', '2027-01-02')).toBe('30. december – 2. januar');
  });

  it('skriver én dato når turen er på én dag', () => {
    expect(formatterPeriode('2026-07-21', '2026-07-21')).toBe('21. juli');
  });

  it('klarer sig med kun en startdato', () => {
    expect(formatterPeriode('2026-07-21', '')).toBe('21. juli');
  });

  it('giver tom tekst uden startdato', () => {
    expect(formatterPeriode('', '2026-07-23')).toBe('');
  });

  it('giver tom tekst når datoen ikke er en dato', () => {
    expect(formatterPeriode('i morgen', '2026-07-23')).toBe('');
  });

  // En ulæselig slutdato skal ikke koste hele linjen — starten er stadig
  // værd at vise.
  it('falder tilbage til startdatoen når slutdatoen er noget vrøvl', () => {
    expect(formatterPeriode('2026-07-21', 'senere')).toBe('21. juli');
  });
});

describe('kortDag', () => {
  it('skriver ugedag og dato kort', () => {
    expect(kortDag('2026-07-21')).toBe('tir 21/7');
  });

  it('giver tom tekst på noget der ikke er en dato', () => {
    expect(kortDag('en tirsdag')).toBe('');
  });
});

describe('datoTekst', () => {
  it('skriver en ISO-tid ud som dansk dato', () => {
    expect(datoTekst('2026-07-21T09:30:00.000Z')).toContain('2026');
  });

  // Bedre end "Invalid Date" på skærmen.
  it('siger det pænt når tiden ikke kan læses', () => {
    expect(datoTekst('')).toBe('et tidligere tidspunkt');
    expect(datoTekst('for lidt siden')).toBe('et tidligere tidspunkt');
  });
});

describe('maanedsnavn', () => {
  it('skriver måneden ud på dansk', () => {
    expect(maanedsnavn('2026-09-14')).toBe('september');
    expect(maanedsnavn('2026-01-02')).toBe('januar');
  });

  it('giver tom tekst på noget der ikke er en dato', () => {
    expect(maanedsnavn('')).toBe('');
    expect(maanedsnavn('til sommer')).toBe('');
  });
});
