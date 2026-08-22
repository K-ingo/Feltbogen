import { describe, it, expect } from 'vitest';
import { bygFeltbog, filnavn, temperaturspand, turside, vejrord } from './feltbog';
import { vejrIkonKode } from './smartMotor';
import { lavGruppe, lavItem, lavSted, lavTur } from './test/data';

const tur = (felter: Parameters<typeof lavTur>[0] = {}) =>
  lavTur({ status: 'afsluttet', ...felter });

const note = (id: string, tid: string, tekst: string) => ({ id, tid, tekst });

const budgetlinje = (id: string, beskrivelse: string, forventet_kr: number, faktisk_kr: number) =>
  ({ id, kategori: 'transport', beskrivelse, forventet_kr, faktisk_kr });

describe('turside', () => {
  it('skriver periode, sted og kendetegn ud', () => {
    const sted = lavSted({ uid: 's-1', navn: 'Rold Skov' });
    const side = turside(
      tur({ startdato: '2026-07-10', slutdato: '2026-07-12', sted_uid: 's-1', sted: 'gammel fritekst', naetter: 2 }),
      [], [], [sted]
    );

    expect(side.periode).toBe('10.–12. juli');
    expect(side.sted).toBe('Rold Skov');
    expect(side.fakta).toContainEqual({ navn: 'Nætter', vaerdi: '2' });
  });

  it('falder tilbage på turens fritekst når stedet ikke er i kartoteket', () => {
    expect(turside(tur({ sted: 'Klosterheden' }), [], [], []).sted).toBe('Klosterheden');
  });

  // En trykt side med "0 km" er værre end en kortere side.
  it('udelader bæreafstand når der ikke er nogen', () => {
    const uden = turside(tur({ baereafstand_km: 0 }), [], [], []);
    const med = turside(tur({ baereafstand_km: 12 }), [], [], []);

    expect(uden.fakta.map((f) => f.navn)).not.toContain('Bæreafstand');
    expect(med.fakta).toContainEqual({ navn: 'Bæreafstand', vaerdi: '12 km' });
  });

  it('tager kun deltagere der har et navn', () => {
    const deltager = (navn: string) => ({
      id: navn, navn, overnatning: null,
      personligt_gear_ids: [], baerer_delt_ids: [], person_uid: ''
    });

    expect(turside(tur({ deltagere: [deltager('Sofie'), deltager('  ')] }), [], [], []).deltagere)
      .toEqual(['Sofie']);
  });

  // Dagbogen læses forfra. efterDag sorterer nyeste først til skærmen.
  it('sætter feltnoterne i den rækkefølge de blev skrevet', () => {
    const side = turside(tur({
      feltnoter: [
        note('a', '2026-07-10T08:00:00Z', 'Afgang'),
        note('b', '2026-07-11T19:00:00Z', 'Regn hele dagen')
      ]
    }), [], [], []);

    expect(side.dage.map((d) => d.dato)).toEqual(['2026-07-10', '2026-07-11']);
  });
});

describe('pakkelisten', () => {
  const tarp = lavItem({ uid: 'u-tarp', navn: 'Tarp', vaegt_g: 500 });
  const gryde = lavItem({ uid: 'u-gryde', navn: 'Gryde', vaegt_g: 100 });
  const kniv = lavItem({ uid: 'u-kniv', navn: 'Kniv', vaegt_g: 170 });
  const items = [tarp, gryde, kniv];

  it('deler op efter gruppe og lægger det løse for sig', () => {
    const gruppe = lavGruppe({ uid: 'g-1', navn: 'Sovesystem', item_ids: ['u-tarp'] });
    const side = turside(
      tur({ gruppe_ids: ['g-1'], loese_item_ids: ['u-kniv'] }),
      items, [gruppe], []
    );

    expect(side.pakkeliste.map((d) => d.navn)).toEqual(['Sovesystem', 'Løst grej']);
    expect(side.pakkeliste[0].vaegt_g).toBe(500);
    expect(side.vaegt_g).toBe(670);
  });

  // Ligger gearet både i gruppen og som løst valg, hører det til gruppen —
  // det var derfor det kom med. Ellers ville vægten blive talt to gange.
  it('tæller ikke det samme gear i to dele', () => {
    const gruppe = lavGruppe({ uid: 'g-1', navn: 'Køkken', item_ids: ['u-gryde'] });
    const side = turside(
      tur({ gruppe_ids: ['g-1'], loese_item_ids: ['u-gryde'] }),
      items, [gruppe], []
    );

    expect(side.pakkeliste).toHaveLength(1);
    expect(side.vaegt_g).toBe(100);
  });

  it('ganger antallet med i vægten', () => {
    const to = lavItem({ uid: 'u-2', navn: 'Pløkke', vaegt_g: 20, antal: 8 });
    expect(turside(tur({ loese_item_ids: ['u-2'] }), [to], [], []).vaegt_g).toBe(160);
  });

  // Gear der er slettet siden turen, kan ikke trykkes.
  it('springer gear over der ikke findes længere', () => {
    expect(turside(tur({ loese_item_ids: ['u-væk'] }), items, [], []).pakkeliste).toEqual([]);
  });

  it('sorterer gearet alfabetisk inden for hver del', () => {
    const side = turside(tur({ loese_item_ids: ['u-tarp', 'u-gryde', 'u-kniv'] }), items, [], []);
    expect(side.pakkeliste[0].items.map((i) => i.navn)).toEqual(['Gryde', 'Kniv', 'Tarp']);
  });

  it('giver en tom liste når intet blev pakket', () => {
    const side = turside(tur(), items, [], []);
    expect(side.pakkeliste).toEqual([]);
    expect(side.vaegt_g).toBe(0);
  });
});

