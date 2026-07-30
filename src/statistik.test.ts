import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  filtrererTure,
  samletInventarvaerdi,
  samletVaegt,
  antalItems,
  tureFordeltPrMaaned,
  mestBrugte,
  ubrugteItems,
  fordelingPrGruppe
} from './statistik';
import { lavItem, lavGruppe, lavTur } from './test/data';

// Statistikken regner relativt til "nu", så tiden holdes fast i testene.
const IDAG = new Date('2026-07-30T12:00:00Z');

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(IDAG);
});

afterEach(() => {
  vi.useRealTimers();
});

describe('samletInventarvaerdi og samletVaegt', () => {
  it('ganger med antal og tæller kun det man ejer', () => {
    const items = [
      lavItem({ pris_kr: 100, vaegt_g: 50, antal: 3, status: 'ejer' }),
      lavItem({ pris_kr: 500, vaegt_g: 900, antal: 1, status: 'overvejer' }),
      lavItem({ pris_kr: 200, vaegt_g: 100, antal: 1, status: 'solgt' })
    ];

    expect(samletInventarvaerdi(items)).toBe(300);
    expect(samletVaegt(items)).toBe(150);
    expect(antalItems(items)).toBe(1);
  });

  it('håndterer et tomt inventar', () => {
    expect(samletInventarvaerdi([])).toBe(0);
    expect(samletVaegt([])).toBe(0);
  });
});

describe('filtrererTure', () => {
  const iAar = lavTur({ startdato: '2026-03-01' });
  const sidsteAar = lavTur({ startdato: '2025-06-01' });
  const forlaengeSiden = lavTur({ startdato: '2019-06-01' });
  const udenDato = lavTur({ startdato: '' });
  const alle = [iAar, sidsteAar, forlaengeSiden, udenDato];

  it('vælger kun ture fra i år', () => {
    expect(filtrererTure(alle, 'i_aar')).toEqual([iAar]);
  });

  it('vælger kun ture fra sidste år', () => {
    expect(filtrererTure(alle, 'sidste_aar')).toEqual([sidsteAar]);
  });

  it('tager alt med — også ture uden dato', () => {
    expect(filtrererTure(alle, 'alt')).toHaveLength(4);
  });
});

describe('tureFordeltPrMaaned', () => {
  it('placerer ture i den rigtige måned', () => {
    const fordeling = tureFordeltPrMaaned([
      lavTur({ startdato: '2026-01-15' }),
      lavTur({ startdato: '2026-07-01' }),
      lavTur({ startdato: '2026-07-20' })
    ]);

    expect(fordeling).toHaveLength(12);
    expect(fordeling[0]).toBe(1);   // januar
    expect(fordeling[6]).toBe(2);   // juli
    expect(fordeling[11]).toBe(0);  // december
  });

  it('ignorerer ture uden startdato', () => {
    expect(tureFordeltPrMaaned([lavTur({ startdato: '' })]).every((n) => n === 0)).toBe(true);
  });
});

describe('mestBrugte', () => {
  it('tæller hvor mange ture hvert item har været på, og sorterer', () => {
    const gryde = lavItem({ id: 1, navn: 'Gryde' });
    const oekse = lavItem({ id: 2, navn: 'Økse' });
    const gruppe = lavGruppe({ id: 1, item_ids: [1] });

    const ture = [
      lavTur({ gruppe_ids: [1] }),                       // gryde
      lavTur({ gruppe_ids: [1], loese_item_ids: [2] }),   // gryde + økse
      lavTur({ gruppe_ids: [1] })                        // gryde
    ];

    const top = mestBrugte([gryde, oekse], ture, [gruppe]);

    expect(top.map((x) => [x.item.navn, x.antalTure])).toEqual([['Gryde', 3], ['Økse', 1]]);
  });

  it('udelader items der er slettet fra inventaret', () => {
    const ture = [lavTur({ loese_item_ids: [99] })];
    expect(mestBrugte([], ture, [])).toEqual([]);
  });

  it('respekterer topN', () => {
    const items = [1, 2, 3].map((id) => lavItem({ id, navn: `Item ${id}` }));
    const ture = [lavTur({ loese_item_ids: [1, 2, 3] })];

    expect(mestBrugte(items, ture, [], 2)).toHaveLength(2);
  });
});

describe('ubrugteItems', () => {
  it('finder items der ikke har været på tur det seneste år', () => {
    const brugt = lavItem({ id: 1, navn: 'Brugt', pris_kr: 100, vaegt_g: 500 });
    const ubrugt = lavItem({ id: 2, navn: 'Ubrugt', pris_kr: 700, vaegt_g: 900, antal: 2 });
    const ture = [lavTur({ startdato: '2026-05-01', loese_item_ids: [1] })];

    const resultat = ubrugteItems([brugt, ubrugt], ture, []);

    expect(resultat.antal).toBe(1);
    expect(resultat.items[0].navn).toBe('Ubrugt');
    expect(resultat.vaerdi).toBe(1400);  // 700 × 2
    expect(resultat.vaegt).toBe(1800);   // 900 × 2
  });

  it('regner et item som ubrugt hvis turen er mere end et år gammel', () => {
    const item = lavItem({ id: 1 });
    const gammelTur = lavTur({ startdato: '2024-01-01', loese_item_ids: [1] });

    expect(ubrugteItems([item], [gammelTur], []).antal).toBe(1);
  });

  it('medregner ikke items man ikke ejer', () => {
    const overvejer = lavItem({ id: 1, status: 'overvejer' });
    expect(ubrugteItems([overvejer], [], []).antal).toBe(0);
  });
});

describe('fordelingPrGruppe', () => {
  it('regner vægt og procent pr. gruppe, tungeste først', () => {
    const let_ = lavItem({ id: 1, vaegt_g: 250 });
    const tung = lavItem({ id: 2, vaegt_g: 750 });
    const grupper = [
      lavGruppe({ id: 1, navn: 'Let', item_ids: [1] }),
      lavGruppe({ id: 2, navn: 'Tung', item_ids: [2] })
    ];

    const fordeling = fordelingPrGruppe([let_, tung], grupper);

    expect(fordeling.map((g) => g.navn)).toEqual(['Tung', 'Let']);
    expect(fordeling[0].procent).toBe(75);
    expect(fordeling[1].procent).toBe(25);
  });

  it('udelader tomme grupper', () => {
    const item = lavItem({ id: 1, vaegt_g: 100 });
    const grupper = [
      lavGruppe({ id: 1, navn: 'Med', item_ids: [1] }),
      lavGruppe({ id: 2, navn: 'Tom', item_ids: [] })
    ];

    expect(fordelingPrGruppe([item], grupper).map((g) => g.navn)).toEqual(['Med']);
  });

  it('returnerer tom liste når der ikke er nogen vægt', () => {
    expect(fordelingPrGruppe([], [lavGruppe({ id: 1 })])).toEqual([]);
  });
});
