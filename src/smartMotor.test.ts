import { describe, it, expect } from 'vitest';
import {
  beregnForbrug,
  findAdvarsler,
  itemUidsPaaTur,
  itemsPaaTur,
  foreslaaGrupper,
  advarslerPrItem,
  pakkelisteEfterGruppe,
  pakkelisteEfterTag,
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

describe('itemUidsPaaTur', () => {
  it('samler items fra både grupper og løse valg', () => {
    const gruppe = lavGruppe({ uid: 'g1', item_ids: ['i10', 'i11'] });
    const tur = lavTur({ gruppe_ids: ['g1'], loese_item_ids: ['i12'] });

    expect([...itemUidsPaaTur(tur, [gruppe])].sort()).toEqual(['i10', 'i11', 'i12']);
  });

  it('tæller et item én gang selvom det både er løst og i en gruppe', () => {
    const gruppe = lavGruppe({ uid: 'g1', item_ids: ['i10'] });
    const tur = lavTur({ gruppe_ids: ['g1'], loese_item_ids: ['i10'] });

    expect([...itemUidsPaaTur(tur, [gruppe])]).toEqual(['i10']);
  });

  it('ignorerer grupper der ikke findes længere', () => {
    const tur = lavTur({ gruppe_ids: ['findes-ikke'], loese_item_ids: ['i10'] });
    expect([...itemUidsPaaTur(tur, [])]).toEqual(['i10']);
  });

  it('itemsPaaTur slår referencerne op i inventaret', () => {
    const gryde = lavItem({ uid: 'i10', navn: 'Toaks 1L' });
    const oekse = lavItem({ uid: 'i11', navn: 'Fiskars X7' });
    const tur = lavTur({ loese_item_ids: ['i10'] });

    expect(itemsPaaTur(tur, [], [gryde, oekse]).map((i) => i.navn)).toEqual(['Toaks 1L']);
  });

  // Kernen i hvorfor referencer er uid og ikke Dexies ++id: to enheder tæller
  // deres lokale id'er op hver for sig.
  it('rammer det rigtige item selvom lokale id\'er er forskellige', () => {
    const oekse = lavItem({ id: 7, uid: 'i-oekse', navn: 'Fiskars X7 økse' });
    const gryde = lavItem({ id: 1, uid: 'i-gryde', navn: 'Toaks 1L gryde' });
    const gruppe = lavGruppe({ uid: 'g1', item_ids: ['i-oekse'] });
    const tur = lavTur({ gruppe_ids: ['g1'] });

    expect(itemsPaaTur(tur, [gruppe], [gryde, oekse]).map((i) => i.navn)).toEqual(['Fiskars X7 økse']);
  });
});

describe('foreslaaGrupper', () => {
  it('foreslår grupper hvis tags matcher turen, bedste match først', () => {
    const traeffer2 = lavGruppe({ navn: 'Hængekøje-skov', tags: ['haengekoeje', 'skov'] });
    const traeffer1 = lavGruppe({ navn: 'Kun skov', tags: ['skov'] });
    const traeffer0 = lavGruppe({ navn: 'Vinter', tags: ['vinter'] });
    const tur = lavTur({ overnatning: 'haengekoeje', terraen: 'skov' });

    const forslag = foreslaaGrupper(tur, [traeffer1, traeffer0, traeffer2]);

    expect(forslag.map((g) => g.navn)).toEqual(['Hængekøje-skov', 'Kun skov']);
  });

  it('foreslår ikke grupper der allerede er valgt', () => {
    const gruppe = lavGruppe({ uid: 'g1', tags: ['skov'] });
    const tur = lavTur({ terraen: 'skov', gruppe_ids: ['g1'] });

    expect(foreslaaGrupper(tur, [gruppe])).toEqual([]);
  });

  it('matcher solo mod gruppe alt efter antal personer', () => {
    const solo = lavGruppe({ navn: 'Solo', tags: ['solo'] });
    const flere = lavGruppe({ navn: 'Gruppe', tags: ['gruppe'] });

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

describe('advarslerPrItem', () => {
  it('slår advarslerne op på det item de hænger på', () => {
    const braender = lavItem({ uid: 'u-braender', navn: 'MSR', kraever: ['gas'], komplementer: ['tændstål'] });
    const gryde = lavItem({ uid: 'u-gryde', navn: 'Toaks' });

    const pr = advarslerPrItem(findAdvarsler([braender, gryde]));

    expect(pr.get('u-braender')?.map((a) => a.mangler)).toEqual(['gas', 'tændstål']);
    expect(pr.get('u-gryde')).toBeUndefined();
  });
});

describe('pakkelisteEfterGruppe', () => {
  const tarp = lavItem({ uid: 'u-tarp', navn: 'Tarp', vaegt_g: 720 });
  const koeje = lavItem({ uid: 'u-koeje', navn: 'Hængekøje', vaegt_g: 900 });
  const kniv = lavItem({ uid: 'u-kniv', navn: 'Opinel', vaegt_g: 40 });

  it('laver et afsnit pr. valgt gruppe, tungeste item først', () => {
    const gruppe = lavGruppe({ uid: 'g1', navn: 'Hængekøje-setup', item_ids: ['u-tarp', 'u-koeje'] });
    const tur = lavTur({ gruppe_ids: ['g1'] });

    const afsnit = pakkelisteEfterGruppe(tur, [gruppe], [tarp, koeje]);

    expect(afsnit).toHaveLength(1);
    expect(afsnit[0].titel).toBe('Hængekøje-setup');
    expect(afsnit[0].items.map((i) => i.navn)).toEqual(['Hængekøje', 'Tarp']);
  });

  it('samler alt uden for grupperne under "Løse items"', () => {
    const gruppe = lavGruppe({ uid: 'g1', navn: 'Setup', item_ids: ['u-tarp'] });
    const tur = lavTur({ gruppe_ids: ['g1'], loese_item_ids: ['u-kniv'] });

    const afsnit = pakkelisteEfterGruppe(tur, [gruppe], [tarp, kniv]);

    expect(afsnit.map((a) => a.titel)).toEqual(['Setup', 'Løse items']);
    expect(afsnit[1].items.map((i) => i.navn)).toEqual(['Opinel']);
  });

  it('viser et item én gang, selvom to valgte grupper indeholder det', () => {
    const a = lavGruppe({ uid: 'g1', navn: 'A', item_ids: ['u-tarp'] });
    const b = lavGruppe({ uid: 'g2', navn: 'B', item_ids: ['u-tarp'] });
    const tur = lavTur({ gruppe_ids: ['g1', 'g2'] });

    const afsnit = pakkelisteEfterGruppe(tur, [a, b], [tarp]);

    expect(afsnit.map((s) => s.titel)).toEqual(['A']);
  });

  it('springer tomme grupper over', () => {
    const tom = lavGruppe({ uid: 'g1', navn: 'Tom', item_ids: [] });
    const tur = lavTur({ gruppe_ids: ['g1'] });

    expect(pakkelisteEfterGruppe(tur, [tom], [])).toEqual([]);
  });
});

describe('pakkelisteEfterTag', () => {
  it('sorterer afsnittene alfabetisk på dansk', () => {
    const items = [
      lavItem({ uid: 'u1', navn: 'Økse', tags: ['økse'] }),
      lavItem({ uid: 'u2', navn: 'Sovepose', tags: ['søvn'] }),
      lavItem({ uid: 'u3', navn: 'Bål', tags: ['bål'] })
    ];

    // Æ, Ø og Å står sidst i det danske alfabet.
    expect(pakkelisteEfterTag(items).map((a) => a.titel)).toEqual(['bål', 'søvn', 'økse']);
  });

  it('viser et item under hvert af sine tags', () => {
    const dyne = lavItem({ uid: 'u1', navn: 'Moonquilt', tags: ['søvn', 'vinter'] });

    const afsnit = pakkelisteEfterTag([dyne]);

    expect(afsnit.map((a) => a.titel)).toEqual(['søvn', 'vinter']);
    expect(afsnit.every((a) => a.items[0].navn === 'Moonquilt')).toBe(true);
  });

  it('lægger items uden tags til sidst', () => {
    const items = [
      lavItem({ uid: 'u1', navn: 'Uden', tags: [] }),
      lavItem({ uid: 'u2', navn: 'Med', tags: ['bål'] })
    ];

    expect(pakkelisteEfterTag(items).map((a) => a.titel)).toEqual(['bål', 'Uden tag']);
  });
});
