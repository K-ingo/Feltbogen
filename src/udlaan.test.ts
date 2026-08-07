import { describe, it, expect } from 'vitest';
import {
  dageSiden,
  dageUdlaant,
  erLaant,
  erOverskredet,
  erUdlaant,
  laengde,
  laanteItems,
  udlaanPrLaaner,
  udlaansAdvarsler,
  udlaanteItems
} from './udlaan';
import { lavItem } from './test/data';

const NU = new Date('2026-07-30T12:00:00');

const udlaant = (navn: string, felter: Partial<{ udlaant_dato: string; forventet_retur: string; person_uid: string }> = {}) =>
  lavItem({
    navn: 'Moonquilt',
    udlaan: {
      person_uid: '',
      navn,
      udlaant_dato: '2026-07-01',
      forventet_retur: '',
      noter: '',
      ...felter
    }
  });

describe('erUdlaant og erLaant', () => {
  it('kender forskel på ude af huset og hjemme', () => {
    expect(erUdlaant(udlaant('Mikkel'))).toBe(true);
    expect(erUdlaant(lavItem())).toBe(false);
  });

  it('holder de to retninger adskilt', () => {
    const laant = lavItem({
      laant_af: { person_uid: '', navn: 'Maja', laant_dato: '2026-07-01', skal_retur: '' }
    });

    expect(erLaant(laant)).toBe(true);
    expect(erUdlaant(laant)).toBe(false);
    expect(laanteItems([laant, udlaant('Mikkel')])).toHaveLength(1);
    expect(udlaanteItems([laant, udlaant('Mikkel')])).toHaveLength(1);
  });
});

describe('dageSiden', () => {
  it('tæller dage frem til i dag', () => {
    expect(dageSiden('2026-07-01', NU)).toBe(29);
    expect(dageSiden('2026-07-30', NU)).toBe(0);
  });

  it('giver null når datoen mangler eller ikke kan læses', () => {
    expect(dageSiden(undefined, NU)).toBeNull();
    expect(dageSiden('', NU)).toBeNull();
    expect(dageSiden('ikke en dato', NU)).toBeNull();
  });

  it('dageUdlaant læser datoen af itemet', () => {
    expect(dageUdlaant(udlaant('Mikkel'), NU)).toBe(29);
    expect(dageUdlaant(lavItem(), NU)).toBeNull();
  });
});

describe('erOverskredet', () => {
  it('er sandt når den aftalte dato er passeret', () => {
    expect(erOverskredet('2026-07-29', NU)).toBe(true);
  });

  it('er falsk på selve dagen og frem', () => {
    expect(erOverskredet('2026-07-30', NU)).toBe(false);
    expect(erOverskredet('2026-08-15', NU)).toBe(false);
  });

  // Uden en aftalt dato er der ikke noget at overskride.
  it('er falsk når der ingen dato er', () => {
    expect(erOverskredet(undefined, NU)).toBe(false);
    expect(erOverskredet('', NU)).toBe(false);
  });
});

describe('laengde', () => {
  it('måler korte lån i dage', () => {
    expect(laengde(1)).toBe('1 dag');
    expect(laengde(9)).toBe('9 dage');
  });

  // Når det er blevet uger man tænker i, skal det stå i uger.
  it('måler lange lån i uger', () => {
    expect(laengde(14)).toBe('2 uger');
    expect(laengde(42)).toBe('6 uger');
  });
});

describe('udlaansAdvarsler', () => {
  it('advarer om gear på pakkelisten der ikke er hjemme', () => {
    const [a] = udlaansAdvarsler([udlaant('Mikkel'), lavItem({ navn: 'Kop' })]);

    expect(a.niveau).toBe('gul');
    expect(a.besked).toContain('Mikkel');
    expect(a.mangler).toBe('udlånt');
  });

  // Det kan sagtens være aftalt at låneren tager det med.
  it('forklarer hvorfor advarslen er gul og ikke rød', () => {
    const [a] = udlaansAdvarsler([udlaant('Mikkel')]);

    expect(a.begrundelse).toContain('Gul og ikke rød');
    expect(a.begrundelse).toContain('tager det med');
  });

  it('hænger advarslen på det item den handler om', () => {
    const item = udlaant('Mikkel');
    expect(udlaansAdvarsler([item])[0].itemUid).toBe(item.uid);
  });

  it('siger ingenting om gear der står hjemme', () => {
    expect(udlaansAdvarsler([lavItem()])).toEqual([]);
  });

  it('klarer et udlån uden navn', () => {
    const [a] = udlaansAdvarsler([udlaant('   ')]);
    expect(a.besked).toContain('en anden');
  });
});

describe('udlaanPrLaaner', () => {
  it('samler alt der er hos den samme person', () => {
    const en = udlaant('Mikkel', { person_uid: 'p-1' });
    const to = udlaant('Mikkel', { person_uid: 'p-1' });
    const anden = udlaant('Maja', { person_uid: 'p-2' });

    const pr = udlaanPrLaaner([en, to, anden]);

    expect(pr.get('p-1')).toHaveLength(2);
    expect(pr.get('p-2')).toHaveLength(1);
  });

  // Uden kobling er navnet det eneste vi har at gå efter.
  it('grupperer på navnet når der ikke er en person', () => {
    const pr = udlaanPrLaaner([udlaant('Mikkel'), udlaant('  mikkel ')]);
    expect(pr.get('mikkel')).toHaveLength(2);
  });
});
