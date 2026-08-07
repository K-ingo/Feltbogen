import { describe, it, expect } from 'vitest';
import {
  STANDARD_SKABELON,
  fjernLinje,
  fletSkabelonInd,
  fremdrift,
  fremdriftstekst,
  laesSkabelon,
  manglende,
  nytAfgangsTjek,
  saetAfkrydset,
  saetTekst,
  skrivSkabelon,
  tilfoejLinje
} from './afgangsTjek';

const SKABELON = ['Nøgler', 'Telefon opladet', 'Sagt hvor jeg er'];

describe('nytAfgangsTjek', () => {
  it('bygger en linje pr. punkt i skabelonen', () => {
    const tjek = nytAfgangsTjek(SKABELON);

    expect(tjek.linjer.map((l) => l.tekst)).toEqual(SKABELON);
    expect(tjek.linjer.every((l) => l.fra_skabelon)).toBe(true);
    expect(tjek.linjer.every((l) => !l.afkrydset)).toBe(true);
  });

  it('giver hver linje sit eget id', () => {
    const ider = nytAfgangsTjek(SKABELON).linjer.map((l) => l.id);
    expect(new Set(ider).size).toBe(SKABELON.length);
  });

  it('bruger standardskabelonen når ingen er angivet', () => {
    expect(nytAfgangsTjek().linjer).toHaveLength(STANDARD_SKABELON.length);
  });
});

describe('afkrydsning og redigering', () => {
  const tjek = nytAfgangsTjek(SKABELON);
  const foerste = tjek.linjer[0].id;

  it('krydser én linje af uden at røre de andre', () => {
    const nyt = saetAfkrydset(tjek, foerste, true);

    expect(nyt.linjer[0].afkrydset).toBe(true);
    expect(nyt.linjer[1].afkrydset).toBe(false);
    // Den oprindelige må ikke ændre sig.
    expect(tjek.linjer[0].afkrydset).toBe(false);
  });

  it('kan krydse af igen', () => {
    const paa = saetAfkrydset(tjek, foerste, true);
    expect(saetAfkrydset(paa, foerste, false).linjer[0].afkrydset).toBe(false);
  });

  it('retter teksten på en linje', () => {
    expect(saetTekst(tjek, foerste, 'Bilnøgler').linjer[0].tekst).toBe('Bilnøgler');
  });

  it('lægger en egen linje til bagest', () => {
    const nyt = tilfoejLinje(tjek, '  Kaffe  ');

    expect(nyt.linjer).toHaveLength(4);
    expect(nyt.linjer[3].tekst).toBe('Kaffe');
    expect(nyt.linjer[3].fra_skabelon).toBe(false);
  });

  // En tom linje er ikke en huskeliste, den er støj man skal krydse af.
  it('lægger ikke tomme linjer til', () => {
    expect(tilfoejLinje(tjek, '   ')).toBe(tjek);
  });

  it('fjerner en linje', () => {
    expect(fjernLinje(tjek, foerste).linjer.map((l) => l.tekst)).toEqual(SKABELON.slice(1));
  });
});

describe('fletSkabelonInd', () => {
  it('lægger nye punkter til bagest', () => {
    const nyt = fletSkabelonInd(nytAfgangsTjek(SKABELON), [...SKABELON, 'Bålforbud tjekket']);

    expect(nyt.linjer.map((l) => l.tekst)).toEqual([...SKABELON, 'Bålforbud tjekket']);
  });

  it('beholder afkrydsninger gennem en fletning', () => {
    const tjek = nytAfgangsTjek(SKABELON);
    const afkrydset = saetAfkrydset(tjek, tjek.linjer[1].id, true);

    const nyt = fletSkabelonInd(afkrydset, [...SKABELON, 'Nyt punkt']);

    expect(nyt.linjer[1].afkrydset).toBe(true);
  });

  it('fjerner ikke egne linjer selvom de ikke står i skabelonen', () => {
    const medEgen = tilfoejLinje(nytAfgangsTjek(SKABELON), 'Kaffe');

    expect(fletSkabelonInd(medEgen, SKABELON).linjer.map((l) => l.tekst)).toContain('Kaffe');
  });

  // Ellers ville hver fletning lægge det samme punkt til igen.
  it('lægger ikke det samme punkt til to gange', () => {
    const tjek = nytAfgangsTjek(SKABELON);
    expect(fletSkabelonInd(tjek, SKABELON)).toBe(tjek);
  });

  it('matcher uden hensyn til store bogstaver og mellemrum', () => {
    const tjek = nytAfgangsTjek(['Nøgler']);
    expect(fletSkabelonInd(tjek, ['  nøgler  '])).toBe(tjek);
  });
});

