import { describe, it, expect } from 'vitest';
import {
  stederMedBesoeg,
  gentagneSteder,
  stedtal,
  turkarakter,
  besoegstal,
  historiktal,
  naetterPrMaaned,
  saesonen
} from './friluftshistorik';
import { lavItem, lavSted, lavTur } from './test/data';

// ─────────────────────────────────────────────
// Friluftshistorikken
//
// Stederne kommer af turene og ikke af stedbogen, og tallene skal kunne
// spores tilbage til noget, brugeren selv har skrevet ind. Det er dét, der
// prøves af herunder.
// ─────────────────────────────────────────────

describe('stederMedBesoeg', () => {
  it('tæller turene og nætterne på et gemt sted', () => {
    const sted = lavSted({ uid: 's-rold', navn: 'Rold Skov' });
    const ture = [
      lavTur({ sted_uid: 's-rold', startdato: '2026-06-10', naetter: 2 }),
      lavTur({ sted_uid: 's-rold', startdato: '2026-08-01', naetter: 3 })
    ];

    const [linje] = stederMedBesoeg([sted], ture);

    expect(linje.navn).toBe('Rold Skov');
    expect(linje.ture).toBe(2);
    expect(linje.naetter).toBe(5);
    expect(linje.gemt).toBe(true);
  });

  // Man skriver ikke steder ind i et register; man skriver dem på en tur. En
  // liste, der kun viste de gemte, ville stå tom for en, der har været ude.
  it('tager steder med, der kun står som fritekst på turen', () => {
    const ture = [lavTur({ sted: 'Øhaven', sted_uid: '', startdato: '2026-08-01', naetter: 4 })];

    const [linje] = stederMedBesoeg([], ture);

    expect(linje.navn).toBe('Øhaven');
    expect(linje.ture).toBe(1);
    expect(linje.gemt).toBe(false);
    expect(linje.id).toBeUndefined();
  });

  it('samler to ture til det samme fritekst-sted, uanset store bogstaver', () => {
    const ture = [
      lavTur({ sted: 'Øhaven', sted_uid: '', startdato: '2026-08-01', naetter: 1 }),
      lavTur({ sted: 'øhaven', sted_uid: '', startdato: '2026-09-01', naetter: 2 })
    ];

    const linjer = stederMedBesoeg([], ture);

    expect(linjer).toHaveLength(1);
    expect(linjer[0].ture).toBe(2);
    expect(linjer[0].naetter).toBe(3);
  });

  it('bruger stedbogens navn, når turen peger på et gemt sted', () => {
    const sted = lavSted({ uid: 's-rold', navn: 'Rold Skov' });
    const ture = [lavTur({ sted: 'rold', sted_uid: 's-rold', startdato: '2026-06-10' })];

    const [linje] = stederMedBesoeg([sted], ture);

    expect(linje.navn).toBe('Rold Skov');
  });

  it('tager et gemt sted med, man ikke har været på endnu', () => {
    const linjer = stederMedBesoeg([lavSted({ uid: 's-ny', navn: 'Skagen Klitplantage' })], []);

    expect(linjer).toHaveLength(1);
    expect(linjer[0].ture).toBe(0);
    expect(linjer[0].sidste).toBeNull();
  });

  it('sætter det sted, man kommer igen, øverst — og det uden ture nederst', () => {
    const steder = [lavSted({ uid: 's-ny', navn: 'Aldrig været' })];
    const ture = [
      lavTur({ sted: 'Én gang', sted_uid: '', startdato: '2026-06-01', naetter: 9 }),
      lavTur({ sted: 'To gange', sted_uid: '', startdato: '2026-07-01', naetter: 1 }),
      lavTur({ sted: 'To gange', sted_uid: '', startdato: '2026-08-01', naetter: 1 })
    ];

    expect(stederMedBesoeg(steder, ture).map((l) => l.navn))
      .toEqual(['To gange', 'Én gang', 'Aldrig været']);
  });

  it('peger på den nyeste tur som den sidste', () => {
    const ture = [
      lavTur({ sted: 'Øhaven', sted_uid: '', startdato: '2026-06-01', navn: 'Gammel' }),
      lavTur({ sted: 'Øhaven', sted_uid: '', startdato: '2026-08-01', navn: 'Ny' })
    ];

    expect(stederMedBesoeg([], ture)[0].sidste?.navn).toBe('Ny');
  });

  // Kladden tæller med — man har skrevet den ned, og stedet skal kunne findes
  // igen — men tallet skal kunne læses med det forbehold.
  it('markerer stedet, når den nyeste tur er en kladde', () => {
    const ture = [
      lavTur({ sted: 'Palnatokesvej 22', sted_uid: '', startdato: '2026-08-09', status: 'kladde', naetter: 6 })
    ];

    const [linje] = stederMedBesoeg([], ture);

    expect(linje.kladde).toBe(true);
    expect(linje.naetter).toBe(6);
  });

  it('markerer ikke stedet, når man har været der siden kladden', () => {
    const ture = [
      lavTur({ sted: 'Øhaven', sted_uid: '', startdato: '2026-06-01', status: 'kladde' }),
      lavTur({ sted: 'Øhaven', sted_uid: '', startdato: '2026-08-01', status: 'afsluttet' })
    ];

    expect(stederMedBesoeg([], ture)[0].kladde).toBe(false);
  });

  it('springer ture uden noget sted over', () => {
    expect(stederMedBesoeg([], [lavTur({ sted: '   ', sted_uid: '' })])).toEqual([]);
  });
});

