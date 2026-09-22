import { describe, it, expect } from 'vitest';
import {
  aarsvalgMuligheder,
  aldrigBrugt,
  historiktal,
  naetterPrMaaned,
  stederFraTure,
  tureIAarsvalg
} from './friluftshistorik';
import { lavGruppe, lavItem, lavSted, lavTur } from './test/data';

// Friluftshistorikken regner på de ture, man har. Det, skærmen skal kunne
// stå inde for, er at tallene er turenes egne — og at et sted, man har været,
// ikke forsvinder, bare fordi man aldrig gemte det.

describe('stederne fra turene', () => {
  it('tæller et sted, der kun står som fritekst', () => {
    const steder = stederFraTure([
      lavTur({ sted: 'Fovslet Skov', startdato: '2026-08-27', slutdato: '2026-08-29', naetter: 2 })
    ], []);

    expect(steder).toHaveLength(1);
    expect(steder[0].navn).toBe('Fovslet Skov');
    expect(steder[0].gemt_uid).toBe('');
    expect(steder[0].naetter).toBe(2);
  });

  it('lægger to ture på det samme sted sammen, også når stavemåden skifter', () => {
    const steder = stederFraTure([
      lavTur({ sted: 'Fovslet Skov', startdato: '2026-08-27', slutdato: '2026-08-29', naetter: 2 }),
      lavTur({ sted: 'fovslet skov', startdato: '2026-05-01', slutdato: '2026-05-03', naetter: 2 })
    ], []);

    expect(steder).toHaveLength(1);
    expect(steder[0].ture).toBe(2);
    expect(steder[0].naetter).toBe(4);
    // Navnet og "sidst" kommer fra den seneste tur.
    expect(steder[0].navn).toBe('Fovslet Skov');
    expect(steder[0].sidste_start).toBe('2026-08-27');
  });

  it('kender det gemte sted, turen peger på', () => {
    const sted = lavSted({ uid: 's-1', id: 7, navn: 'Øhaven', tags: ['shelter'] });
    const steder = stederFraTure([lavTur({ sted: 'noget andet', sted_uid: 's-1' })], [sted]);

    expect(steder[0].navn).toBe('Øhaven');
    expect(steder[0].gemt_uid).toBe('s-1');
    expect(steder[0].gemt_id).toBe(7);
    // Stedets egne mærkater slår turens afledte.
    expect(steder[0].tags).toEqual(['shelter']);
  });

  it('mærker et sted uden egne tags med turens aktivitet og terræn', () => {
    const steder = stederFraTure([lavTur({ sted: 'Øhaven', aktivitet: 'kano', terraen: 'kyst' })], []);

    expect(steder[0].tags).toEqual(['Kano', 'Kyst']);
  });

  it('siger, hvor mange af turene der stadig er kladder', () => {
    const steder = stederFraTure([
      lavTur({ sted: 'Palnatokesvej 22', status: 'kladde' }),
      lavTur({ sted: 'Palnatokesvej 22', status: 'afsluttet' })
    ], []);

    expect(steder[0].ture).toBe(2);
    expect(steder[0].kladder).toBe(1);
  });

  it('springer ture over, der ikke siger hvor de var', () => {
    expect(stederFraTure([lavTur({ sted: '   ', sted_uid: '' })], [])).toEqual([]);
  });

  it('sætter det sted, man kommer oftest, øverst', () => {
    const steder = stederFraTure([
      lavTur({ sted: 'Enkeltbesøg', startdato: '2026-09-01' }),
      lavTur({ sted: 'Fast sted', startdato: '2026-03-01' }),
      lavTur({ sted: 'Fast sted', startdato: '2026-04-01' })
    ], []);

    expect(steder.map((s) => s.navn)).toEqual(['Fast sted', 'Enkeltbesøg']);
  });

  it('samler turenes lokale id, så de kan kobles til stedet, man gemmer', () => {
    const steder = stederFraTure([
      lavTur({ id: 1, sted: 'Fovslet Skov', startdato: '2026-08-01' }),
      lavTur({ id: 2, sted: 'Fovslet Skov', startdato: '2026-07-01' })
    ], []);

    expect([...steder[0].tur_ids].sort()).toEqual([1, 2]);
  });
});

