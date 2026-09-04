import { describe, it, expect } from 'vitest';
import { linjenoegle, laesPakkede, veksl, fremdrift, fremdriftstekst, alle, noegleFor, mineLinjer } from './gaestepakning';
import type { Pakkelinje } from './smartMotor';

const linje = (over: Partial<Pakkelinje> = {}): Pakkelinje => ({
  uid: '', navn: 'Tarp', vaegt_g: 780, delt: false, baerer: '', egen: true, ...over
});

describe('linjenoegle', () => {
  it('bruger ejerens uid når der er et', () => {
    expect(linjenoegle(linje({ uid: 'i1' }))).toBe('i1');
  });

  // En deltagers eget grej findes ikke i nogen base — det er kun et navn og
  // en vægt, og nøglen skal alligevel pege på det samme hver gang.
  it('laver en stabil nøgle af navn og vægt når der ikke er et uid', () => {
    expect(linjenoegle(linje())).toBe('fri:Tarp:780');
    expect(linjenoegle(linje())).toBe(linjenoegle(linje()));
    expect(linjenoegle(linje({ navn: 'Økse' }))).not.toBe(linjenoegle(linje()));
  });
});

describe('noegleFor', () => {
  // To delte ture på den samme telefon skal have hver sin liste.
  it('giver hver delt tur sin egen nøgle', () => {
    expect(noegleFor('abc')).not.toBe(noegleFor('def'));
  });
});

describe('laesPakkede', () => {
  it('læser det den selv har skrevet', () => {
    expect(laesPakkede(JSON.stringify(['i1', 'i2']))).toEqual(new Set(['i1', 'i2']));
  });

  it('svarer tomt frem for at gå i stykker på noget ulæseligt', () => {
    expect(laesPakkede(null)).toEqual(new Set());
    expect(laesPakkede('')).toEqual(new Set());
    expect(laesPakkede('{ikke json')).toEqual(new Set());
    expect(laesPakkede('"en streng"')).toEqual(new Set());
    expect(laesPakkede('[1, null, "i1"]')).toEqual(new Set(['i1']));
  });
});

describe('veksl', () => {
  it('krydser af og fra igen', () => {
    expect(veksl(new Set(), 'i1')).toEqual(['i1']);
    expect(veksl(new Set(['i1']), 'i1')).toEqual([]);
  });

  it('rører ikke de andre', () => {
    expect(new Set(veksl(new Set(['i1', 'i2']), 'i3'))).toEqual(new Set(['i1', 'i2', 'i3']));
  });
});

describe('fremdrift', () => {
  const linjer = [linje({ uid: 'i1' }), linje({ uid: 'i2' }), linje({ uid: 'i3' })];

  it('tæller det afkrydsede af det der er på listen', () => {
    const f = fremdrift(new Set(['i1', 'i2']), linjer);
    expect(f).toEqual({ pakket: 2, ialt: 3, procent: 66, faerdig: false });
  });

  it('er først færdig når alt er med', () => {
    expect(fremdrift(new Set(['i1', 'i2', 'i3']), linjer).faerdig).toBe(true);
  });

  // Krydser man noget af og henter så ejerens nyeste, hvor det er væk, må
  // tallet ikke blive større end listen.
  it('tæller ikke afkrydsninger med på noget der ikke er på listen længere', () => {
    const f = fremdrift(new Set(['i1', 'vaek']), linjer);
    expect(f.pakket).toBe(1);
    expect(f.ialt).toBe(3);
  });

  it('kalder ikke en tom liste færdigpakket', () => {
    const f = fremdrift(new Set(), []);
    expect(f.faerdig).toBe(false);
    expect(f.procent).toBe(0);
  });

  // "100 %" med noget uden for tasken er en løgn man opdager i skoven.
  it('runder ned, så 100 kun betyder alt', () => {
    const mange = Array.from({ length: 300 }, (_, n) => linje({ uid: `i${n}` }));
    const naesten = new Set(mange.slice(0, 299).map((l) => l.uid));
    expect(fremdrift(naesten, mange).procent).toBe(99);
  });
});

describe('fremdriftstekst', () => {
  it('siger hvor langt man er', () => {
    expect(fremdriftstekst(fremdrift(new Set(['i1']), [linje({ uid: 'i1' }), linje({ uid: 'i2' })])))
      .toBe('1 af 2 pakket');
    expect(fremdriftstekst(fremdrift(new Set(['i1']), [linje({ uid: 'i1' })]))).toBe('Alt er pakket');
    expect(fremdriftstekst(fremdrift(new Set(), []))).toBe('Der er ikke valgt grej endnu');
  });
});

describe('alle', () => {
  it('giver nøglen på hver linje', () => {
    expect(alle([linje({ uid: 'i1' }), linje({ navn: 'Kniv', vaegt_g: 90 })]))
      .toEqual(['i1', 'fri:Kniv:90']);
  });
});

describe('mineLinjer', () => {
  const l = (navn: string, baerer: string) => linje({ uid: navn, navn, baerer });

  it('tager det ejeren har fordelt til én', () => {
    const alle = [l('Telt', 'Jakob'), l('Økse', 'Sofie'), l('Tarp', '')];
    expect(mineLinjer(alle, 'Jakob').map((x) => x.navn)).toEqual(['Telt']);
  });

  it('er ligeglad med store og små bogstaver og mellemrum', () => {
    expect(mineLinjer([l('Telt', 'jakob ')], ' Jakob').map((x) => x.navn)).toEqual(['Telt']);
  });

  // To der har taget den samme ting står som "Emil og Jakob". Den er begges.
  it('tager en ting, to har meldt sig til', () => {
    expect(mineLinjer([l('Telt', 'Emil og Jakob')], 'Jakob')).toHaveLength(1);
    expect(mineLinjer([l('Telt', 'Emil og Jakob')], 'Emil')).toHaveLength(1);
  });

  it('tager ikke noget, ingen har fået', () => {
    expect(mineLinjer([l('Tarp', '')], 'Jakob')).toEqual([]);
  });

  // Uden et navn er der ikke noget at matche på, og så ville et tomt
  // bærer-felt ellers regnes som ens eget.
  it('giver tomt uden et navn', () => {
    expect(mineLinjer([l('Tarp', '')], '')).toEqual([]);
    expect(mineLinjer([l('Telt', 'Jakob')], '   ')).toEqual([]);
  });
});
