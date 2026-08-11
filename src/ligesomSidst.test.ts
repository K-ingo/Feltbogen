import { describe, it, expect } from 'vitest';
import { aarstid, antalNye, foreslaaKopi, kopierGrej } from './ligesomSidst';
import { lavGruppe, lavItem, lavTur } from './test/data';

describe('aarstid', () => {
  it('deler året i fire', () => {
    expect(aarstid('2026-01-15')).toBe('vinter');
    expect(aarstid('2026-12-15')).toBe('vinter');
    expect(aarstid('2026-04-15')).toBe('forår');
    expect(aarstid('2026-07-15')).toBe('sommer');
    expect(aarstid('2026-10-15')).toBe('efterår');
  });

  it('siger ukendt når datoen mangler eller er vrøvl', () => {
    expect(aarstid('')).toBe('ukendt');
    expect(aarstid('vrøvl')).toBe('ukendt');
  });
});

describe('foreslaaKopi', () => {
  const gammel = (felter = {}) =>
    lavTur({
      navn: 'Sommerlejr',
      overnatning: 'haengekoeje',
      terraen: 'skov',
      aktivitet: 'bushcraft',
      startdato: '2025-07-10',
      personer: 2,
      loese_item_ids: ['u-1'],
      ...felter
    });

  const ny = lavTur({
    uid: 'ny',
    overnatning: 'haengekoeje',
    terraen: 'skov',
    aktivitet: 'bushcraft',
    startdato: '2026-07-10',
    personer: 2,
    loese_item_ids: []
  });

  it('finder en tidligere tur der ligner', () => {
    const [f] = foreslaaKopi(ny, [gammel()], []);

    expect(f.tur.navn).toBe('Sommerlejr');
    expect(f.score).toBe(f.maks);
    expect(f.antalItems).toBe(1);
  });

  it('sætter den bedste match først', () => {
    const perfekt = gammel({ uid: 't-1', navn: 'Perfekt' });
    const halv = gammel({ uid: 't-2', navn: 'Halv', overnatning: 'telt', terraen: 'kyst' });

    expect(foreslaaKopi(ny, [halv, perfekt], []).map((f) => f.tur.navn)).toEqual(['Perfekt', 'Halv']);
  });

  // En tom tur er ikke en skabelon.
  it('foreslår ikke ture uden grej', () => {
    expect(foreslaaKopi(ny, [gammel({ loese_item_ids: [] })], [])).toEqual([]);
  });

  it('foreslår ikke turen selv', () => {
    const migSelv = { ...ny, loese_item_ids: ['u-1'] };
    expect(foreslaaKopi(migSelv, [migSelv], [])).toEqual([]);
  });

  it('tier når turene er for forskellige', () => {
    const anderledes = gammel({
      overnatning: 'telt',
      terraen: 'kyst',
      aktivitet: 'kano',
      startdato: '2025-01-10',
      personer: 1
    });

    expect(foreslaaKopi(ny, [anderledes], [])).toEqual([]);
  });

  // Overnatningen afgør det tungeste grej, så den vejer dobbelt: den alene er
  // nok til at turen er værd at kopiere fra, hvor terrænet alene ikke er.
  it('vægter overnatningen tungest', () => {
    const anderledes = {
      terraen: 'kyst' as const,
      aktivitet: 'kano' as const,
      startdato: '2025-01-10',
      personer: 1
    };

    const kunSeng = gammel({ uid: 't-1', navn: 'Kun seng', ...anderledes });
    const kunTerraen = gammel({
      uid: 't-2',
      navn: 'Kun terræn',
      ...anderledes,
      terraen: 'skov',
      overnatning: 'telt'
    });

    const liste = foreslaaKopi(ny, [kunSeng, kunTerraen], []);

    expect(liste.map((f) => f.tur.navn)).toEqual(['Kun seng']);
    expect(liste[0].score).toBe(2);
  });

  it('holder listen kort', () => {
    const mange = Array.from({ length: 7 }, (_, n) => gammel({ uid: `t-${n}` }));
    expect(foreslaaKopi(ny, mange, [])).toHaveLength(3);
  });

  it('tæller gear der kom med via en gruppe', () => {
    const gruppe = lavGruppe({ uid: 'g-1', item_ids: ['u-1', 'u-2'] });
    const medGruppe = gammel({ loese_item_ids: [], gruppe_ids: ['g-1'] });

    expect(foreslaaKopi(ny, [medGruppe], [gruppe])[0].antalItems).toBe(2);
  });

  it('forklarer hvad der blev sammenlignet, og hvad motoren ikke ved', () => {
    const [f] = foreslaaKopi(ny, [gammel()], []);

    expect(f.begrundelse).toContain('overnatning');
    expect(f.begrundelse).toContain('om turene føltes ens');
  });
});

describe('kopierGrej', () => {
  it('lægger grupper og løse items oven i det der allerede er valgt', () => {
    const fra = lavTur({ gruppe_ids: ['g-1'], loese_item_ids: ['u-1'] });
    const til = lavTur({ gruppe_ids: ['g-2'], loese_item_ids: ['u-2'] });

    expect(kopierGrej(fra, til)).toEqual({
      gruppe_ids: ['g-2', 'g-1'],
      loese_item_ids: ['u-2', 'u-1']
    });
  });

  it('lægger ikke det samme til to gange', () => {
    const fra = lavTur({ gruppe_ids: ['g-1'], loese_item_ids: ['u-1'] });
    const til = lavTur({ gruppe_ids: ['g-1'], loese_item_ids: ['u-1'] });

    expect(kopierGrej(fra, til)).toEqual({ gruppe_ids: ['g-1'], loese_item_ids: ['u-1'] });
  });
});

describe('antalNye', () => {
  const items = [lavItem({ uid: 'u-1' }), lavItem({ uid: 'u-2' })];

  it('tæller hvad der reelt kommer til', () => {
    const fra = lavTur({ loese_item_ids: ['u-1', 'u-2'] });
    const til = lavTur({ loese_item_ids: ['u-1'] });

    expect(antalNye(fra, til, [], items)).toBe(1);
  });

  it('giver nul når alt allerede er med', () => {
    const fra = lavTur({ loese_item_ids: ['u-1'] });
    const til = lavTur({ loese_item_ids: ['u-1'] });

    expect(antalNye(fra, til, [], items)).toBe(0);
  });

  // Gear der er slettet siden turen, skal ikke tælles med på en knap der
  // lover at tilføje det.
  it('tæller ikke gear der ikke findes i inventaret længere', () => {
    const fra = lavTur({ loese_item_ids: ['u-væk'] });
    expect(antalNye(fra, lavTur(), [], items)).toBe(0);
  });
});
