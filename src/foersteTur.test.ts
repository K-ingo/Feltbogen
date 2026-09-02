import { describe, it, expect } from 'vitest';
import {
  TOM_KLADDE,
  TRIN,
  TRINTEKST,
  naesteTrin,
  forrigeTrin,
  erBesvaret,
  erPaabegyndt,
  nokTilForslag,
  slutdatoFor,
  genveje,
  navnForslag,
  antalPersoner,
  turFraKladde,
  laesKladde
} from './foersteTurLogik';
import type { Kladde } from './foersteTurLogik';

const NU = new Date('2026-09-14T09:00:00');

const kladde = (felter: Partial<Kladde> = {}): Kladde => ({ ...TOM_KLADDE, ...felter });

describe('trinnene', () => {
  it('går frem og tilbage uden at falde ud i begge ender', () => {
    expect(naesteTrin('hvor')).toBe('hvornaar');
    expect(forrigeTrin('hvornaar')).toBe('hvor');
    expect(forrigeTrin('hvor')).toBe('hvor');
    expect(naesteTrin('forslag')).toBe('forslag');
  });

  it('har et spørgsmål og en begrundelse til hvert trin', () => {
    for (const trin of TRIN) {
      expect(TRINTEKST[trin].spoergsmaal).not.toBe('');
      expect(TRINTEKST[trin].hvorfor).not.toBe('');
    }
  });

  it('regner ingen af trinnene som besvaret på en tom kladde', () => {
    for (const trin of TRIN) {
      expect(erBesvaret(trin, TOM_KLADDE)).toBe(false);
    }
  });

  it('regner et trin som besvaret når der står noget', () => {
    expect(erBesvaret('hvor', kladde({ sted: 'Rold Skov' }))).toBe(true);
    expect(erBesvaret('hvornaar', kladde({ startdato: '2026-09-20' }))).toBe(true);
    expect(erBesvaret('hvad', kladde({ overnatning: 'telt' }))).toBe(true);
    expect(erBesvaret('hvem', kladde({ medrejsende: ['Mikkel'] }))).toBe(true);
  });

  it('regner flere personer som svar på hvem, også uden navne', () => {
    expect(erBesvaret('hvem', kladde({ personer: 3 }))).toBe(true);
    expect(erBesvaret('hvem', kladde({ personer: 1 }))).toBe(false);
  });

  it('er ikke påbegyndt før man har svaret på noget', () => {
    expect(erPaabegyndt(TOM_KLADDE)).toBe(false);
    expect(erPaabegyndt(kladde({ sted: 'Mols' }))).toBe(true);
  });

  it('kræver noget motoren kan bruge før den lover forslag', () => {
    expect(nokTilForslag(kladde({ sted: 'Mols' }))).toBe(false);
    expect(nokTilForslag(kladde({ aktivitet: 'kano' }))).toBe(true);
    expect(nokTilForslag(kladde({ startdato: '2026-09-20' }))).toBe(true);
  });
});

describe('slutdatoFor', () => {
  it('lægger nætterne til startdatoen', () => {
    expect(slutdatoFor('2026-09-14', 2)).toBe('2026-09-16');
  });

  it('giver samme dag ved nul nætter', () => {
    expect(slutdatoFor('2026-09-14', 0)).toBe('2026-09-14');
  });

  it('går over et månedsskifte', () => {
    expect(slutdatoFor('2026-09-29', 3)).toBe('2026-10-02');
  });

  it('svarer tomt når der ikke er nogen startdato', () => {
    expect(slutdatoFor('', 2)).toBe('');
    expect(slutdatoFor('ikke en dato', 2)).toBe('');
  });
});

describe('genveje', () => {
  it('tilbyder i dag og de to kommende weekender', () => {
    // En onsdag.
    expect(genveje(new Date('2026-09-16T10:00:00'))).toEqual([
      { navn: 'I dag', dato: '2026-09-16' },
      { navn: 'Denne weekend', dato: '2026-09-18' },
      { navn: 'Næste weekend', dato: '2026-09-25' }
    ]);
  });

  it('gentager ikke dagen om fredagen', () => {
    const fredag = genveje(new Date('2026-09-18T10:00:00'));
    expect(fredag.map((g) => g.navn)).toEqual(['I dag', 'Næste weekend']);
    expect(fredag[0].dato).toBe('2026-09-18');
    expect(fredag[1].dato).toBe('2026-09-25');
  });
});

