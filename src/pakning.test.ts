import { describe, it, expect } from 'vitest';
import { pakkede, erPakket, veksl, pakAlle, ryd, fremdrift, fremdriftstekst } from './pakning';
import { lavItem, lavTur } from './test/data';

// Tre stykker grej på en tur, ingen pakket endnu.
function tur() {
  const grej = [
    lavItem({ navn: 'Telt' }),
    lavItem({ navn: 'Sovepose' }),
    lavItem({ navn: 'Trangia' })
  ];
  return { grej, tur: lavTur({ loese_item_ids: grej.map((i) => i.uid) }) };
}

describe('pakkede', () => {
  it('læser en tur fra før feltet fandtes som ingenting pakket', () => {
    const gammel = lavTur();
    delete (gammel as { pakkede_item_uids?: string[] }).pakkede_item_uids;

    expect(pakkede(gammel).size).toBe(0);
    expect(fremdrift(gammel, []).pakket).toBe(0);
  });
});

describe('veksl', () => {
  it('krydser af og af igen', () => {
    const { grej, tur: t } = tur();

    const efterFoerste = veksl(t, grej[0].uid);
    expect(efterFoerste).toEqual([grej[0].uid]);

    const efterAnden = veksl({ ...t, pakkede_item_uids: efterFoerste }, grej[0].uid);
    expect(efterAnden).toEqual([]);
  });

  it('rører ikke den liste den fik', () => {
    const { grej, tur: t } = tur();
    const foer = t.pakkede_item_uids;

    veksl(t, grej[0].uid);

    expect(t.pakkede_item_uids).toBe(foer);
    expect(t.pakkede_item_uids).toEqual([]);
  });

  it('siger om noget er pakket', () => {
    const { grej, tur: t } = tur();
    const pakket = { ...t, pakkede_item_uids: veksl(t, grej[1].uid) };

    expect(erPakket(pakket, grej[1].uid)).toBe(true);
    expect(erPakket(pakket, grej[0].uid)).toBe(false);
  });
});

describe('fremdrift', () => {
  it('tæller det pakkede og siger hvad der mangler', () => {
    const { grej, tur: t } = tur();
    const pakket = { ...t, pakkede_item_uids: [grej[0].uid] };

    const f = fremdrift(pakket, grej);

    expect(f).toMatchObject({ pakket: 1, ialt: 3, faerdig: false });
    expect(f.mangler.map((i) => i.navn)).toEqual(['Sovepose', 'Trangia']);
  });

  it('er færdig når alt er krydset af', () => {
    const { grej, tur: t } = tur();
    const f = fremdrift({ ...t, pakkede_item_uids: pakAlle(grej) }, grej);

    expect(f).toMatchObject({ pakket: 3, ialt: 3, procent: 100, faerdig: true });
    expect(f.mangler).toEqual([]);
  });

  it('regner en tom pakkeliste som ikke-færdig', () => {
    // Der er ingenting at være færdig med. Samme regel som afgangs-tjekket.
    const f = fremdrift(lavTur(), []);

    expect(f).toMatchObject({ pakket: 0, ialt: 0, procent: 0, faerdig: false });
  });

  it('runder ned, så 100 % kun står når alt er i tasken', () => {
    const grej = Array.from({ length: 300 }, (_, n) => lavItem({ navn: `Ting ${n}` }));
    const t = lavTur({
      loese_item_ids: grej.map((i) => i.uid),
      pakkede_item_uids: grej.slice(0, 299).map((i) => i.uid)
    });

    // 299/300 = 99,67 %. Rundet op ville der stå 100 med en ting udenfor.
    expect(fremdrift(t, grej).procent).toBe(99);
    expect(fremdrift(t, grej).faerdig).toBe(false);
  });

  it('tæller ikke grej med der er taget af turen igen', () => {
    const { grej, tur: t } = tur();
    // Alle tre krydset af, men kun to er stadig på turen.
    const pakket = { ...t, pakkede_item_uids: pakAlle(grej) };
    const tilbage = grej.slice(0, 2);

    const f = fremdrift(pakket, tilbage);

    expect(f).toMatchObject({ pakket: 2, ialt: 2, faerdig: true });
  });

  it('rydder alt på én gang', () => {
    expect(ryd()).toEqual([]);
  });
});

describe('fremdriftstekst', () => {
  it('skriver hvor langt man er', () => {
    const { grej, tur: t } = tur();

    expect(fremdriftstekst(fremdrift(t, grej))).toBe('0 af 3 pakket');
    expect(fremdriftstekst(fremdrift({ ...t, pakkede_item_uids: pakAlle(grej) }, grej)))
      .toBe('Alt er pakket');
    expect(fremdriftstekst(fremdrift(t, []))).toBe('Intet grej valgt endnu');
  });
});
