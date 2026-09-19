import { describe, it, expect } from 'vitest';
import {
  turKanOprettes, grejKanOprettes, naetterMellem, deltagernavne, tal,
  turFraArk, grejFraArk, tommeTurfelter, tommeGrejfelter
} from './opretark';

// ─────────────────────────────────────────────
// Opret-arkene
//
// Reglen fra det låste designsystem: der oprettes ingenting, før man trykker
// Opret, og den primære knap er slået fra, indtil navnet er gyldigt. Det
// første er arkets ansvar; det andet er `turKanOprettes` og `grejKanOprettes`.
// ─────────────────────────────────────────────

describe('hvornår der kan oprettes', () => {
  it('kræver en titel på turen', () => {
    expect(turKanOprettes(tommeTurfelter('2026-09-19'))).toBe(false);
    expect(turKanOprettes({ ...tommeTurfelter('2026-09-19'), titel: 'Fovslet' })).toBe(true);
  });

  it('lader sig ikke narre af mellemrum', () => {
    expect(turKanOprettes({ ...tommeTurfelter('2026-09-19'), titel: '   ' })).toBe(false);
    expect(grejKanOprettes({ ...tommeGrejfelter(), navn: '  ' })).toBe(false);
  });

  it('kræver kun navnet på grejet — resten må være tomt', () => {
    expect(grejKanOprettes({ navn: 'Telt', status: 'ejer', vaegt: '', pris: '', antal: '' })).toBe(true);
  });

  it('kræver ikke sted eller datoer på turen', () => {
    // En tur uden sted er en tur, man ikke har besluttet sig om endnu. Den
    // skal man kunne skrive ned.
    expect(turKanOprettes({ titel: 'Noget til efteråret', fra: '', til: '', sted: '', deltagere: '' })).toBe(true);
  });
});

describe('nætter mellem to datoer', () => {
  it('regner tre dage som to nætter', () => {
    expect(naetterMellem('2026-08-27', '2026-08-29')).toBe(2);
  });

  it('giver 0 på en endagstur', () => {
    expect(naetterMellem('2026-08-27', '2026-08-27')).toBe(0);
  });

  it('giver 0 frem for et negativt tal, når datoerne er byttet om', () => {
    expect(naetterMellem('2026-08-29', '2026-08-27')).toBe(0);
  });

  it('giver 0 på tomme og ugyldige datoer', () => {
    expect(naetterMellem('', '')).toBe(0);
    expect(naetterMellem('2026-08-27', '')).toBe(0);
    expect(naetterMellem('ikke en dato', '2026-08-29')).toBe(0);
  });

  it('tæller hen over et månedsskifte', () => {
    expect(naetterMellem('2026-08-30', '2026-09-02')).toBe(3);
  });
});

describe('deltagernavne', () => {
  it('deler på komma og trimmer', () => {
    expect(deltagernavne('Emil, Zindy')).toEqual(['Emil', 'Zindy']);
  });

  it('springer et komma for meget over', () => {
    expect(deltagernavne('Emil, , Zindy')).toEqual(['Emil', 'Zindy']);
    expect(deltagernavne(',')).toEqual([]);
  });

  it('giver en tom liste på tom tekst', () => {
    expect(deltagernavne('')).toEqual([]);
    expect(deltagernavne('   ')).toEqual([]);
  });
});

describe('tal skrevet i hånden', () => {
  it('læser almindelige tal', () => {
    expect(tal('2000')).toBe(2000);
  });

  it('tager komma som decimaltegn', () => {
    // Man skriver 1,5 på dansk.
    expect(tal('1,5')).toBe(1.5);
  });

  it('giver standardværdien på et tomt felt', () => {
    expect(tal('')).toBe(0);
    expect(tal('', 1)).toBe(1);
  });

  it('giver standardværdien på vrøvl og negative tal', () => {
    expect(tal('abc', 1)).toBe(1);
    expect(tal('-5')).toBe(0);
  });
});

describe('turen der bliver til', () => {
  const felter = {
    titel: '  Fovslet Skov  ',
    fra: '2026-08-27',
    til: '2026-08-29',
    sted: '  Fovslet  ',
    deltagere: 'Zindy, Noor'
  };

  it('trimmer titel og sted', () => {
    const tur = turFraArk(felter, 'Emil');
    expect(tur.navn).toBe('Fovslet Skov');
    expect(tur.sted).toBe('Fovslet');
  });

  it('udleder nætterne af datoerne', () => {
    expect(turFraArk(felter, 'Emil').naetter).toBe(2);
  });

  it('sætter opretteren først på deltagerlisten', () => {
    const tur = turFraArk(felter, 'Emil');
    expect(tur.deltagere?.map((d) => d.navn)).toEqual(['Emil', 'Zindy', 'Noor']);
  });

  it('tæller opretteren med i personantallet', () => {
    expect(turFraArk(felter, 'Emil').personer).toBe(3);
  });

  it('er én person, når ingen andre er skrevet på', () => {
    const tur = turFraArk({ ...felter, deltagere: '' }, 'Emil');
    expect(tur.personer).toBe(1);
    expect(tur.deltagere?.map((d) => d.navn)).toEqual(['Emil']);
  });

  it('giver hver deltager sit eget id', () => {
    const ider = turFraArk(felter, 'Emil').deltagere?.map((d) => d.id) ?? [];
    expect(new Set(ider).size).toBe(ider.length);
  });
});

describe('grejet der bliver til', () => {
  it('læser vægt, pris og antal', () => {
    const item = grejFraArk({ navn: 'Telt', status: 'ejer', vaegt: '2000', pris: '3499', antal: '2' });
    expect(item).toMatchObject({ navn: 'Telt', status: 'ejer', vaegt_g: 2000, pris_kr: 3499, antal: 2 });
  });

  it('runder vægten til hele gram', () => {
    expect(grejFraArk({ navn: 'Snor', status: 'ejer', vaegt: '12,4', pris: '', antal: '' }).vaegt_g).toBe(12);
  });

  it('er aldrig mindre end ét stykke', () => {
    // Sletter man tallet i antalsfeltet, mente man ikke 0 stk.
    expect(grejFraArk({ navn: 'Telt', status: 'ejer', vaegt: '', pris: '', antal: '' }).antal).toBe(1);
    expect(grejFraArk({ navn: 'Telt', status: 'ejer', vaegt: '', pris: '', antal: '0' }).antal).toBe(1);
  });

  it('bærer statussen med over', () => {
    expect(grejFraArk({ ...tommeGrejfelter('overvejer'), navn: 'Økse' }).status).toBe('overvejer');
  });
});
