import { describe, it, expect } from 'vitest';
import {
  naesteTur,
  naarBegynder,
  handlinger,
  tureIAar,
  sidstTilfoejede
} from './dashboard';
import { lavItem, lavGruppe, lavTur } from './test/data';

const NU = new Date('2026-07-30T12:00:00');

describe('naesteTur', () => {
  it('vælger den nærmeste tur der ikke er overstået', () => {
    const senere = lavTur({ navn: 'Senere', startdato: '2026-09-01', slutdato: '2026-09-03' });
    const naeste = lavTur({ navn: 'Næste', startdato: '2026-08-07', slutdato: '2026-08-09' });
    const forbi = lavTur({ navn: 'Forbi', startdato: '2026-06-01', slutdato: '2026-06-03' });

    expect(naesteTur([senere, naeste, forbi], NU)?.navn).toBe('Næste');
  });

  it('beholder en tur man er midt i', () => {
    const igang = lavTur({ navn: 'I gang', startdato: '2026-07-28', slutdato: '2026-08-01' });
    const senere = lavTur({ navn: 'Senere', startdato: '2026-08-20', slutdato: '2026-08-22' });

    expect(naesteTur([igang, senere], NU)?.navn).toBe('I gang');
  });

  it('regner en tur der slutter i dag som stadig i gang', () => {
    const slutterIdag = lavTur({ navn: 'Slutter i dag', startdato: '2026-07-27', slutdato: '2026-07-30' });
    expect(naesteTur([slutterIdag], NU)?.navn).toBe('Slutter i dag');
  });

  it('springer afsluttede ture over, også fremtidige', () => {
    const afsluttet = lavTur({ navn: 'Afsluttet', startdato: '2026-08-01', status: 'afsluttet' });
    const kladde = lavTur({ navn: 'Kladde', startdato: '2026-08-10', slutdato: '2026-08-12' });

    expect(naesteTur([afsluttet, kladde], NU)?.navn).toBe('Kladde');
  });

  it('giver null når der ikke er nogen tur forude', () => {
    expect(naesteTur([], NU)).toBeNull();
    expect(naesteTur([lavTur({ startdato: '2026-01-01', slutdato: '2026-01-02' })], NU)).toBeNull();
  });

  it('ignorerer ture uden startdato', () => {
    expect(naesteTur([lavTur({ startdato: '', slutdato: '' })], NU)).toBeNull();
  });
});

describe('naarBegynder', () => {
  it('tæller dage til turen', () => {
    expect(naarBegynder(lavTur({ startdato: '2026-08-07' }), NU)).toBe('om 8 dage');
  });

  it('siger i morgen og i dag frem for at tælle', () => {
    expect(naarBegynder(lavTur({ startdato: '2026-07-31' }), NU)).toBe('i morgen');
    expect(naarBegynder(lavTur({ startdato: '2026-07-30' }), NU)).toBe('i dag');
  });

  it('siger i gang når turen er begyndt', () => {
    expect(naarBegynder(lavTur({ startdato: '2026-07-28' }), NU)).toBe('i gang');
  });
});

