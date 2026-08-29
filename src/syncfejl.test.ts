import { describe, it, expect } from 'vitest';
import { fejlartAf, laesSyncfejl, kraeverLogin, FEJLTEKST } from './syncfejl';
import type { Fejlart } from './syncfejl';

describe('fejlartAf', () => {
  // PocketBase-klienten pakker en fejlet fetch ind som status 0. Det er ikke
  // et afslag — serveren blev aldrig spurgt.
  it('læser en fejlet fetch som manglende forbindelse', () => {
    expect(fejlartAf({ status: 0 })).toBe('ingen_forbindelse');
  });

  it('læser noget der slet ikke er en pb-fejl som manglende forbindelse', () => {
    expect(fejlartAf(new Error('boom'))).toBe('ingen_forbindelse');
    expect(fejlartAf(null)).toBe('ingen_forbindelse');
  });

  it('skelner en udløbet session fra et afslag', () => {
    expect(fejlartAf({ status: 401 })).toBe('ikke_logget_ind');
    expect(fejlartAf({ status: 403 })).toBe('ikke_logget_ind');
    expect(fejlartAf({ status: 400 })).toBe('afvist');
  });

  it('skelner serverens egne problemer fra afviste data', () => {
    expect(fejlartAf({ status: 500 })).toBe('server');
    expect(fejlartAf({ status: 502 })).toBe('server');
  });

  it('har en tekst til hver art, og hver tekst siger hvad man kan gøre', () => {
    const arter: Fejlart[] = ['ingen_forbindelse', 'ikke_logget_ind', 'afvist', 'server', 'ukendt'];
    for (const art of arter) {
      expect(FEJLTEKST[art].length).toBeGreaterThan(20);
    }
  });
});

describe('kraeverLogin', () => {
  it('er kun sand for den udløbne session', () => {
    expect(kraeverLogin({ art: 'ikke_logget_ind', detalje: '', hvornaar: '' })).toBe(true);
    expect(kraeverLogin({ art: 'ingen_forbindelse', detalje: '', hvornaar: '' })).toBe(false);
    expect(kraeverLogin(null)).toBe(false);
  });
});

describe('laesSyncfejl', () => {
  it('læser det den selv har skrevet', () => {
    const fejl = { art: 'afvist' as const, detalje: 'Failed to create record.', hvornaar: '2026-08-29T10:00:00.000Z' };
    expect(laesSyncfejl(JSON.stringify(fejl))).toEqual(fejl);
  });

  it('svarer null når der ikke står noget', () => {
    expect(laesSyncfejl(null)).toBeNull();
    expect(laesSyncfejl('')).toBeNull();
  });

  it('svarer null frem for at gå i stykker på noget ulæseligt', () => {
    expect(laesSyncfejl('{ikke json')).toBeNull();
    expect(laesSyncfejl('"en streng"')).toBeNull();
    expect(laesSyncfejl('{"art":"noget_andet"}')).toBeNull();
  });

  it('tåler at de andre felter mangler', () => {
    expect(laesSyncfejl('{"art":"server"}')).toEqual({ art: 'server', detalje: '', hvornaar: '' });
  });
});