describe('året man ser på', () => {
  it('filtrerer turene på årstallet', () => {
    const ture = [
      lavTur({ startdato: '2026-08-01' }),
      lavTur({ startdato: '2025-08-01' })
    ];

    expect(tureIAarsvalg(ture, 2026)).toHaveLength(1);
    expect(tureIAarsvalg(ture, 'alle')).toHaveLength(2);
  });

  it('stiller de to nyeste år op ved siden af "Alle år"', () => {
    const ture = [2024, 2025, 2026].map((aar) =>
      lavTur({ startdato: `${aar}-08-01`, status: 'afsluttet' }));

    expect(aarsvalgMuligheder(ture)).toEqual([2026, 2025, 'alle']);
  });

  it('viser indeværende år, når der ikke er nogen ture endnu', () => {
    expect(aarsvalgMuligheder([], new Date('2026-09-22'))).toEqual([2026, 'alle']);
  });
});

describe('tallene på forsiden af statistikken', () => {
  it('tæller ture, nætter og det grej, man ejer', () => {
    const tal = historiktal(
      [lavTur({ naetter: 4 }), lavTur({ naetter: 8 })],
      [
        lavItem({ vaegt_g: 1000, antal: 2 }),
        lavItem({ vaegt_g: 500 }),
        lavItem({ vaegt_g: 9000, status: 'solgt' })
      ]
    );

    expect(tal).toEqual({ ture: 2, naetter: 12, grej: 2, vaegt_g: 2500 });
  });
});

describe('nætter pr. måned', () => {
  it('tager kun de måneder med, man var ude i, og sætter den største først', () => {
    const maaneder = naetterPrMaaned([
      lavTur({ startdato: '2026-08-01', naetter: 4 }),
      lavTur({ startdato: '2026-08-20', naetter: 6 }),
      lavTur({ startdato: '2026-09-05', naetter: 2 })
    ]);

    expect(maaneder).toEqual([
      { maaned: 7, naetter: 10, ture: 2 },
      { maaned: 8, naetter: 2, ture: 1 }
    ]);
  });

  it('tager en dagstur med som en måned med nul nætter', () => {
    const maaneder = naetterPrMaaned([
      lavTur({ startdato: '2026-08-01', naetter: 4 }),
      lavTur({ startdato: '2026-07-04', naetter: 0 })
    ]);

    expect(maaneder.map((m) => m.maaned)).toEqual([7, 6]);
    expect(maaneder[1]).toEqual({ maaned: 6, naetter: 0, ture: 1 });
  });

  it('springer ture uden en læselig dato over', () => {
    expect(naetterPrMaaned([lavTur({ startdato: '' })])).toEqual([]);
  });
});

describe('resten, der aldrig har været med', () => {
  it('tæller det ejede grej, ingen tur har haft med', () => {
    const gruppe = lavGruppe({ uid: 'g-1', item_ids: ['u-2'] });
    const items = [
      lavItem({ uid: 'u-1' }),
      lavItem({ uid: 'u-2' }),
      lavItem({ uid: 'u-3' }),
      lavItem({ uid: 'u-4', status: 'solgt' })
    ];
    const ture = [lavTur({ loese_item_ids: ['u-1'], gruppe_ids: ['g-1'] })];

    expect(aldrigBrugt(items, ture, [gruppe])).toBe(1);
  });

  it('er nul, når alt har været med', () => {
    const items = [lavItem({ uid: 'u-1' })];
    expect(aldrigBrugt(items, [lavTur({ loese_item_ids: ['u-1'] })], [])).toBe(0);
  });
});