describe('handlinger', () => {
  const medGaranti = (navn: string, udloeber: string, paamindelse = 30) =>
    lavItem({ navn, koebt_hos: 'Butik', koebsdato: '01/2025', garanti: { laengde_aar: 2, udloeber_dato: udloeber, paamindelse_dage: paamindelse } });

  it('advarer om garantier der løber ud, den mest presserende først', () => {
    const om25 = medGaranti('Om 25 dage', '24/08/2026');
    const om3 = medGaranti('Om 3 dage', '02/08/2026');

    const h = handlinger([om25, om3], [], [], NU);

    expect(h.map((x) => x.detalje)).toEqual(['Om 3 dage · 3 dage', 'Om 25 dage · 25 dage']);
    expect(h[0].titel).toBe('Garanti udløber');
  });

  it('tier om garantier der er langt ude i fremtiden', () => {
    expect(handlinger([medGaranti('Langt ude', '24/08/2027')], [], [], NU)).toEqual([]);
  });

  it('bruger ental og "i dag" tæt på fristen', () => {
    expect(handlinger([medGaranti('I morgen', '31/07/2026')], [], [], NU)[0].detalje).toBe('I morgen · 1 dag');
    expect(handlinger([medGaranti('I dag', '30/07/2026')], [], [], NU)[0].detalje).toBe('I dag · i dag');
    expect(handlinger([medGaranti('Forbi', '20/07/2026')], [], [], NU)[0].detalje).toBe('Forbi · udløbet');
  });

  it('spørger til købsinfo på gear med en pris', () => {
    const uden = lavItem({ navn: 'Toaks 1L', pris_kr: 400 });

    const h = handlinger([uden], [], [], NU);

    expect(h).toHaveLength(1);
    expect(h[0].titel).toBe('Manglende købsinfo');
    expect(h[0].detalje).toBe('Toaks 1L');
  });

  it('spørger ikke når købsstedet eller datoen er der', () => {
    const medSted = lavItem({ pris_kr: 400, koebt_hos: 'Friluftsland' });
    const medDato = lavItem({ pris_kr: 400, koebsdato: '01/2025' });

    expect(handlinger([medSted, medDato], [], [], NU)).toEqual([]);
  });

  it('spørger ikke om gear uden pris', () => {
    expect(handlinger([lavItem({ pris_kr: 0 })], [], [], NU)).toEqual([]);
  });

  it('rører ikke gear man ikke ejer', () => {
    const solgt = lavItem({ status: 'solgt', pris_kr: 400 });
    const overvejer = lavItem({ status: 'overvejer', pris_kr: 400 });

    expect(handlinger([solgt, overvejer], [], [], NU)).toEqual([]);
  });

  describe('ubrugt gear', () => {
    const femTure = (itemUid: string) =>
      ['2026-07-01', '2026-06-01', '2026-05-01', '2026-04-01', '2026-03-01']
        .map((d) => lavTur({ startdato: d, slutdato: d, loese_item_ids: [itemUid] }));

    it('flager gear der ikke var med på nogen af de seneste ture', () => {
      const brugt = lavItem({ uid: 'u-brugt', navn: 'Brugt', pris_kr: 0 });
      const glemt = lavItem({ uid: 'u-glemt', navn: 'Fiskars X7', pris_kr: 0 });

      const h = handlinger([brugt, glemt], femTure('u-brugt'), [], NU);

      expect(h).toHaveLength(1);
      expect(h[0].titel).toBe('Ubrugt gear');
      expect(h[0].detalje).toBe('Fiskars X7 · 5 ture');
    });

    it('tæller også gear der kom med via en gruppe som brugt', () => {
      const item = lavItem({ uid: 'u-1', pris_kr: 0 });
      const gruppe = lavGruppe({ uid: 'g-1', item_ids: ['u-1'] });
      const ture = ['2026-07-01', '2026-06-01', '2026-05-01', '2026-04-01', '2026-03-01']
        .map((d) => lavTur({ startdato: d, slutdato: d, gruppe_ids: ['g-1'] }));

      expect(handlinger([item], ture, [gruppe], NU)).toEqual([]);
    });

    // Uden turhistorik ville alt gear blive flaget den dag man opretter det.
    it('tier indtil der er ture nok at måle på', () => {
      const item = lavItem({ pris_kr: 0 });
      const fire = ['2026-07-01', '2026-06-01', '2026-05-01', '2026-04-01']
        .map((d) => lavTur({ startdato: d, slutdato: d }));

      expect(handlinger([item], fire, [], NU)).toEqual([]);
    });

    it('regner kun med ture der har været, ikke planlagte', () => {
      const item = lavItem({ pris_kr: 0 });
      const kommende = ['2026-08-01', '2026-09-01', '2026-10-01', '2026-11-01', '2026-12-01']
        .map((d) => lavTur({ startdato: d, slutdato: d }));

      // Den første tur er tæt nok på til at give sin egen handling — her er
      // det kun spørgsmålet om gearet regnes som ubrugt der er på prøve.
      const h = handlinger([item], kommende, [], NU);

      expect(h.filter((x) => x.type === 'ubrugt')).toEqual([]);
    });
  });

  describe('kladde tæt på start', () => {
    const kladde = (startdato: string, navn = 'Rold Skov') =>
      lavTur({ navn, startdato, slutdato: startdato, status: 'kladde' });

    it('varsler om en tur der begynder om få dage og stadig er kladde', () => {
      const h = handlinger([], [kladde('2026-08-02')], [], NU);

      expect(h).toHaveLength(1);
      expect(h[0].type).toBe('kladde_naer_start');
      expect(h[0].titel).toBe('Turen er stadig en kladde');
      expect(h[0].detalje).toBe('Rold Skov · om 3 dage');
    });

    it('skriver i morgen og i dag frem for at tælle', () => {
      expect(handlinger([], [kladde('2026-07-31')], [], NU)[0].detalje).toBe('Rold Skov · i morgen');
      expect(handlinger([], [kladde('2026-07-30')], [], NU)[0].detalje).toBe('Rold Skov · starter i dag');
    });

    it('tier om ture der er længere ude end varslet', () => {
      expect(handlinger([], [kladde('2026-08-03')], [], NU)).toEqual([]);
    });

    // En kladde man aldrig kom afsted på er ikke noget man kan nå at gøre klar.
    it('tier om ture hvis startdato er passeret', () => {
      expect(handlinger([], [kladde('2026-07-29')], [], NU)).toEqual([]);
    });

    it('rører ikke ture der allerede er gjort klar', () => {
      const klar = lavTur({ startdato: '2026-08-01', slutdato: '2026-08-01', status: 'klar' });
      expect(handlinger([], [klar], [], NU)).toEqual([]);
    });

    it('sætter den nærmeste tur øverst', () => {
      const h = handlinger([], [kladde('2026-08-02', 'Senere'), kladde('2026-07-31', 'Først')], [], NU);
      expect(h.map((x) => x.detalje)).toEqual(['Først · i morgen', 'Senere · om 3 dage']);
    });

    it('peger på turen og ikke på et stykke gear', () => {
      const tur = kladde('2026-08-01');
      expect(handlinger([], [tur], [], NU)[0].maal).toEqual({ slags: 'tur', uid: tur.uid });
    });
  });

  describe('manglende pak-af-tjek', () => {
    const afsluttet = (slutdato: string, navn = 'Mols') =>
      lavTur({ navn, startdato: slutdato, slutdato, status: 'afsluttet' });

    it('spørger til en afsluttet tur der aldrig blev gjort op', () => {
      const h = handlinger([], [afsluttet('2026-07-28')], [], NU);

      expect(h).toHaveLength(1);
      expect(h[0].type).toBe('pak_af_tjek_mangler');
      expect(h[0].titel).toBe('Mangler pak-af-tjek');
      expect(h[0].detalje).toBe('Mols · slut for 2 dage siden');
    });

    it('skriver i går og i dag frem for at tælle', () => {
      expect(handlinger([], [afsluttet('2026-07-29')], [], NU)[0].detalje).toBe('Mols · slut i går');
      expect(handlinger([], [afsluttet('2026-07-30')], [], NU)[0].detalje).toBe('Mols · slut i dag');
    });

    it('tier når turen er gjort op', () => {
      const gjortOp = lavTur({
        startdato: '2026-07-28',
        slutdato: '2026-07-28',
        status: 'afsluttet',
        pak_af_tjek: { udfyldt_dato: '2026-07-29T10:00:00Z', niveau: 'let', linjer: [] }
      });

      expect(handlinger([], [gjortOp], [], NU)).toEqual([]);
    });

    it('rører ikke ture der ikke er afsluttet', () => {
      const aktiv = lavTur({ startdato: '2026-07-28', slutdato: '2026-07-28', status: 'aktiv' });
      expect(handlinger([], [aktiv], [], NU)).toEqual([]);
    });

    // Jo længere tid der går, jo mindre kan man huske.
    it('haster først når fristen er passeret', () => {
      expect(handlinger([], [afsluttet('2026-07-28')], [], NU)[0].haster).toBe(false);
      expect(handlinger([], [afsluttet('2026-07-27')], [], NU)[0].haster).toBe(false);
      expect(handlinger([], [afsluttet('2026-07-26')], [], NU)[0].haster).toBe(true);
    });

    it('sætter den ældste tur øverst — den er sværest at huske tilbage på', () => {
      const h = handlinger([], [afsluttet('2026-07-29', 'Ny'), afsluttet('2026-07-20', 'Gammel')], [], NU);
      expect(h.map((x) => x.detalje)).toEqual(['Gammel · slut for 10 dage siden', 'Ny · slut i går']);
    });
  });

  it('stiller garanti før købsinfo før ubrugt', () => {
    const garanti = medGaranti('Garanti', '02/08/2026');
    const koeb = lavItem({ navn: 'Købsinfo', pris_kr: 400 });
    const ubrugt = lavItem({ navn: 'Ubrugt', pris_kr: 0, koebt_hos: 'Butik' });
    const ture = ['2026-07-01', '2026-06-01', '2026-05-01', '2026-04-01', '2026-03-01']
      .map((d) => lavTur({ startdato: d, slutdato: d }));

    const h = handlinger([ubrugt, koeb, garanti], ture, [], NU);

    expect(h.map((x) => x.type)).toEqual(['garanti', 'koebsinfo', 'ubrugt']);
  });

  // Garantien koster penge at overskride; turene koster kun sig selv.
  it('stiller gear med en frist før ture, og turene før resten', () => {
    const garanti = medGaranti('Garanti', '02/08/2026');
    const koeb = lavItem({ navn: 'Købsinfo', pris_kr: 400 });
    const kladde = lavTur({ navn: 'Kladde', startdato: '2026-08-01', slutdato: '2026-08-01', status: 'kladde' });
    const ikkeGjortOp = lavTur({ navn: 'Slut', startdato: '2026-07-20', slutdato: '2026-07-20', status: 'afsluttet' });

    const h = handlinger([koeb, garanti], [kladde, ikkeGjortOp], [], NU);

    expect(h.map((x) => x.type)).toEqual([
      'garanti',
      'kladde_naer_start',
      'pak_af_tjek_mangler',
      'koebsinfo'
    ]);
  });

  // Et item kan sagtens fejle to ting. På startskærmen fylder gentagelsen
  // bare pladsen op for andet gear.
  it('viser kun det vigtigste problem pr. item', () => {
    // Både uden købsinfo og aldrig med på en tur.
    const dobbelt = lavItem({ navn: 'Toaks 1L', pris_kr: 400 });
    const ture = ['2026-07-01', '2026-06-01', '2026-05-01', '2026-04-01', '2026-03-01']
      .map((d) => lavTur({ startdato: d, slutdato: d }));

    const h = handlinger([dobbelt], ture, [], NU);

    expect(h).toHaveLength(1);
    expect(h[0].type).toBe('koebsinfo');
  });
});

