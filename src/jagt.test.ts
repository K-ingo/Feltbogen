import { describe, it, expect } from 'vitest';
import { SAESONER, iPerioden, jagtvarsel } from './jagt';
import { lavTur } from './test/data';

const iSkoven = (felter: Parameters<typeof lavTur>[0] = {}) =>
  lavTur({ terraen: 'skov', ...felter });

describe('iPerioden', () => {
  const drivjagt = SAESONER.find((s) => s.navn === 'Drivjagt')!;
  const bukkejagt = SAESONER.find((s) => s.navn === 'Bukkejagt')!;

  // Drivjagt går over nytår, og det er den nemmeste fejl at lave.
  it('holder en periode der går over nytår', () => {
    expect(iPerioden(new Date('2026-11-15'), drivjagt)).toBe(true);
    expect(iPerioden(new Date('2027-01-10'), drivjagt)).toBe(true);
    expect(iPerioden(new Date('2026-10-01'), drivjagt)).toBe(true);
    expect(iPerioden(new Date('2027-01-31'), drivjagt)).toBe(true);

    expect(iPerioden(new Date('2026-02-01'), drivjagt)).toBe(false);
    expect(iPerioden(new Date('2026-06-15'), drivjagt)).toBe(false);
    expect(iPerioden(new Date('2026-09-30'), drivjagt)).toBe(false);
  });

  it('holder en almindelig periode inden for året', () => {
    expect(iPerioden(new Date('2026-05-16'), bukkejagt)).toBe(true);
    expect(iPerioden(new Date('2026-06-20'), bukkejagt)).toBe(true);
    expect(iPerioden(new Date('2026-07-15'), bukkejagt)).toBe(true);

    expect(iPerioden(new Date('2026-05-15'), bukkejagt)).toBe(false);
    expect(iPerioden(new Date('2026-07-16'), bukkejagt)).toBe(false);
  });
});

describe('jagtvarsel', () => {
  it('varsler om drivjagt på en tur i november', () => {
    const varsel = jagtvarsel(iSkoven({ startdato: '2026-11-14', slutdato: '2026-11-16' }));

    expect(varsel?.saesoner.map((s) => s.navn)).toContain('Drivjagt');
  });

  // En tur i juli er i bukkejagt, men ikke i drivjagt. Varsles der for begge,
  // holder folk op med at læse.
  it('varsler kun om de sæsoner turen faktisk ligger i', () => {
    const varsel = jagtvarsel(iSkoven({ startdato: '2026-07-01', slutdato: '2026-07-03' }));

    expect(varsel?.saesoner.map((s) => s.navn)).toEqual(['Bukkejagt']);
  });

  it('tier på en tur uden for enhver sæson', () => {
    expect(jagtvarsel(iSkoven({ startdato: '2026-03-10', slutdato: '2026-03-12' }))).toBeNull();
  });

  // Der er ingen drivjagt på en kyststrækning.
  it('varsler kun i skov og mix', () => {
    const dato = { startdato: '2026-11-14', slutdato: '2026-11-16' };

    expect(jagtvarsel(lavTur({ terraen: 'skov', ...dato }))).not.toBeNull();
    expect(jagtvarsel(lavTur({ terraen: 'mix', ...dato }))).not.toBeNull();
    expect(jagtvarsel(lavTur({ terraen: 'kyst', ...dato }))).toBeNull();
    expect(jagtvarsel(lavTur({ terraen: 'fjeld', ...dato }))).toBeNull();
  });

  // Netop den tur hvor man kan blive overrasket: den begynder uden for
  // sæsonen og slutter inde i den.
  it('fanger en tur der krydser ind i en sæson', () => {
    const varsel = jagtvarsel(iSkoven({ startdato: '2026-08-30', slutdato: '2026-09-02' }));

    expect(varsel?.saesoner.map((s) => s.navn)).toContain('Almindelig jagtsæson');
  });

  it('klarer en tur uden slutdato', () => {
    const varsel = jagtvarsel(iSkoven({ startdato: '2026-11-14', slutdato: '' }));
    expect(varsel).not.toBeNull();
  });

  it('tier når datoen er vrøvl', () => {
    expect(jagtvarsel(iSkoven({ startdato: '', slutdato: '' }))).toBeNull();
    expect(jagtvarsel(iSkoven({ startdato: 'i morgen', slutdato: '' }))).toBeNull();
  });

  // Appen ved ikke om der faktisk er jagt dér den dag, og det skal stå.
  it('siger hvad den ikke ved', () => {
    const varsel = jagtvarsel(iSkoven({ startdato: '2026-11-14', slutdato: '2026-11-16' }));

    expect(varsel?.begrundelse).toContain('ved ikke');
    expect(varsel?.begrundelse).toContain('Miljøstyrelsen');
  });
});
