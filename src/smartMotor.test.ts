import { describe, it, expect } from 'vitest';
import {
  beregnForbrug,
  findAdvarsler,
  itemIdsPaaTur,
  itemsPaaTur,
  foreslaaGrupper,
  vejrIkonKode
} from './smartMotor';
import { lavItem, lavGruppe, lavTur } from './test/data';

describe('beregnForbrug', () => {
  it('regner vand, mad og gas ud pr. person pr. dag', () => {
    // 2 nætter = 3 dage, 2 personer, sommer → 3.5 L/person/dag
    const tur = lavTur({ naetter: 2, personer: 2, startdato: '2026-07-10' });
    expect(beregnForbrug(tur)).toEqual({
      vand_liter: 21,   // 2 × 3 × 3.5
      mad_kg: 3.6,      // 2 × 3 × 0.6
      gas_g: 150        // 2 × 3 × 25
    });
  });

  it('bruger den lavere vandsats uden for sommermånederne', () => {
    const sommer = beregnForbrug(lavTur({ naetter: 1, personer: 1, startdato: '2026-07-10' }));
    const vinter = beregnForbrug(lavTur({ naetter: 1, personer: 1, startdato: '2026-01-10' }));
    expect(sommer.vand_liter).toBe(7);   // 2 dage × 3.5
    expect(vinter.vand_liter).toBe(5);   // 2 dage × 2.5
  });

  it('regner en dagstur som mindst én dag', () => {
    const tur = lavTur({ naetter: 0, personer: 1, startdato: '2026-07-10' });
    expect(beregnForbrug(tur).vand_liter).toBe(3.5);
  });
});

describe('findAdvarsler', () => {
  it('giver rød advarsel når et krav ikke er dækket', () => {
    const braender = lavItem({ navn: 'MSR Pocket Rocket', kraever: ['skruegevind-gas'] });

    const advarsler = findAdvarsler([braender]);

    expect(advarsler).toHaveLength(1);
    expect(advarsler[0].niveau).toBe('roed');
    expect(advarsler[0].besked).toContain('skruegevind-gas');
  });

  it('er tilfreds når et andet item leverer kravet', () => {
    const braender = lavItem({ navn: 'MSR Pocket Rocket', kraever: ['skruegevind-gas'] });
    const gas = lavItem({ navn: 'Gasdåse', tags: ['skruegevind-gas'] });

    expect(findAdvarsler([braender, gas])).toEqual([]);
  });

  it('giver gul advarsel for et manglende komplement', () => {
    const haengekoeje = lavItem({ navn: 'TTTM', komplementer: ['regnbeskyttelse'] });

    const advarsler = findAdvarsler([haengekoeje]);

    expect(advarsler).toHaveLength(1);
    expect(advarsler[0].niveau).toBe('gul');
  });

  it('finder ingen advarsler i en tom pakkeliste', () => {
    expect(findAdvarsler([])).toEqual([]);
  });
});

describe('itemIdsPaaTur', () => {
  it('samler items fra både grupper og løse valg', () => {
    const gruppe = lavGruppe({ id: 1, item_ids: [10, 11] });
    const tur = lavTur({ gruppe_ids: [1], loese_item_ids: [12] });

    expect([...itemIdsPaaTur(tur, [gruppe])].sort()).toEqual([10, 11, 12]);
  });

  it('tæller et item én gang selvom det både er løst og i en gruppe', () => {
    const gruppe = lavGruppe({ id: 1, item_ids: [10] });
    const tur = lavTur({ gruppe_ids: [1], loese_item_ids: [10] });

    expect([...itemIdsPaaTur(tur, [gruppe])]).toEqual([10]);
  });

  it('ignorerer grupper der ikke findes længere', () => {
    const tur = lavTur({ gruppe_ids: [99], loese_item_ids: [10] });
    expect([...itemIdsPaaTur(tur, [])]).toEqual([10]);
  });

  it('itemsPaaTur slår id\'erne op i inventaret', () => {
    const gryde = lavItem({ id: 10, navn: 'Toaks 1L' });
    const oekse = lavItem({ id: 11, navn: 'Fiskars X7' });
    const tur = lavTur({ loese_item_ids: [10] });

    expect(itemsPaaTur(tur, [], [gryde, oekse]).map((i) => i.navn)).toEqual(['Toaks 1L']);
  });
});

describe('foreslaaGrupper', () => {
  it('foreslår grupper hvis tags matcher turen, bedste match først', () => {
    const traeffer2 = lavGruppe({ id: 1, navn: 'Hængekøje-skov', tags: ['haengekoeje', 'skov'] });
    const traeffer1 = lavGruppe({ id: 2, navn: 'Kun skov', tags: ['skov'] });
    const traeffer0 = lavGruppe({ id: 3, navn: 'Vinter', tags: ['vinter'] });
    const tur = lavTur({ overnatning: 'haengekoeje', terraen: 'skov' });

    const forslag = foreslaaGrupper(tur, [traeffer1, traeffer0, traeffer2]);

    expect(forslag.map((g) => g.navn)).toEqual(['Hængekøje-skov', 'Kun skov']);
  });

  it('foreslår ikke grupper der allerede er valgt', () => {
    const gruppe = lavGruppe({ id: 1, tags: ['skov'] });
    const tur = lavTur({ terraen: 'skov', gruppe_ids: [1] });

    expect(foreslaaGrupper(tur, [gruppe])).toEqual([]);
  });

  it('matcher solo mod gruppe alt efter antal personer', () => {
    const solo = lavGruppe({ id: 1, navn: 'Solo', tags: ['solo'] });
    const flere = lavGruppe({ id: 2, navn: 'Gruppe', tags: ['gruppe'] });

    expect(foreslaaGrupper(lavTur({ personer: 1 }), [solo, flere]).map((g) => g.navn)).toEqual(['Solo']);
    expect(foreslaaGrupper(lavTur({ personer: 4 }), [solo, flere]).map((g) => g.navn)).toEqual(['Gruppe']);
  });
});

describe('vejrIkonKode', () => {
  it('oversætter WMO-koder til ikoner', () => {
    expect(vejrIkonKode(0)).toBe('☀');   // klar himmel
    expect(vejrIkonKode(3)).toBe('⛅');   // let skyet
    expect(vejrIkonKode(61)).toBe('🌧');  // regn
    expect(vejrIkonKode(71)).toBe('❄');   // sne
    expect(vejrIkonKode(95)).toBe('⛈');  // tordenvejr
  });
});