describe('budgettet', () => {
  it('lægger forventet og faktisk sammen', () => {
    const side = turside(tur({
      budget_linjer: [budgetlinje('a', 'Tog', 200, 240), budgetlinje('b', 'Mad', 300, 275)]
    }), [], [], []);

    expect(side.budget).toMatchObject({ forventet: 500, faktisk: 515 });
  });

  it('giver intet budget når der ikke er nogen linjer', () => {
    expect(turside(tur({ budget_linjer: [] }), [], [], []).budget).toBeNull();
  });
});

describe('bygFeltbog', () => {
  const ture = [
    tur({ uid: 't-2', navn: 'Sen', startdato: '2026-09-01', naetter: 1 }),
    tur({ uid: 't-1', navn: 'Tidlig', startdato: '2026-03-01', naetter: 2 }),
    tur({ uid: 't-0', navn: 'Året før', startdato: '2025-03-01' }),
    lavTur({ uid: 't-k', navn: 'Kladde', startdato: '2026-05-01', status: 'kladde' })
  ];

  it('samler årets ture i datorækkefølge og springer kladder over', () => {
    const bog = bygFeltbog(2026, ture, [], [], []);

    expect(bog.sider.map((s) => s.tur.navn)).toEqual(['Tidlig', 'Sen']);
    expect(bog.aar).toBe(2026);
  });

  it('bærer årets tal og overskrift med over fra opgørelsen', () => {
    const bog = bygFeltbog(2026, ture, [], [], []);

    expect(bog.tal.naetter).toBe(3);
    expect(bog.overskrift).toBe('2 ture og 3 nætter ude.');
  });

  it('giver en tom bog for et år uden ture', () => {
    expect(bygFeltbog(2020, ture, [], [], []).sider).toEqual([]);
  });
});

describe('vejrord', () => {
  it('skriver vejrkoden som et ord', () => {
    expect(vejrord(0)).toBe('sol');
    expect(vejrord(3)).toBe('let skyet');
    expect(vejrord(45)).toBe('skyet');
    expect(vejrord(61)).toBe('regn');
    expect(vejrord(73)).toBe('sne');
    expect(vejrord(81)).toBe('byger');
    expect(vejrord(95)).toBe('torden');
  });

  // Ordet og ikonet må aldrig kunne blive uenige om den samme kode.
  it('følger de samme grænser som ikonet på skærmen', () => {
    const par = new Map<string, Set<string>>();
    for (let kode = 0; kode <= 110; kode++) {
      const ikon = vejrIkonKode(kode);
      par.set(ikon, (par.get(ikon) ?? new Set()).add(vejrord(kode)));
    }

    for (const ord of par.values()) expect(ord.size).toBe(1);
  });
});

describe('filnavn', () => {
  // Browseren foreslår sidens titel som filnavn når man gemmer som PDF.
  it('navngiver filen efter året', () => {
    expect(filnavn(2026)).toBe('Feltbogen 2026');
  });
});

describe('temperaturspand', () => {
  it('skriver et almindeligt spænd med tankestreg', () => {
    expect(temperaturspand(8, 16)).toBe('8–16°');
  });

  // "-11–-3°" er ikke til at læse: tankestregen og minusset løber sammen.
  it('skriver med ord når det er frostvejr', () => {
    expect(temperaturspand(-11, -3)).toBe('-11° til -3°');
    expect(temperaturspand(-6, 2)).toBe('-6° til 2°');
  });

  it('siger det én gang når spændet er nul', () => {
    expect(temperaturspand(4.2, 4.4)).toBe('4°');
  });
});
