import { describe, it, expect } from 'vitest';

import {
  turtal, gennemsnitsvaegt, bedsteGrej, daarligsteGrej, andelVurderet,
  hyldevarer, hyldevarevaegt, skroebeligtGrej, grundlag, itemUidsGjortOp,
  MINDST_FOR_ET_MOENSTER
} from './laering';
import type { PakAfLinje, PakAfStatus } from './db';
import { lavItem, lavGruppe, lavTur } from './test/data';

const tjek = (linjer: [string, PakAfStatus][]) => ({
  udfyldt_dato: '2026-07-20',
  niveau: 'let' as const,
  linjer: linjer.map(([item_uid, status]): PakAfLinje => ({ item_uid, status }))
});

describe('turene talt op', () => {
  it('lægger nætter og dage sammen', () => {
    const t = turtal([lavTur({ naetter: 2 }), lavTur({ naetter: 1 })]);

    expect(t.ture).toBe(2);
    expect(t.naetter).toBe(3);
    // To nætter er tre dage, én nat er to.
    expect(t.dage).toBe(5);
  });

  it('regner nætter pr. tur med én decimal', () => {
    expect(turtal([lavTur({ naetter: 2 }), lavTur({ naetter: 1 })]).snit_naetter).toBe(1.5);
  });

  // Et snit af ingenting er ikke nul, det er ikke noget.
  it('svarer null på snittet, når der ingen ture er', () => {
    expect(turtal([]).snit_naetter).toBeNull();
  });

  it('tæller dagsture for sig', () => {
    expect(turtal([lavTur({ naetter: 0 }), lavTur({ naetter: 2 })]).dagsture).toBe(1);
  });

  it('tæller kun ture, der er gjort op', () => {
    const ture = [
      lavTur({ pak_af_tjek: tjek([['u-1', 'brugt']]) }),
      lavTur({ pak_af_tjek: null })
    ];

    expect(turtal(ture).gjort_op).toBe(1);
  });
});

describe('gennemsnitsvægten', () => {
  const telt = lavItem({ uid: 'u-telt', navn: 'Telt', vaegt_g: 2000 });
  const oekse = lavItem({ uid: 'u-oekse', navn: 'Økse', vaegt_g: 1000 });
  const items = [telt, oekse];

  it('regner snittet over de ture, der havde grej med', () => {
    const ture = [
      lavTur({ navn: 'Tung', loese_item_ids: ['u-telt', 'u-oekse'] }),
      lavTur({ navn: 'Let', loese_item_ids: ['u-oekse'] })
    ];

    const v = gennemsnitsvaegt(ture, [], items)!;

    expect(v.snit_g).toBe(2000);
    expect(v.antal).toBe(2);
  });

  // En tur uden valgt grej siger ingenting om, hvad man plejer at bære. Talt
  // som nul ville den trække snittet ned uden grund.
  it('tæller ikke en tur uden grej med som nul', () => {
    const ture = [
      lavTur({ navn: 'Med grej', loese_item_ids: ['u-telt'] }),
      lavTur({ navn: 'Tom kladde', loese_item_ids: [] })
    ];

    const v = gennemsnitsvaegt(ture, [], items)!;

    expect(v.snit_g).toBe(2000);
    expect(v.antal).toBe(1);
  });

  it('peger på den letteste og den tungeste', () => {
    const ture = [
      lavTur({ navn: 'Tung', loese_item_ids: ['u-telt', 'u-oekse'] }),
      lavTur({ navn: 'Let', loese_item_ids: ['u-oekse'] })
    ];

    const v = gennemsnitsvaegt(ture, [], items)!;

    expect(v.letteste.tur.navn).toBe('Let');
    expect(v.tungeste.tur.navn).toBe('Tung');
  });

  it('svarer null, når ingen tur har haft grej med', () => {
    expect(gennemsnitsvaegt([lavTur({ loese_item_ids: [] })], [], items)).toBeNull();
  });

  it('tæller grej, der kom med via et grejsæt', () => {
    const saet = lavGruppe({ uid: 'g-1', item_ids: ['u-telt'] });
    const ture = [lavTur({ gruppe_ids: ['g-1'] })];

    expect(gennemsnitsvaegt(ture, [saet], items)!.snit_g).toBe(2000);
  });
});

