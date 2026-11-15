import { describe, it, expect } from 'vitest';
import {
  gyldigtLagersted, lagerstedFor, lagerstedNavn, lagerstedTekst, iLagersted, lagerstedValg
} from './lagersted';
import type { Item } from './db';
import { lavItem } from './test/data';

describe('gyldigtLagersted', () => {
  it('kender de tre steder', () => {
    expect(gyldigtLagersted('hjem')).toBe('hjem');
    expect(gyldigtLagersted('hytte')).toBe('hytte');
    expect(gyldigtLagersted('bil')).toBe('bil');
  });

  it('gør alt andet til ikke sat', () => {
    // Tom streng er sådan PocketBase sender et tomt tekstfelt.
    for (const v of ['', 'Hytte', 'kælder', null, undefined, 3, {}]) {
      expect(gyldigtLagersted(v)).toBeNull();
    }
  });

  it('tåler grej fra før feltet fandtes', () => {
    const gammelt = { ...lavItem() } as Partial<Item>;
    delete gammelt.lagersted;
    expect(lagerstedFor(gammelt as Item)).toBeNull();
    expect(lagerstedTekst(gammelt as Item)).toBe('');
  });
});

describe('navne', () => {
  it('skriver stederne ud med stort', () => {
    expect(lagerstedNavn('hjem')).toBe('Hjem');
    expect(lagerstedNavn('ikke_sat')).toBe('Ikke sat');
    expect(lagerstedTekst(lavItem({ lagersted: 'bil' }))).toBe('Bil');
  });
});

describe('iLagersted', () => {
  const hjem = lavItem({ navn: 'Gryde', lagersted: 'hjem' });
  const hytte = lavItem({ navn: 'Økse', lagersted: 'hytte' });
  const intet = lavItem({ navn: 'Snor', lagersted: null });
  const alle = [hjem, hytte, intet];

  it('lader alt stå med Alle', () => {
    expect(iLagersted(alle, 'alle')).toEqual(alle);
  });

  it('viser kun grejet på det valgte sted', () => {
    expect(iLagersted(alle, 'hytte')).toEqual([hytte]);
    expect(iLagersted(alle, 'bil')).toEqual([]);
  });

  it('finder grejet uden sted under Ikke sat', () => {
    expect(iLagersted(alle, 'ikke_sat')).toEqual([intet]);
  });
});

describe('lagerstedValg', () => {
  it('viser intet filter, når intet grej har et sted', () => {
    expect(lagerstedValg([lavItem(), lavItem()])).toEqual([]);
  });

  it('viser kun de brugte steder, i fast rækkefølge', () => {
    expect(lagerstedValg([lavItem({ lagersted: 'bil' }), lavItem({ lagersted: 'hjem' })])).toEqual(['hjem', 'bil']);
  });

  it('tager Ikke sat med til sidst, når noget mangler et sted', () => {
    expect(lagerstedValg([lavItem({ lagersted: 'hytte' }), lavItem()])).toEqual(['hytte', 'ikke_sat']);
  });
});

// Lagersted og tursted er to begreber. Et lagersted er ikke et gemt sted, og
// et gemt sted med navnet "Hytten" giver ikke grejet et lagersted.
describe('lagersted er ikke et tursted', () => {
  it('kender ikke stedernes navne', () => {
    expect(gyldigtLagersted('Hytten')).toBeNull();
  });
});
