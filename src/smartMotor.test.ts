import { describe, it, expect } from 'vitest';
import {
  beregnForbrug,
  saesonfaktor,
  findAdvarsler,
  itemUidsPaaTur,
  itemsPaaTur,
  foreslaaGrupper,
  turensTags,
  advarslerPrItem,
  pakkelisteEfterGruppe,
  pakkelisteEfterTag,
  pakkelisteEfterPerson,
  baererAf,
  overnatningsAdvarsler,
  vaegtPrDeltager,
  linjeAfItem,
  linjeAfMedbragt,
  linjerEfterPerson,
  medDeltagernes,
  samletVaegt,
  DELTAGERNES,
  tildelGear,
  IKKE_FORDELT,
  vejrIkonKode,
  linjerSamlet,
  linjerEfterDeling,
  filtrerAfsnit,
  ALT_PAA_TUREN,
  FAELLES,
  PERSONLIGT
} from './smartMotor';
import type { Beregninger } from './smartMotor';
import { lavItem, lavGruppe, lavTur } from './test/data';

// Tallene uden begrundelserne. Begrundelsen ændrer sig med vilje når man
// oplyser noget, selv når det ikke rykker ved resultatet.
const kunTal = ({ vand_liter, mad_kg, gas_g }: Beregninger) => ({ vand_liter, mad_kg, gas_g });

describe('saesonfaktor', () => {
  it('er 0 i dybvinter og 1 i højsommer', () => {
    expect(saesonfaktor('2026-01-15')).toBeCloseTo(0, 3);
    expect(saesonfaktor('2026-07-16')).toBeCloseTo(1, 3);
  });

  // Det var hele pointen med at lave om på det: før sprang satsen 40 % mellem
  // 31. marts og 1. april, fordi grænsen gik mellem to måneder.
  it('springer ikke mellem to nabodage', () => {
    const marts = saesonfaktor('2026-03-31');
    const april = saesonfaktor('2026-04-01');

    expect(Math.abs(april - marts)).toBeLessThan(0.01);
  });

  it('holder sig mellem 0 og 1 hele året rundt', () => {
    for (let maaned = 1; maaned <= 12; maaned++) {
      const f = saesonfaktor(`2026-${String(maaned).padStart(2, '0')}-15`);
      expect(f).toBeGreaterThanOrEqual(0);
      expect(f).toBeLessThanOrEqual(1);
    }
  });

  // Uden en dato kan årstiden ikke gættes. Højsommer er det sikre valg: det
  // giver det største vandbehov, og for meget vand er en tungere sæk, mens
  // for lidt er et problem.
  it('regner med højsommer når datoen mangler eller er vrøvl', () => {
    expect(saesonfaktor('')).toBe(1);
    expect(saesonfaktor('ikke en dato')).toBe(1);
  });
});