// null er ikke en dårlig karakter. De fleste ting bliver aldrig vurderet.
describe('bedste og dårligste grej', () => {
  const items = [
    lavItem({ navn: 'Elsket', vurdering: 5 }),
    lavItem({ navn: 'Fin nok', vurdering: 3 }),
    lavItem({ navn: 'Skuffelse', vurdering: 1 }),
    lavItem({ navn: 'Aldrig vurderet' }),
    lavItem({ navn: 'Solgt og god', vurdering: 5, status: 'solgt' })
  ];

  it('sætter de bedste øverst', () => {
    expect(bedsteGrej(items).map((s) => s.item.navn)).toEqual(['Elsket', 'Fin nok', 'Skuffelse']);
  });

  it('sætter de dårligste øverst den anden vej', () => {
    expect(daarligsteGrej(items)[0].item.navn).toBe('Skuffelse');
  });

  it('tæller ikke uvurderet grej som nul stjerner', () => {
    expect(daarligsteGrej(items).map((s) => s.item.navn)).not.toContain('Aldrig vurderet');
  });

  it('holder sig til det, man stadig ejer', () => {
    expect(bedsteGrej(items).map((s) => s.item.navn)).not.toContain('Solgt og god');
  });

  // Samme rækkefølge hver gang, også når to ting har fået lige mange stjerner.
  it('sorterer efter navn, når stjernerne er ens', () => {
    const lige = [
      lavItem({ navn: 'Økse', vurdering: 4 }),
      lavItem({ navn: 'Bål-kniv', vurdering: 4 })
    ];

    expect(bedsteGrej(lige).map((s) => s.item.navn)).toEqual(['Bål-kniv', 'Økse']);
  });

  it('siger hvor stor en del af skabet der er vurderet', () => {
    expect(andelVurderet(items)).toEqual({ vurderet: 3, i_alt: 4 });
  });

  it('viser højst det antal, der bedes om', () => {
    expect(bedsteGrej(items, 2)).toHaveLength(2);
  });
});

// Det skarpeste, appen kan sige: hvad kommer med hver gang og bliver liggende
// i tasken.
describe('hyldevarer', () => {
  const bog = lavItem({ uid: 'u-bog', navn: 'Bog', vaegt_g: 400 });
  const stol = lavItem({ uid: 'u-stol', navn: 'Lejrstol', vaegt_g: 900 });
  const oekse = lavItem({ uid: 'u-oekse', navn: 'Økse', vaegt_g: 1000 });
  const items = [bog, stol, oekse];

  const treTure = (status: PakAfStatus) => [
    lavTur({ pak_af_tjek: tjek([['u-bog', status]]) }),
    lavTur({ pak_af_tjek: tjek([['u-bog', status]]) }),
    lavTur({ pak_af_tjek: tjek([['u-bog', status]]) })
  ];

  it('finder det, der altid er med og aldrig bruges', () => {
    const fundet = hyldevarer(items, treTure('ubrugt'));

    expect(fundet).toHaveLength(1);
    expect(fundet[0].item.navn).toBe('Bog');
    expect(fundet[0].med).toBe(3);
  });

  it('lader det være, hvis det har været brugt bare én gang', () => {
    const ture = [
      lavTur({ pak_af_tjek: tjek([['u-bog', 'ubrugt']]) }),
      lavTur({ pak_af_tjek: tjek([['u-bog', 'ubrugt']]) }),
      lavTur({ pak_af_tjek: tjek([['u-bog', 'brugt']]) })
    ];

    expect(hyldevarer(items, ture)).toEqual([]);
  });

  // "Brugt 0 af 1 gange" er ikke en hyldevare, det er én tur.
  it('siger ingenting på for tyndt et grundlag', () => {
    const enTur = [lavTur({ pak_af_tjek: tjek([['u-bog', 'ubrugt']]) })];

    expect(hyldevarer(items, enTur)).toEqual([]);
  });

  // En tur uden pak-af-tjek ved ingenting om gearet.
  it('tæller ikke en tur uden opgør som ubrugt', () => {
    const ture = [...treTure('ubrugt'), lavTur({ pak_af_tjek: null })];

    expect(hyldevarer(items, ture)[0].med).toBe(3);
  });

  it('sætter det tungeste øverst — der er mest at hente', () => {
    const ture = [1, 2, 3].map(() => lavTur({
      pak_af_tjek: tjek([['u-bog', 'ubrugt'], ['u-stol', 'ubrugt']])
    }));

    expect(hyldevarer(items, ture).map((h) => h.item.navn)).toEqual(['Lejrstol', 'Bog']);
  });

  it('lægger sammen, hvad man ville spare', () => {
    const ture = [1, 2, 3].map(() => lavTur({
      pak_af_tjek: tjek([['u-bog', 'ubrugt'], ['u-stol', 'ubrugt']])
    }));

    expect(hyldevarevaegt(hyldevarer(items, ture))).toBe(1300);
  });

  it('respekterer en anden tærskel', () => {
    const toTure = [
      lavTur({ pak_af_tjek: tjek([['u-bog', 'ubrugt']]) }),
      lavTur({ pak_af_tjek: tjek([['u-bog', 'ubrugt']]) })
    ];

    expect(hyldevarer(items, toTure, 2)).toHaveLength(1);
    expect(hyldevarer(items, toTure)).toEqual([]);
  });
});

