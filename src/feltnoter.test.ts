import { describe, it, expect } from 'vitest';
import {
  efterDag,
  fjern,
  harFeltnoter,
  hvornaar,
  nyIndgang,
  nyesteFoerst,
  resumetekst,
  saetTekst,
  tidstekst,
  tilfoej
} from './feltnoter';
import type { Feltnote } from './db';
import { lavTur } from './test/data';

const NU = new Date('2026-07-30T21:15:00');

const note = (id: string, tid: string, tekst = 'Noget'): Feltnote => ({ id, tid, tekst });

describe('tilfoej', () => {
  it('lægger en indgang til med et tidsstempel', () => {
    const noter = tilfoej([], 'Regn fra fire, tarp holdt', NU);

    expect(noter).toHaveLength(1);
    expect(noter[0].tekst).toBe('Regn fra fire, tarp holdt');
    expect(noter[0].tid).toBe(NU.toISOString());
  });

  // En tom linje i en dagbog er ikke en note, det er en fejlbetjening.
  it('lægger ikke tomme indgange til', () => {
    const noter: Feltnote[] = [];
    expect(tilfoej(noter, '', NU)).toBe(noter);
    expect(tilfoej(noter, '   ', NU)).toBe(noter);
  });

  it('klipper mellemrum af', () => {
    expect(tilfoej([], '  hej  ', NU)[0].tekst).toBe('hej');
  });

  it('giver hver indgang sit eget id', () => {
    expect(nyIndgang('a', NU).id).not.toBe(nyIndgang('b', NU).id);
  });
});

describe('saetTekst og fjern', () => {
  const noter = [note('n-1', '2026-07-29T20:00:00Z'), note('n-2', '2026-07-30T20:00:00Z')];

  // Retter man teksten, er det stadig den samme indgang fra den samme aften.
  it('retter teksten uden at røre tidsstemplet', () => {
    const rettet = saetTekst(noter, 'n-1', 'Rettet');

    expect(rettet[0].tekst).toBe('Rettet');
    expect(rettet[0].tid).toBe(noter[0].tid);
    expect(rettet[1].tekst).toBe('Noget');
  });

  it('fjerner én indgang', () => {
    expect(fjern(noter, 'n-1').map((n) => n.id)).toEqual(['n-2']);
  });
});

describe('nyesteFoerst', () => {
  it('vender rækkefølgen så det seneste står øverst', () => {
    const noter = [
      note('gammel', '2026-07-28T20:00:00Z'),
      note('ny', '2026-07-30T20:00:00Z'),
      note('mellem', '2026-07-29T20:00:00Z')
    ];

    expect(nyesteFoerst(noter).map((n) => n.id)).toEqual(['ny', 'mellem', 'gammel']);
  });

  it('rører ikke den liste den får ind', () => {
    const noter = [note('a', '2026-07-28T20:00:00Z'), note('b', '2026-07-30T20:00:00Z')];
    nyesteFoerst(noter);
    expect(noter.map((n) => n.id)).toEqual(['a', 'b']);
  });
});

describe('efterDag', () => {
  it('samler indgangene pr. dag, nyeste dag først', () => {
    const noter = [
      note('a', '2026-07-28T20:00:00Z'),
      note('b', '2026-07-30T09:00:00Z'),
      note('c', '2026-07-30T21:00:00Z')
    ];

    const dage = efterDag(noter);

    expect(dage.map((d) => d.dato)).toEqual(['2026-07-30', '2026-07-28']);
    expect(dage[0].indgange.map((n) => n.id)).toEqual(['c', 'b']);
  });

  it('klarer en tom log', () => {
    expect(efterDag([])).toEqual([]);
  });
});

describe('resumetekst', () => {
  it('siger til når der ikke er skrevet noget', () => {
    expect(resumetekst([], NU)).toBe('Ingen endnu');
  });

  it('tæller indgange og siger hvornår der sidst blev skrevet', () => {
    const noter = [note('a', '2026-07-29T20:00:00'), note('b', '2026-07-30T09:00:00')];
    expect(resumetekst(noter, NU)).toBe('2 indgange · senest i dag');
  });

  it('bøjer indgang i ental', () => {
    expect(resumetekst([note('a', '2026-07-30T09:00:00')], NU)).toBe('1 indgang · senest i dag');
  });
});

describe('hvornaar', () => {
  it('skriver i dag, i går og længere tilbage', () => {
    expect(hvornaar('2026-07-30T09:00:00', NU)).toBe('i dag');
    expect(hvornaar('2026-07-29T09:00:00', NU)).toBe('i går');
    expect(hvornaar('2026-07-26T09:00:00', NU)).toBe('for 4 dage siden');
  });

  it('siger ingenting når tiden ikke kan læses', () => {
    expect(hvornaar('', NU)).toBe('');
    expect(hvornaar('vrøvl', NU)).toBe('');
  });
});

describe('tidstekst', () => {
  it('skriver ugedag, dato og klokkeslæt', () => {
    expect(tidstekst('2026-07-30T21:15:00')).toBe('tor 30/7 kl. 21.15');
  });

  it('siger ingenting når tiden ikke kan læses', () => {
    expect(tidstekst('vrøvl')).toBe('');
  });
});

describe('harFeltnoter', () => {
  it('kender forskel på en tur med og uden log', () => {
    expect(harFeltnoter(lavTur())).toBe(false);
    expect(harFeltnoter(lavTur({ feltnoter: [note('a', NU.toISOString())] }))).toBe(true);
  });
});