describe('gentagneSteder', () => {
  it('tæller kun dem, man er kommet tilbage til', () => {
    const ture = [
      lavTur({ sted: 'Én gang', sted_uid: '' }),
      lavTur({ sted: 'To gange', sted_uid: '' }),
      lavTur({ sted: 'To gange', sted_uid: '' })
    ];

    expect(gentagneSteder(stederMedBesoeg([], ture))).toBe(1);
  });
});

describe('turkarakter', () => {
  it('skriver aktiviteten og terrænet, som man siger det', () => {
    expect(turkarakter(lavTur({ aktivitet: 'bushcraft', terraen: 'skov' }))).toBe('bushcraft · skov');
  });

  it('siger ingenting om et sted, der ikke har en tur endnu', () => {
    expect(turkarakter(null)).toBe('');
  });
});

describe('besoegstal', () => {
  const linje = (ture: number, naetter: number) =>
    besoegstal({
      noegle: 'x', navn: 'X', gemt: false, adresse: '',
      ture, naetter, sidste: null, kladde: false
    });

  it('skriver ture og nætter i alt', () => {
    expect(linje(2, 4)).toBe('2 ture · 4 nætter i alt');
  });

  it('siger ikke "i alt" om én tur', () => {
    expect(linje(1, 4)).toBe('1 tur · 4 nætter');
  });

  it('bøjer den ene nat', () => {
    expect(linje(1, 1)).toBe('1 tur · 1 nat');
  });

  // En dagstur er ikke nul nætter, den er en dagstur.
  it('lader nætterne stå, når der ikke var nogen', () => {
    expect(linje(1, 0)).toBe('1 tur');
  });

  it('er ærlig om et gemt sted uden ture', () => {
    expect(linje(0, 0)).toBe('Ingen ture herfra endnu');
  });
});

describe('historiktal', () => {
  it('tæller ture og nætter i perioden og grejet, som det ser ud nu', () => {
    const ture = [
      lavTur({ startdato: '2026-06-01', naetter: 2 }),
      lavTur({ startdato: '2026-08-01', naetter: 1 })
    ];
    const items = [
      lavItem({ vaegt_g: 1200, status: 'ejer' }),
      lavItem({ vaegt_g: 800, status: 'ejer' }),
      // Solgt grej er ikke længere en del af inventaret.
      lavItem({ vaegt_g: 5000, status: 'solgt' })
    ];

    expect(historiktal(ture, items)).toEqual({
      ture: 2,
      naetter: 3,
      grej: 2,
      vaegt_g: 2000
    });
  });
});

describe('nætterne pr. måned', () => {
  it('lægger turen i den måned, den begyndte', () => {
    const maaneder = naetterPrMaaned([
      lavTur({ startdato: '2026-07-30', naetter: 4 })
    ]);

    expect(maaneder[6]).toBe(4);
    expect(maaneder[7]).toBe(0);
  });

  it('springer ture over, der ikke har en dato at ligge på', () => {
    expect(naetterPrMaaned([lavTur({ startdato: '', naetter: 3 })]).every((n) => n === 0)).toBe(true);
  });

  it('lægger flere år oven i hinanden — det er sæsonen, ikke året', () => {
    const maaneder = naetterPrMaaned([
      lavTur({ startdato: '2025-08-01', naetter: 2 }),
      lavTur({ startdato: '2026-08-01', naetter: 3 })
    ]);

    expect(maaneder[7]).toBe(5);
  });
});

describe('sæsonen', () => {
  it('går fra den første måned med nætter til den sidste', () => {
    const maaneder = saesonen([
      lavTur({ startdato: '2026-06-01', naetter: 3 }),
      lavTur({ startdato: '2026-08-01', naetter: 1 })
    ]);

    expect(maaneder).toEqual([
      { maaned: 5, naetter: 3 },
      // Juli midt i sæsonen hører med: at der ikke blev sovet ude er også en
      // oplysning.
      { maaned: 6, naetter: 0 },
      { maaned: 7, naetter: 1 }
    ]);
  });

  it('er tom, når der ikke blev sovet ude', () => {
    expect(saesonen([lavTur({ startdato: '2026-06-01', naetter: 0 })])).toEqual([]);
  });
});

describe('stedtal', () => {
  it('holder stederne fra turene, gensynene og de gemte fra hinanden', () => {
    const steder = [lavSted({ uid: 's-ny', navn: 'Aldrig været' })];
    const ture = [
      lavTur({ sted: 'Øhaven', sted_uid: '', startdato: '2026-07-01' }),
      lavTur({ sted: 'Øhaven', sted_uid: '', startdato: '2026-08-01' }),
      lavTur({ sted: 'Fovslet Skov', sted_uid: '', startdato: '2026-06-01' })
    ];

    expect(stedtal(stederMedBesoeg(steder, ture))).toEqual({
      i_alt: 3,
      fra_ture: 2,
      uden_ture: 1,
      gensyn: 1
    });
  });
});