describe('fremdrift', () => {
  it('tæller afkrydsede af det samlede antal', () => {
    const tjek = nytAfgangsTjek(SKABELON);
    const et = saetAfkrydset(tjek, tjek.linjer[0].id, true);

    expect(fremdrift(et)).toEqual({ afkrydsede: 1, ialt: 3, faerdig: false });
  });

  it('er færdig når alt er krydset af', () => {
    let tjek = nytAfgangsTjek(SKABELON);
    tjek.linjer.forEach((l) => { tjek = saetAfkrydset(tjek, l.id, true); });

    expect(fremdrift(tjek).faerdig).toBe(true);
  });

  // Der er ingenting at være færdig med.
  it('regner en tom liste som ikke færdig', () => {
    expect(fremdrift({ linjer: [] }).faerdig).toBe(false);
    expect(fremdrift(null)).toEqual({ afkrydsede: 0, ialt: 0, faerdig: false });
  });
});

describe('fremdriftstekst', () => {
  it('siger til når listen ikke er taget i brug', () => {
    expect(fremdriftstekst(null)).toBe('Ikke taget i brug');
    expect(fremdriftstekst({ linjer: [] })).toBe('Ikke taget i brug');
  });

  it('tæller undervejs og melder færdig til sidst', () => {
    let tjek = nytAfgangsTjek(SKABELON);
    expect(fremdriftstekst(tjek)).toBe('0 af 3');

    tjek = saetAfkrydset(tjek, tjek.linjer[0].id, true);
    expect(fremdriftstekst(tjek)).toBe('1 af 3');

    tjek.linjer.forEach((l) => { tjek = saetAfkrydset(tjek, l.id, true); });
    expect(fremdriftstekst(tjek)).toBe('Alt afkrydset');
  });
});

describe('manglende', () => {
  it('giver kun det der ikke er krydset af', () => {
    const tjek = nytAfgangsTjek(SKABELON);
    const et = saetAfkrydset(tjek, tjek.linjer[0].id, true);

    expect(manglende(et).map((l) => l.tekst)).toEqual(SKABELON.slice(1));
  });

  it('klarer at der ikke er nogen liste', () => {
    expect(manglende(null)).toEqual([]);
  });
});

describe('skabelonen i indstillingerne', () => {
  it('skriver og læser den samme liste', () => {
    expect(laesSkabelon(skrivSkabelon(SKABELON))).toEqual(SKABELON);
  });

  it('renser tomme punkter væk på vej ud', () => {
    expect(laesSkabelon(skrivSkabelon(['Nøgler', '   ', '']))).toEqual(['Nøgler']);
  });

  // En bruger der aldrig har rørt indstillingen skal have noget at gå med.
  it('falder tilbage på standarden når der ikke står noget', () => {
    expect(laesSkabelon(null)).toEqual([...STANDARD_SKABELON]);
    expect(laesSkabelon('')).toEqual([...STANDARD_SKABELON]);
  });

  it('falder tilbage på standarden når værdien ikke kan læses', () => {
    expect(laesSkabelon('ikke json')).toEqual([...STANDARD_SKABELON]);
    expect(laesSkabelon('{"nej":1}')).toEqual([...STANDARD_SKABELON]);
  });

  // En tom skabelon er et valg, ikke en fejl — men den skal kunne gemmes.
  it('lader en tom liste blive tom', () => {
    expect(laesSkabelon('[]')).toEqual([]);
  });
});
