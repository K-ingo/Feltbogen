import { describe, it, expect, vi } from 'vitest';

// Registreringen er en browserting; her testes kun det der kan regnes ud.
vi.mock('virtual:pwa-register', () => ({ registerSW: () => async () => undefined }));

import { byggetekst, udgave } from './opdatering';

describe('byggetekst', () => {
  it('skriver dato og klokkeslæt ud', () => {
    const tekst = byggetekst('2026-08-05T12:32:00.000Z');
    expect(tekst).toMatch(/2026/);
    expect(tekst).toContain('kl.');
  });

  // Bedre end "Invalid Date" på indstillingsskærmen.
  it('siger det pænt når tidspunktet ikke kan læses', () => {
    expect(byggetekst('')).toBe('ukendt tidspunkt');
    expect(byggetekst('i går')).toBe('ukendt tidspunkt');
  });
});

describe('udgave', () => {
  // Værdierne bages ind ved build. Testene kører uden det trin, så her
  // tjekkes kun at de tre findes og er tekst — ikke hvad der står i dem.
  it('oplyser version, commit og byggetidspunkt', () => {
    const u = udgave();
    expect(typeof u.version).toBe('string');
    expect(typeof u.commit).toBe('string');
    expect(typeof u.bygget).toBe('string');
  });
});