describe('navnForslag', () => {
  it('sætter stedet sammen med måneden', () => {
    expect(navnForslag(kladde({ sted: 'Rold Skov', startdato: '2026-09-14' }))).toBe('Rold Skov i september');
  });

  it('nøjes med stedet når datoen mangler', () => {
    expect(navnForslag(kladde({ sted: 'Rold Skov' }))).toBe('Rold Skov');
  });

  it('gætter ikke et navn når stedet mangler', () => {
    expect(navnForslag(kladde({ startdato: '2026-09-14' }))).toBe('');
  });
});

describe('antalPersoner', () => {
  it('bruger tallet man har sagt', () => {
    expect(antalPersoner(kladde({ personer: 4 }))).toBe(4);
  });

  it('lader navnene rette tallet op når der er flere af dem', () => {
    expect(antalPersoner(kladde({ personer: 2, medrejsende: ['A', 'B', 'C'] }))).toBe(4);
  });

  it('er aldrig under en', () => {
    expect(antalPersoner(kladde({ personer: 0 }))).toBe(1);
  });
});

describe('turFraKladde', () => {
  it('laver en almindelig kladde-tur af svarene', () => {
    const tur = turFraKladde(kladde({
      sted: 'Mols Bjerge',
      startdato: '2026-09-20',
      naetter: 2,
      aktivitet: 'vandretur',
      overnatning: 'telt',
      personer: 2
    }), NU);

    expect(tur.navn).toBe('Mols Bjerge i september');
    expect(tur.sted).toBe('Mols Bjerge');
    expect(tur.slutdato).toBe('2026-09-22');
    expect(tur.aktivitet).toBe('vandretur');
    expect(tur.overnatning).toBe('telt');
    expect(tur.personer).toBe(2);
    expect(tur.status).toBe('kladde');
  });

  it('falder tilbage på de samme standarder som en tom tur', () => {
    const tur = turFraKladde(TOM_KLADDE, NU);
    expect(tur.overnatning).toBe('shelter');
    expect(tur.aktivitet).toBe('bushcraft');
    expect(tur.terraen).toBe('skov');
    expect(tur.erfaring).toBe('oevet');
    expect(tur.startdato).toBe('2026-09-14');
  });

  it('sætter ejeren på deltagerlisten og de navngivne med', () => {
    const tur = turFraKladde(kladde({ medrejsende: ['Mikkel', '  ', 'Sofie'] }), NU);
    expect(tur.deltagere).toHaveLength(3);
    expect(tur.deltagere.slice(1).map((d) => d.navn)).toEqual(['Mikkel', 'Sofie']);
  });

  it('tager grejet med fra kladden', () => {
    const tur = turFraKladde(kladde({ gruppe_ids: ['g1'], loese_item_ids: ['i1', 'i2'] }), NU);
    expect(tur.gruppe_ids).toEqual(['g1']);
    expect(tur.loese_item_ids).toEqual(['i1', 'i2']);
  });

  it('deler ikke lister med kladden', () => {
    const k = kladde({ gruppe_ids: ['g1'] });
    const tur = turFraKladde(k, NU);
    tur.gruppe_ids.push('g2');
    expect(k.gruppe_ids).toEqual(['g1']);
  });
});

describe('laesKladde', () => {
  it('læser det den selv har skrevet', () => {
    const k = kladde({ sted: 'Rold Skov', naetter: 3, aktivitet: 'kano', medrejsende: ['Mikkel'] });
    expect(laesKladde(JSON.stringify(k))).toEqual(k);
  });

  it('svarer null på ingenting og på ulæselig tekst', () => {
    expect(laesKladde(null)).toBeNull();
    expect(laesKladde('')).toBeNull();
    expect(laesKladde('{ikke json')).toBeNull();
    expect(laesKladde('"en streng"')).toBeNull();
  });

  it('svarer null på en kladde uden et eneste svar', () => {
    expect(laesKladde(JSON.stringify(TOM_KLADDE))).toBeNull();
  });

  it('kasserer felter med forkert form frem for at gå i stykker', () => {
    const laest = laesKladde(JSON.stringify({
      sted: 'Mols',
      naetter: 'to',
      aktivitet: 'faldskærmsudspring',
      personer: -4,
      medrejsende: ['Mikkel', 7, null],
      gruppe_ids: 'g1'
    }));

    expect(laest).toEqual({
      ...TOM_KLADDE,
      sted: 'Mols',
      medrejsende: ['Mikkel']
    });
  });
});
