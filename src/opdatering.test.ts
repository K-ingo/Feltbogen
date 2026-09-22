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

  // Versionslinjen på indstillingsskærmen er den eneste måde at sige udefra,
  // hvad der kører — "0.2.0 · a1b2c3d". Holder formatet ikke, kan svaret
  // ikke slås op i repoet, og så er linjen ikke til megen nytte.
  it('holder formatet: semver fra package.json og syv tegn af sha\'en', () => {
    const u = udgave();
    expect(u.version).toMatch(/^\d+\.\d+\.\d+/);
    // Uden .git — fx i en Docker-build uden sha udefra — står der "ukendt".
    expect(u.commit).toMatch(/^([0-9a-f]{7}|ukendt)$/);
  });
});
