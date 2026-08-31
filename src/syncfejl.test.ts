import { describe, it, expect } from 'vitest';
import { fejlartAf, laesSyncfejl, kraeverLogin, FEJLTEKST, fejltekst, noterFejl, SYNCFEJL_NOEGLE } from './syncfejl';
import { laes } from './indstillinger';
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

describe('fejltekst', () => {
  // Den samme art betyder to forskellige ting: enten er man selv uden
  // dækning, eller også svarer serveren ikke. Forskellen er hele forskellen
  // på "vent" og "der er noget galt med serveren".
  it('siger noget andet om en tavs server, når man selv er på nettet', () => {
    const paaNettet = fejltekst('ingen_forbindelse', true);
    expect(paaNettet).toContain('Serveren svarede ikke');
    expect(paaNettet).not.toBe(FEJLTEKST.ingen_forbindelse);
  });

  it('bruger den almindelige tekst, når man er offline', () => {
    expect(fejltekst('ingen_forbindelse', false)).toBe(FEJLTEKST.ingen_forbindelse);
  });

  it('lader de andre arter være', () => {
    expect(fejltekst('afvist', true)).toBe(FEJLTEKST.afvist);
    expect(fejltekst('ikke_logget_ind', true)).toBe(FEJLTEKST.ikke_logget_ind);
  });
});

describe('noterFejl', () => {
  // PocketBase-klienten sætter selv "Something went wrong." på fejlen, når
  // svaret ikke havde nogen besked. Skærmen skrev den ud som "Serveren sagde:
  // Something went wrong." om en server, der aldrig svarede.
  it('gemmer kun det, serveren selv sagde', async () => {
    await noterFejl({ status: 0, message: 'Something went wrong.' });
    expect(laesSyncfejl(await laes(SYNCFEJL_NOEGLE))?.detalje).toBe('');
  });

  it('gemmer serverens egen besked, når der er en', async () => {
    await noterFejl({ status: 400, response: { message: 'Failed to create record.' }, message: 'Failed to create record.' });
    const gemt = laesSyncfejl(await laes(SYNCFEJL_NOEGLE));
    expect(gemt?.art).toBe('afvist');
    expect(gemt?.detalje).toBe('Failed to create record.');
  });
});