describe('beregnForbrug', () => {
  it('regner vand, mad og gas ud pr. person pr. dag', () => {
    // 2 nætter = 3 dage, 2 personer, 10. juli er praktisk talt højsommer.
    const tur = lavTur({ naetter: 2, personer: 2, startdato: '2026-07-10' });
    const b = beregnForbrug(tur);

    expect(b.vand_liter).toBe(22.8);  // 2 × 3 × ~3,8 L
    expect(b.mad_kg).toBe(3.3);       // 2 × 3 × ~0,55 kg
    expect(b.gas_g).toBe(150);        // 2 × 3 × 25 g
  });

  it('bruger den lavere vandsats om vinteren', () => {
    const sommer = beregnForbrug(lavTur({ naetter: 1, personer: 1, startdato: '2026-07-10' }));
    const vinter = beregnForbrug(lavTur({ naetter: 1, personer: 1, startdato: '2026-01-10' }));

    expect(sommer.vand_liter).toBe(7.6);
    expect(vinter.vand_liter).toBe(5);
  });

  // Maden går den modsatte vej af vandet: kulden brænder mere af.
  it('regner med mere mad om vinteren end om sommeren', () => {
    const sommer = beregnForbrug(lavTur({ naetter: 1, personer: 1, startdato: '2026-07-10' }));
    const vinter = beregnForbrug(lavTur({ naetter: 1, personer: 1, startdato: '2026-01-10' }));

    expect(vinter.mad_kg).toBeGreaterThan(sommer.mad_kg);
  });

  it('regner en dagstur som mindst én dag', () => {
    const tur = lavTur({ naetter: 0, personer: 1, startdato: '2026-07-10' });
    expect(beregnForbrug(tur).vand_liter).toBe(3.8);
  });

  it('håndterer 0 eller ugyldigt deltagerantal skånsomt ved at falde tilbage til 1', () => {
    const tur = lavTur({ naetter: 1, personer: 0, startdato: '2026-07-10' });
    const b = beregnForbrug(tur);
    expect(b.vand_liter).toBeGreaterThan(0);
    expect(b.mad_kg).toBeGreaterThan(0);
    expect(b.gas_g).toBeGreaterThan(0);
  });

  it('giver endelige tal ved ødelagte importerede antal og nætter', () => {
    const tur = lavTur({ naetter: Number.NaN, personer: Number.NaN, startdato: '2026-07-10' });
    const b = beregnForbrug(tur);

    expect(b.vand_liter).toBe(3.8);
    expect(b.mad_kg).toBe(0.6);
    expect(b.gas_g).toBe(25);
  });

  describe('kropsdata', () => {
    const tur = lavTur({ naetter: 1, personer: 1, startdato: '2026-07-10' });
    const uden = beregnForbrug(tur);

    it('lader tallene stå som før når intet er oplyst', () => {
      expect(beregnForbrug(tur, {})).toEqual(uden);
    });

    it('skalerer vand og mad med kropsvægten', () => {
      const tung = beregnForbrug(tur, { kropsvaegt_kg: 95 });
      const let_ = beregnForbrug(tur, { kropsvaegt_kg: 60 });

      expect(tung.vand_liter).toBeGreaterThan(uden.vand_liter);
      expect(let_.vand_liter).toBeLessThan(uden.vand_liter);
      expect(tung.mad_kg).toBeGreaterThan(let_.mad_kg);
    });

    // Referencekroppen er 75 kg — den skal give præcis de samme tal som
    // ingenting. Begrundelsen må gerne skrive at vægten er sat.
    it('rører ikke tallene for en person på referencevægten', () => {
      expect(kunTal(beregnForbrug(tur, { kropsvaegt_kg: 75 }))).toEqual(kunTal(uden));
    });

    // En tastefejl må ikke kunne fordoble pakkelisten.
    it('holder vægtfaktoren inden for rimelighedens grænser', () => {
      const vanvid = beregnForbrug(tur, { kropsvaegt_kg: 400 });
      const loft = beregnForbrug(tur, { kropsvaegt_kg: 105 });

      expect(vanvid.vand_liter).toBe(loft.vand_liter);
    });

    it('skalerer med aktivitetsniveauet', () => {
      const hoej = beregnForbrug(tur, { aktivitetsniveau: 'hoej' });
      const lav = beregnForbrug(tur, { aktivitetsniveau: 'lav' });

      expect(hoej.vand_liter).toBeGreaterThan(uden.vand_liter);
      expect(lav.vand_liter).toBeLessThan(uden.vand_liter);
      expect(kunTal(beregnForbrug(tur, { aktivitetsniveau: 'middel' }))).toEqual(kunTal(uden));
    });

    // Har man selv svaret på spørgsmålet, skal motoren ikke gætte oveni.
    it('lader et oplyst kaloriebehov afgøre maden alene', () => {
      const medKalorier = { daglig_kalorie: 3000, kropsvaegt_kg: 95, aktivitetsniveau: 'hoej' as const };
      const kunKalorier = beregnForbrug(tur, { daglig_kalorie: 3000 });

      // 3000 kcal / 5000 kcal pr. kg = 0,6 kg pr. dag, 2 dage.
      expect(beregnForbrug(tur, medKalorier).mad_kg).toBe(1.2);
      expect(kunKalorier.mad_kg).toBe(1.2);
    });

    it('lader vandet blive skaleret selvom kalorierne er oplyst', () => {
      const a = beregnForbrug(tur, { daglig_kalorie: 3000, kropsvaegt_kg: 95 });
      expect(a.vand_liter).toBeGreaterThan(uden.vand_liter);
    });

    it('ser bort fra et kaloriebehov på nul', () => {
      expect(beregnForbrug(tur, { daglig_kalorie: 0 })).toEqual(uden);
    });
  });

  describe('begrundelser', () => {
    it('siger hvad tallet er ganget sammen af', () => {
      const b = beregnForbrug(lavTur({ naetter: 2, personer: 2, startdato: '2026-07-10' }));

      expect(b.begrundelser.vand).toContain('2 personer × 3 dage');
      expect(b.begrundelser.gas).toContain('25 g pr. dag');
    });

    it('siger til når der ikke er kropsdata at regne med', () => {
      const b = beregnForbrug(lavTur({ startdato: '2026-07-10' }));
      expect(b.begrundelser.vand).toContain('Ingen kropsdata');
    });

    it('nævner de kropsdata der faktisk er sat', () => {
      const b = beregnForbrug(lavTur({ startdato: '2026-07-10' }), {
        kropsvaegt_kg: 95,
        aktivitetsniveau: 'hoej'
      });

      expect(b.begrundelser.vand).toContain('95 kg');
      expect(b.begrundelser.vand).toContain('højt aktivitetsniveau');
    });

    it('forklarer maden ud fra kalorier når de er oplyst', () => {
      const b = beregnForbrug(lavTur({ startdato: '2026-07-10' }), { daglig_kalorie: 3000 });
      expect(b.begrundelser.mad).toContain('3000 kcal');
    });
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

// Motoren ved allerede hvorfor den siger som den gør — begrundelsen er dét,
// skrevet ud. Se fundamentets §15 om rådgiver frem for automat.
describe('begrundelser på advarsler', () => {
  it('forklarer en rød advarsel med reglen bag den', () => {
    const braender = lavItem({ navn: 'MSR Pocket Rocket', kraever: ['skruegevind-gas'] });

    const [a] = findAdvarsler([braender]);

    expect(a.begrundelse).toContain('kræver');
    expect(a.begrundelse).toContain('skruegevind-gas');
    expect(a.begrundelse).toContain('hård afhængighed');
  });

  it('forklarer hvorfor et komplement kun er gult', () => {
    const kop = lavItem({ navn: 'Toaks 1L', komplementer: ['låg'] });

    const [a] = findAdvarsler([kop]);

    expect(a.begrundelse).toContain('blødt forslag');
    expect(a.begrundelse).toContain('kan bruges uden');
  });

  it('tæller det gennemgåede med, så man kan se hvad der blev kigget på', () => {
    const braender = lavItem({ navn: 'MSR', kraever: ['gas'], tags: ['koekken', 'braender'] });
    const kop = lavItem({ navn: 'Kop', tags: ['koekken'] });

    const [a] = findAdvarsler([braender, kop]);

    // To stykker gear, tre forskellige tags mellem dem.
    expect(a.begrundelse).toContain('2 stykker gear');
    expect(a.begrundelse).toContain('2 forskellige tags');
  });

  it('forklarer en manglende soveløsning med hvad der blev søgt efter', () => {
    const tur = lavTur({
      deltagere: [{ id: 'd1', navn: 'Emil', overnatning: 'telt', personligt_gear_ids: [], baerer_delt_ids: [], person_uid: '' }]
    });

    const [a] = overnatningsAdvarsler(tur, [lavItem({ navn: 'Kop' })]);

    expect(a.begrundelse).toContain('telt');
    expect(a.begrundelse).toContain('både på navn og på tags');
  });
});

describe('begrundelser på gruppeforslag', () => {
  it('siger hvad turen er markeret som, og hvad gruppen ramte', () => {
    const gruppe = lavGruppe({ navn: 'Hængekøje-skov', tags: ['haengekoeje', 'skov'] });
    const tur = lavTur({ overnatning: 'haengekoeje', terraen: 'skov', personer: 1 });

    const [f] = foreslaaGrupper(tur, [gruppe]);

    expect(f.traf).toEqual(['haengekoeje', 'skov']);
    // Værdien hedder haengekoeje i basen, men skal skrives ud på dansk.
    expect(f.begrundelse).toContain('hængekøje');
    expect(f.begrundelse).toContain('2 af sine 2 tags');
  });

  it('nævner kun de tags der ramte, ikke gruppens øvrige', () => {
    const gruppe = lavGruppe({ navn: 'Blandet', tags: ['skov', 'vinter', 'fisketur'] });
    const tur = lavTur({ terraen: 'skov' });

    const [f] = foreslaaGrupper(tur, [gruppe]);

    expect(f.begrundelse).toContain('1 af sine 3 tags');
    expect(f.begrundelse).not.toContain('vinter');
  });
});

describe('turensTags', () => {
  it('samler turens kendetegn som de tags grupperne måles mod', () => {
    const tur = lavTur({ overnatning: 'telt', aktivitet: 'kano', terraen: 'kyst', personer: 3 });

    expect([...turensTags(tur)].sort()).toEqual(['gruppe', 'kano', 'kyst', 'telt']);
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

    expect(forslag.map((f) => f.gruppe.navn)).toEqual(['Hængekøje-skov', 'Kun skov']);
    expect(forslag.map((f) => f.score)).toEqual([2, 1]);
  });

  it('foreslår ikke grupper der allerede er valgt', () => {
    const gruppe = lavGruppe({ uid: 'g1', tags: ['skov'] });
    const tur = lavTur({ terraen: 'skov', gruppe_ids: ['g1'] });

    expect(foreslaaGrupper(tur, [gruppe])).toEqual([]);
  });

  it('matcher solo mod gruppe alt efter antal personer', () => {
    const solo = lavGruppe({ navn: 'Solo', tags: ['solo'] });
    const flere = lavGruppe({ navn: 'Gruppe', tags: ['gruppe'] });

    expect(foreslaaGrupper(lavTur({ personer: 1 }), [solo, flere]).map((f) => f.gruppe.navn)).toEqual(['Solo']);
    expect(foreslaaGrupper(lavTur({ personer: 4 }), [solo, flere]).map((f) => f.gruppe.navn)).toEqual(['Gruppe']);
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

describe('hvem bærer hvad', () => {
  const telt = lavItem({ uid: 'u-telt', navn: 'Telt', vaegt_g: 2400, delt: true });
  const sovepose = lavItem({ uid: 'u-sovepose', navn: 'Sovepose', vaegt_g: 800 });
  const kniv = lavItem({ uid: 'u-kniv', navn: 'Kniv', vaegt_g: 40 });

  const deltager = (id: string, navn: string, felter = {}) => ({
    id, navn, overnatning: null, personligt_gear_ids: [], baerer_delt_ids: [], person_uid: '', ...felter
  });

  const turMed = (deltagere: ReturnType<typeof deltager>[]) => lavTur({ deltagere });

  describe('baererAf', () => {
    it('samler begge slags gear i ét opslag', () => {
      const tur = turMed([
        deltager('d1', 'Emil', { baerer_delt_ids: ['u-telt'], personligt_gear_ids: ['u-sovepose'] })
      ]);

      const baerer = baererAf(tur);
      expect(baerer.get('u-telt')).toBe('d1');
      expect(baerer.get('u-sovepose')).toBe('d1');
      expect(baerer.has('u-kniv')).toBe(false);
    });
  });

  describe('pakkelisteEfterPerson', () => {
    it('laver et afsnit pr. deltager, tungeste først', () => {
      const tur = turMed([
        deltager('d1', 'Emil', { baerer_delt_ids: ['u-telt'], personligt_gear_ids: ['u-kniv'] }),
        deltager('d2', 'Mikkel', { personligt_gear_ids: ['u-sovepose'] })
      ]);

      const afsnit = pakkelisteEfterPerson(tur, [telt, sovepose, kniv]);

      expect(afsnit.map((a) => a.titel)).toEqual(['Emil', 'Mikkel']);
      expect(afsnit[0].items.map((i) => i.navn)).toEqual(['Telt', 'Kniv']);
      expect(afsnit[1].items.map((i) => i.navn)).toEqual(['Sovepose']);
    });

    it('lægger resten i en bunke til sidst', () => {
      const tur = turMed([deltager('d1', 'Emil', { baerer_delt_ids: ['u-telt'] })]);

      const afsnit = pakkelisteEfterPerson(tur, [telt, sovepose, kniv]);

      expect(afsnit.map((a) => a.titel)).toEqual(['Emil', IKKE_FORDELT]);
      expect(afsnit[1].items.map((i) => i.navn)).toEqual(['Sovepose', 'Kniv']);
    });

    it('springer deltagere over der ikke bærer noget', () => {
      const tur = turMed([
        deltager('d1', 'Emil', { baerer_delt_ids: ['u-telt'] }),
        deltager('d2', 'Tomhændet')
      ]);

      expect(pakkelisteEfterPerson(tur, [telt]).map((a) => a.titel)).toEqual(['Emil']);
    });

    it('ignorerer tildelt gear der ikke er på turen længere', () => {
      const tur = turMed([deltager('d1', 'Emil', { personligt_gear_ids: ['u-fjernet'] })]);
      expect(pakkelisteEfterPerson(tur, [kniv]).map((a) => a.titel)).toEqual([IKKE_FORDELT]);
    });

    it('giver en tom liste uden gear', () => {
      expect(pakkelisteEfterPerson(turMed([deltager('d1', 'Emil')]), [])).toEqual([]);
    });
  });

  describe('vaegtPrDeltager', () => {
    it('tæller det den enkelte faktisk slæber', () => {
      const tur = turMed([
        deltager('d1', 'Emil', { baerer_delt_ids: ['u-telt'], personligt_gear_ids: ['u-kniv'] }),
        deltager('d2', 'Mikkel', { personligt_gear_ids: ['u-sovepose'] })
      ]);

      expect(vaegtPrDeltager(tur, [telt, sovepose, kniv])).toEqual([
        { id: 'd1', navn: 'Emil', vaegt_g: 2440, antal: 2 },
        { id: 'd2', navn: 'Mikkel', vaegt_g: 800, antal: 1 }
      ]);
    });

    it('tager en deltager uden gear med som nul', () => {
      const tur = turMed([deltager('d1', 'Emil')]);
      expect(vaegtPrDeltager(tur, [telt])[0]).toEqual({ id: 'd1', navn: 'Emil', vaegt_g: 0, antal: 0 });
    });
  });

  describe('tildelGear', () => {
    it('lægger delt gear i baerer_delt_ids', () => {
      const efter = tildelGear([deltager('d1', 'Emil')], 'd1', telt);
      expect(efter[0].baerer_delt_ids).toEqual(['u-telt']);
      expect(efter[0].personligt_gear_ids).toEqual([]);
    });

    it('lægger personligt gear i personligt_gear_ids', () => {
      const efter = tildelGear([deltager('d1', 'Emil')], 'd1', sovepose);
      expect(efter[0].personligt_gear_ids).toEqual(['u-sovepose']);
      expect(efter[0].baerer_delt_ids).toEqual([]);
    });

    it('slår fra igen når man trykker på den samme', () => {
      const efter = tildelGear([deltager('d1', 'Emil', { baerer_delt_ids: ['u-telt'] })], 'd1', telt);
      expect(efter[0].baerer_delt_ids).toEqual([]);
    });

    // Ellers ville vægten tælle det samme stykke gear med to gange.
    it('flytter gearet væk fra den der havde det', () => {
      const foer = [
        deltager('d1', 'Emil', { baerer_delt_ids: ['u-telt'] }),
        deltager('d2', 'Mikkel')
      ];

      const efter = tildelGear(foer, 'd2', telt);

      expect(efter[0].baerer_delt_ids).toEqual([]);
      expect(efter[1].baerer_delt_ids).toEqual(['u-telt']);
    });

    // Skifter man "delt" på itemet bagefter, ligger uid'et i den forkerte
    // liste — det skal ikke blive liggende som en skygge.
    it('rydder op i den anden liste når gearet skifter slags', () => {
      const foer = [deltager('d1', 'Emil', { personligt_gear_ids: ['u-telt'] })];

      const efter = tildelGear(foer, 'd1', telt);

      expect(efter[0].personligt_gear_ids).toEqual([]);
      expect(efter[0].baerer_delt_ids).toEqual(['u-telt']);
    });

    it('rører ikke andet gear deltageren har', () => {
      const foer = [deltager('d1', 'Emil', { personligt_gear_ids: ['u-kniv', 'u-sovepose'] })];
      expect(tildelGear(foer, 'd1', telt)[0].personligt_gear_ids).toEqual(['u-kniv', 'u-sovepose']);
    });

    it('rører ikke listen den får ind', () => {
      const foer = [deltager('d1', 'Emil')];
      tildelGear(foer, 'd1', telt);
      expect(foer[0].baerer_delt_ids).toEqual([]);
    });
  });
});

describe('overnatningsAdvarsler', () => {
  const sover = (navn: string, overnatning: 'telt' | 'haengekoeje' | 'shelter' | 'blandet' | null) => ({
    id: navn, navn, overnatning, personligt_gear_ids: [], baerer_delt_ids: [], person_uid: ''
  });

  it('siger til når en deltager ikke har noget at sove i', () => {
    const tur = lavTur({ deltagere: [sover('Mikkel', 'telt')] });

    const advarsler = overnatningsAdvarsler(tur, [lavItem({ tags: ['søvn'] })]);

    expect(advarsler).toHaveLength(1);
    expect(advarsler[0].niveau).toBe('roed');
    expect(advarsler[0].besked).toBe('Mikkel sover i telt');
    expect(advarsler[0].mangler).toBe('telt');
    // Advarslen skal sige hvad man gør ved den — gearet kan sagtens være med
    // og bare mangle tagget.
    expect(advarsler[0].detalje).toContain('Sæt tagget');
  });

  it('tier når gearet er med', () => {
    const tur = lavTur({ deltagere: [sover('Mikkel', 'telt')] });
    expect(overnatningsAdvarsler(tur, [lavItem({ navn: 'Telt', tags: ['telt'] })])).toEqual([]);
  });

  // Fejlen brugeren løb ind i: formen hedder "haengekoeje" i basen, men
  // beskeden bad om tagget "hængekøje". Satte man det tag beskeden nævnte,
  // blev advarslen stående.
  it('accepterer tagget skrevet med æ og ø', () => {
    const tur = lavTur({ deltagere: [sover('Mikkel', 'haengekoeje')] });

    expect(overnatningsAdvarsler(tur, [lavItem({ navn: 'TTTM', tags: ['hængekøje'] })])).toEqual([]);
    expect(overnatningsAdvarsler(tur, [lavItem({ navn: 'TTTM', tags: ['haengekoeje'] })])).toEqual([]);
  });

  it('er ligeglad med store og små bogstaver', () => {
    const tur = lavTur({ deltagere: [sover('Mikkel', 'haengekoeje')] });
    expect(overnatningsAdvarsler(tur, [lavItem({ tags: ['Hængekøje'] })])).toEqual([]);
  });

  // Et item der hedder "TTTM Hængekøje" er åbenlyst en hængekøje, også uden
  // at nogen har tagget det.
  it('tæller også navnet og ikke kun tagget', () => {
    const tur = lavTur({ deltagere: [sover('Mikkel', 'haengekoeje')] });

    expect(overnatningsAdvarsler(tur, [lavItem({ navn: 'TTTM Hængekøje', tags: [] })])).toEqual([]);
    expect(overnatningsAdvarsler(tur, [lavItem({ navn: 'Hangekoje uden tegn', tags: [] })])).toEqual([]);
  });

  it('lader sig ikke narre af et helt andet stykke gear', () => {
    const tur = lavTur({ deltagere: [sover('Mikkel', 'haengekoeje')] });
    expect(overnatningsAdvarsler(tur, [lavItem({ navn: 'Sovepose', tags: ['søvn'] })])).toHaveLength(1);
  });

  it('samler flere der sover ens i én advarsel', () => {
    const tur = lavTur({ deltagere: [sover('Mikkel', 'telt'), sover('Sofie', 'telt')] });

    const advarsler = overnatningsAdvarsler(tur, []);

    expect(advarsler).toHaveLength(1);
    expect(advarsler[0].besked).toBe('Mikkel og Sofie sover i telt');
  });

  it('holder de forskellige former hver for sig', () => {
    const tur = lavTur({ deltagere: [sover('Mikkel', 'telt'), sover('Sofie', 'haengekoeje')] });

    expect(overnatningsAdvarsler(tur, []).map((a) => a.mangler).sort()).toEqual(['hængekøje', 'telt']);
  });

  // Et shelter står i skoven, og "blandet" er ikke et krav om noget bestemt.
  it('advarer ikke om shelter eller blandet', () => {
    const tur = lavTur({ deltagere: [sover('Mikkel', 'shelter'), sover('Sofie', 'blandet')] });
    expect(overnatningsAdvarsler(tur, [])).toEqual([]);
  });

  // Ellers ville enhver eksisterende tur uden de rigtige tags få en advarsel
  // den ikke har fortjent.
  it('advarer kun når nogen selv har valgt en form', () => {
    const tur = lavTur({ overnatning: 'telt', deltagere: [sover('Mikkel', null)] });
    expect(overnatningsAdvarsler(tur, [])).toEqual([]);
  });

  it('siger noget fornuftigt om en deltager uden navn', () => {
    const tur = lavTur({ deltagere: [sover('', 'telt')] });
    expect(overnatningsAdvarsler(tur, [])[0].besked).toBe('En deltager sover i telt');
  });

  it('giver ingen advarsler uden deltagere', () => {
    expect(overnatningsAdvarsler(lavTur(), [])).toEqual([]);
  });

  // De hænger på turen som helhed, ikke på en række i pakkelisten.
  it('havner ikke i opslaget pr. item', () => {
    const tur = lavTur({ deltagere: [sover('Mikkel', 'telt')] });
    expect(advarslerPrItem(overnatningsAdvarsler(tur, [])).size).toBe(0);
  });
});

describe('den fælles pakkeliste', () => {
  const linje = (navn: string, vaegt: number, baerer = '', egen = true) =>
    ({ uid: egen ? `u-${navn}` : '', navn, vaegt_g: vaegt, delt: false, baerer, egen });

  describe('linjeAfItem', () => {
    it('tager navn, vægt og om det deles med', () => {
      const l = linjeAfItem(lavItem({ uid: 'u-telt', navn: 'Telt', vaegt_g: 2400, delt: true }), 'Emil');
      expect(l).toEqual({ uid: 'u-telt', navn: 'Telt', vaegt_g: 2400, delt: true, baerer: 'Emil', egen: true });
    });

    it('er turens eget gear', () => {
      expect(linjeAfItem(lavItem({ navn: 'Telt' })).egen).toBe(true);
    });
  });

  describe('linjeAfMedbragt', () => {
    // En deltagers grej ligger i hendes inventar og ikke i ejerens. Uden uid
    // kan hverken advarsler eller fordeling hænge på det — og det er meningen.
    it('har intet uid, fordi det ikke findes i ejerens base', () => {
      expect(linjeAfMedbragt('Dunjakke', 450, 'Sofie').uid).toBe('');
    });

    it('bærer navnet på den der tager det med', () => {
      expect(linjeAfMedbragt('Dunjakke', 450, 'Sofie'))
        .toEqual({ uid: '', navn: 'Dunjakke', vaegt_g: 450, delt: false, baerer: 'Sofie', egen: false });
    });
  });

  describe('linjerEfterPerson', () => {
    it('samler hver persons ting under hendes navn', () => {
      const afsnit = linjerEfterPerson([
        linje('Telt', 2400, 'Emil'),
        linje('Dunjakke', 450, 'Sofie', false),
        linje('Kniv', 40, 'Emil')
      ]);

      expect(afsnit.map((a) => a.titel)).toEqual(['Emil', 'Sofie']);
      expect(afsnit[0].linjer.map((l) => l.navn)).toEqual(['Telt', 'Kniv']);
    });

    it('lægger det tungeste øverst hos hver person', () => {
      const afsnit = linjerEfterPerson([linje('Kniv', 40, 'Emil'), linje('Telt', 2400, 'Emil')]);
      expect(afsnit[0].linjer.map((l) => l.navn)).toEqual(['Telt', 'Kniv']);
    });

    // Den ufordelte bunke er den der mangler en beslutning, så den står til
    // sidst og ikke blandet ind mellem personerne.
    it('sætter det ufordelte til sidst', () => {
      const afsnit = linjerEfterPerson([linje('Gryde', 155), linje('Telt', 2400, 'Emil')]);
      expect(afsnit.map((a) => a.titel)).toEqual(['Emil', IKKE_FORDELT]);
    });

    it('blander ikke ejerens og deltagernes ting sammen på tværs af navne', () => {
      const afsnit = linjerEfterPerson([
        linje('Telt', 2400, 'Emil'),
        linje('Dunjakke', 450, 'Sofie', false)
      ]);
      expect(afsnit.find((a) => a.titel === 'Sofie')?.linjer).toHaveLength(1);
    });

    it('giver ingen afsnit uden linjer', () => {
      expect(linjerEfterPerson([])).toEqual([]);
    });
  });

  describe('medDeltagernes', () => {
    // Deltagernes grej hører ikke til i nogen af ejerens grupper eller tags.
    // Uden sit eget afsnit ville det falde ud af listen i de to opdelinger.
    it('lægger deltagernes grej til sidst i sit eget afsnit', () => {
      const egne = [{ titel: 'Sovegrej', linjer: [linje('Telt', 2400)] }];
      const afsnit = medDeltagernes(egne, [linje('Telt', 2400), linje('Dunjakke', 450, 'Sofie', false)]);

      expect(afsnit.map((a) => a.titel)).toEqual(['Sovegrej', DELTAGERNES]);
      expect(afsnit[1].linjer.map((l) => l.navn)).toEqual(['Dunjakke']);
    });

    it('lader listen være når ingen har meldt noget ind', () => {
      const egne = [{ titel: 'Sovegrej', linjer: [linje('Telt', 2400)] }];
      expect(medDeltagernes(egne, [linje('Telt', 2400)])).toEqual(egne);
    });

    it('tager ikke ejerens eget gear med i deltagerafsnittet', () => {
      const afsnit = medDeltagernes([], [linje('Telt', 2400), linje('Dunjakke', 450, 'Sofie', false)]);
      expect(afsnit[0].linjer.map((l) => l.navn)).toEqual(['Dunjakke']);
    });
  });

  describe('samletVaegt', () => {
    it('lægger linjerne sammen', () => {
      expect(samletVaegt([linje('Telt', 2400), linje('Kniv', 40)])).toBe(2440);
    });

    it('er nul uden linjer', () => {
      expect(samletVaegt([])).toBe(0);
    });
  });
});

// ─────────────────────────────────────────────
// Pakkelistens øvrige opdelinger og søgningen (specens §8)
// ─────────────────────────────────────────────

describe('linjerSamlet', () => {
  it('lægger alt i ét afsnit, tungest først', () => {
    const afsnit = linjerSamlet([
      linjeAfItem(lavItem({ navn: 'Kniv', vaegt_g: 200 })),
      linjeAfItem(lavItem({ navn: 'Telt', vaegt_g: 2400 }))
    ]);

    expect(afsnit).toHaveLength(1);
    expect(afsnit[0].titel).toBe(ALT_PAA_TUREN);
    expect(afsnit[0].linjer.map((l) => l.navn)).toEqual(['Telt', 'Kniv']);
  });

  it('giver ingen afsnit når der ikke er noget på turen', () => {
    expect(linjerSamlet([])).toEqual([]);
  });
});

describe('linjerEfterDeling', () => {
  it('deler i fælles, personligt og deltagernes eget', () => {
    const afsnit = linjerEfterDeling([
      linjeAfItem(lavItem({ navn: 'Sovepose', vaegt_g: 1100, delt: false })),
      linjeAfItem(lavItem({ navn: 'Telt', vaegt_g: 2400, delt: true })),
      linjeAfMedbragt('Annas dunjakke', 500, 'Anna')
    ]);

    expect(afsnit.map((a) => a.titel)).toEqual([FAELLES, PERSONLIGT, DELTAGERNES]);
    expect(afsnit[0].linjer.map((l) => l.navn)).toEqual(['Telt']);
    expect(afsnit[1].linjer.map((l) => l.navn)).toEqual(['Sovepose']);
    expect(afsnit[2].linjer.map((l) => l.navn)).toEqual(['Annas dunjakke']);
  });

  it('udelader et afsnit der ville være tomt', () => {
    const kun = linjerEfterDeling([linjeAfItem(lavItem({ navn: 'Telt', delt: true }))]);
    expect(kun.map((a) => a.titel)).toEqual([FAELLES]);
  });
});

describe('filtrerAfsnit', () => {
  const afsnit = [
    {
      titel: 'Køkken',
      linjer: [
        linjeAfItem(lavItem({ navn: 'Trangia' }), 'Emil'),
        linjeAfItem(lavItem({ navn: 'Skål' }), 'Anna')
      ]
    },
    { titel: 'Løse items', linjer: [linjeAfItem(lavItem({ navn: 'Sovepose' }), 'Emil')] }
  ];

  it('giver alt tilbage uden en søgning', () => {
    expect(filtrerAfsnit(afsnit, '   ')).toEqual(afsnit);
  });

  it('finder på navn og skjuler afsnit uden træffere', () => {
    const fundet = filtrerAfsnit(afsnit, 'sove');

    expect(fundet).toHaveLength(1);
    expect(fundet[0].titel).toBe('Løse items');
  });

  it('finder på den der bærer det', () => {
    const fundet = filtrerAfsnit(afsnit, 'anna');

    expect(fundet).toHaveLength(1);
    expect(fundet[0].linjer.map((l) => l.navn)).toEqual(['Skål']);
  });

  // Søger man på et grejsæt, mener man hele sættet — ikke kun de ting der
  // tilfældigvis hedder det samme som det.
  it('beholder hele afsnittet når overskriften rammer', () => {
    const fundet = filtrerAfsnit(afsnit, 'køkken');

    expect(fundet).toHaveLength(1);
    expect(fundet[0].linjer).toHaveLength(2);
  });

  it('går ikke op i store og små bogstaver', () => {
    expect(filtrerAfsnit(afsnit, 'TRANGIA')[0].linjer.map((l) => l.navn)).toEqual(['Trangia']);
  });

  it('giver ingen afsnit når intet rammer', () => {
    expect(filtrerAfsnit(afsnit, 'økse')).toEqual([]);
  });
});