// Én gang er uheld; to er en egenskab ved tingen.
describe('det der ikke holder', () => {
  const lygte = lavItem({ uid: 'u-lygte', navn: 'Lygte' });

  it('finder grej, der er gået i stykker mere end én gang', () => {
    const ture = [
      lavTur({ pak_af_tjek: tjek([['u-lygte', 'i_stykker']]) }),
      lavTur({ pak_af_tjek: tjek([['u-lygte', 'i_stykker']]) })
    ];

    expect(skroebeligtGrej([lygte], ture)[0].gange).toBe(2);
  });

  it('kalder ikke ét uheld for en egenskab', () => {
    const ture = [
      lavTur({ pak_af_tjek: tjek([['u-lygte', 'i_stykker']]) }),
      lavTur({ pak_af_tjek: tjek([['u-lygte', 'brugt']]) })
    ];

    expect(skroebeligtGrej([lygte], ture)).toEqual([]);
  });
});

// Uden det her ville en ny bruger møde en side, der påstår at kende hendes
// vaner efter én tur.
describe('grundlaget', () => {
  const gjortOp = () => lavTur({ pak_af_tjek: tjek([['u-1', 'brugt']]) });

  it('siger fra, når ingen ture er gjort op', () => {
    const g = grundlag([lavTur({ pak_af_tjek: null })]);

    expect(g.nok).toBe(false);
    expect(g.gjort_op).toBe(0);
    expect(g.mangler).toContain('ingen ture gjort op');
  });

  it('siger hvor mange der mangler', () => {
    expect(grundlag([gjortOp()]).mangler).toContain('2 ture mere');
  });

  it('bøjer det i ental, når der kun mangler én', () => {
    expect(grundlag([gjortOp(), gjortOp()]).mangler).toContain('1 tur mere');
  });

  it('er tilfreds fra tre ture', () => {
    const g = grundlag([gjortOp(), gjortOp(), gjortOp()]);

    expect(g.nok).toBe(true);
    expect(g.mangler).toBe('');
  });

  it('bruger den samme tærskel som mønstrene', () => {
    const ture = Array.from({ length: MINDST_FOR_ET_MOENSTER }, gjortOp);

    expect(grundlag(ture).nok).toBe(true);
  });
});

describe('hvad der er gjort op', () => {
  it('samler grejet fra alle pak-af-tjek', () => {
    const ture = [
      lavTur({ pak_af_tjek: tjek([['u-a', 'brugt'], ['u-b', 'ubrugt']]) }),
      lavTur({ pak_af_tjek: tjek([['u-b', 'brugt'], ['u-c', 'brugt']]) }),
      lavTur({ pak_af_tjek: null })
    ];

    expect([...itemUidsGjortOp(ture)].sort()).toEqual(['u-a', 'u-b', 'u-c']);
  });
});