describe('tureIAar', () => {
  it('tæller årets ture og sammenligner med sidste år', () => {
    const ture = [
      lavTur({ startdato: '2026-03-01' }),
      lavTur({ startdato: '2026-05-01' }),
      lavTur({ startdato: '2025-04-01' }),
      lavTur({ startdato: '2025-06-01' }),
      lavTur({ startdato: '2025-08-01' }),
      lavTur({ startdato: '2025-09-01' })
    ];

    // 2 mod 4 → 50 % færre.
    expect(tureIAar(ture, NU)).toEqual({ iAar: 2, sidsteAar: 4, aendringPct: -50 });
  });

  it('giver ingen procent når der ikke var noget sidste år at måle imod', () => {
    expect(tureIAar([lavTur({ startdato: '2026-03-01' })], NU).aendringPct).toBeNull();
  });

  it('tæller nul ture uden at gå i stykker', () => {
    expect(tureIAar([], NU)).toEqual({ iAar: 0, sidsteAar: 0, aendringPct: null });
  });
});

describe('sidstTilfoejede', () => {
  it('giver de nyeste først', () => {
    const gammel = lavItem({ navn: 'Gammel', oprettet: new Date('2026-01-01') });
    const ny = lavItem({ navn: 'Ny', oprettet: new Date('2026-07-01') });
    const mellem = lavItem({ navn: 'Mellem', oprettet: new Date('2026-04-01') });

    expect(sidstTilfoejede([gammel, ny, mellem]).map((i) => i.navn)).toEqual(['Ny', 'Mellem', 'Gammel']);
  });

  it('skærer listen ned til det ønskede antal', () => {
    const items = [1, 2, 3, 4, 5, 6].map((n) => lavItem({ oprettet: new Date(`2026-0${n}-01`) }));
    expect(sidstTilfoejede(items, 3)).toHaveLength(3);
  });

  it('rører ikke den liste den får ind', () => {
    const items = [
      lavItem({ navn: 'A', oprettet: new Date('2026-01-01') }),
      lavItem({ navn: 'B', oprettet: new Date('2026-07-01') })
    ];
    sidstTilfoejede(items);
    expect(items.map((i) => i.navn)).toEqual(['A', 'B']);
  });
});
