import { describe, it, expect } from 'vitest';
import {
  brugPrItem,
  dageSidenSlut,
  kategoriNoteFor,
  kategorierPaaTur,
  manglerPakAfTjek,
  noterFor,
  nytPakAfTjek,
  opsummering,
  resumetekst,
  saetKategoriNote,
  saetLinjenoter,
  saetNiveau,
  saetStatus,
  statusFor,
  synkroniserLinjer
} from './pakAfTjek';
import type { PakAfTjek } from './db';
import { lavItem, lavGruppe, lavTur } from './test/data';

const NU = new Date('2026-07-30T12:00:00');

const item = (uid: string, navn = uid) => lavItem({ uid, navn });

// Et tjek på tre stykker gear, alle på standardværdien.
const treItems = [item('u-1'), item('u-2'), item('u-3')];

describe('nytPakAfTjek', () => {
  it('lægger en linje pr. item på turen', () => {
    const tjek = nytPakAfTjek(treItems, 'let', NU);

    expect(tjek.linjer.map((l) => l.item_uid)).toEqual(['u-1', 'u-2', 'u-3']);
    expect(tjek.niveau).toBe('let');
    expect(tjek.udfyldt_dato).toBe(NU.toISOString());
  });

  // Det almindelige udfald er at gearet blev brugt — ellers var det ikke
  // kommet med. Så er et let tjek de få tryk hvor man afviger.
  it('starter alt som brugt', () => {
    const tjek = nytPakAfTjek(treItems, 'let', NU);
    expect(tjek.linjer.every((l) => l.status === 'brugt')).toBe(true);
  });

  it('klarer en tur uden gear', () => {
    expect(nytPakAfTjek([], 'let', NU).linjer).toEqual([]);
  });
});

describe('synkroniserLinjer', () => {
  it('giver det samme tjek tilbage når pakkelisten er uændret', () => {
    const tjek = nytPakAfTjek(treItems, 'let', NU);
    expect(synkroniserLinjer(tjek, treItems)).toBe(tjek);
  });

  it('lægger en linje til gear der er kommet med siden', () => {
    const tjek = nytPakAfTjek(treItems, 'let', NU);
    const flere = [...treItems, item('u-4')];

    expect(synkroniserLinjer(tjek, flere).linjer.map((l) => l.item_uid))
      .toEqual(['u-1', 'u-2', 'u-3', 'u-4']);
  });

  it('smider linjer væk for gear der er taget af listen', () => {
    const tjek = nytPakAfTjek(treItems, 'let', NU);

    expect(synkroniserLinjer(tjek, [treItems[0]]).linjer.map((l) => l.item_uid)).toEqual(['u-1']);
  });

  it('beholder det man allerede har svaret', () => {
    const tjek = saetStatus(nytPakAfTjek(treItems, 'let', NU), 'u-2', 'i_stykker');
    const synkroniseret = synkroniserLinjer(tjek, [...treItems, item('u-4')]);

    expect(statusFor(synkroniseret, 'u-2')).toBe('i_stykker');
  });
});

describe('linjer', () => {
  const tjek = nytPakAfTjek(treItems, 'let', NU);

  it('skriver en status uden at røre de andre linjer', () => {
    const nyt = saetStatus(tjek, 'u-2', 'ubrugt');

    expect(statusFor(nyt, 'u-2')).toBe('ubrugt');
    expect(statusFor(nyt, 'u-1')).toBe('brugt');
    expect(statusFor(tjek, 'u-2')).toBe('brugt');
  });

  // Gear kan komme på pakkelisten efter tjekket blev lavet uden at nogen har
  // synkroniseret imellem.
  it('lægger en linje til for gear tjekket ikke kender', () => {
    const nyt = saetStatus(tjek, 'u-ukendt', 'i_stykker');

    expect(nyt.linjer).toHaveLength(4);
    expect(statusFor(nyt, 'u-ukendt')).toBe('i_stykker');
  });

  it('regner ukendt gear som brugt indtil nogen siger andet', () => {
    expect(statusFor(tjek, 'findes-ikke')).toBe('brugt');
  });

  it('gemmer noter pr. linje', () => {
    const nyt = saetLinjenoter(tjek, 'u-1', 'hullet i bunden');
    expect(noterFor(nyt, 'u-1')).toBe('hullet i bunden');
  });

  // Ellers bar et let tjek rundt på et felt det aldrig har brugt.
  it('fjerner notefeltet igen når noten tømmes', () => {
    const skrevet = saetLinjenoter(tjek, 'u-1', 'noget');
    const tømt = saetLinjenoter(skrevet, 'u-1', '   ');

    expect(noterFor(tømt, 'u-1')).toBe('');
    expect(tømt.linjer.find((l) => l.item_uid === 'u-1')).not.toHaveProperty('noter');
  });

  it('lader en status overleve at noten rettes', () => {
    const nyt = saetLinjenoter(saetStatus(tjek, 'u-1', 'i_stykker'), 'u-1', 'lynlåsen gik');

    expect(statusFor(nyt, 'u-1')).toBe('i_stykker');
    expect(noterFor(nyt, 'u-1')).toBe('lynlåsen gik');
  });
});

describe('kategorinoter', () => {
  const tjek = nytPakAfTjek(treItems, 'grundig', NU);

  it('er der ingen af til at begynde med', () => {
    expect(tjek.kategori_noter).toBeUndefined();
    expect(kategoriNoteFor(tjek, 'Køkken')).toBeNull();
  });

  it('opretter en note første gang der skrives i den', () => {
    const nyt = saetKategoriNote(tjek, 'Køkken', { vurdering: 'for_meget' });

    expect(kategoriNoteFor(nyt, 'Køkken')).toEqual({
      kategori: 'Køkken',
      vurdering: 'for_meget',
      noter: ''
    });
  });

  it('retter en note der allerede findes frem for at lægge en ny ved siden af', () => {
    const en = saetKategoriNote(tjek, 'Køkken', { vurdering: 'for_meget' });
    const to = saetKategoriNote(en, 'Køkken', { noter: 'to gryder er én for meget' });

    expect(to.kategori_noter).toHaveLength(1);
    expect(kategoriNoteFor(to, 'Køkken')).toEqual({
      kategori: 'Køkken',
      vurdering: 'for_meget',
      noter: 'to gryder er én for meget'
    });
  });

  // Noterne er dyrere at skrive end at bære rundt på.
  it('beholder noterne når niveauet skifter tilbage til let', () => {
    const medNote = saetKategoriNote(tjek, 'Køkken', { noter: 'husk kaffe' });
    const let_ = saetNiveau(medNote, 'let');

    expect(let_.niveau).toBe('let');
    expect(kategoriNoteFor(let_, 'Køkken')?.noter).toBe('husk kaffe');
  });
});

describe('kategorierPaaTur', () => {
  it('følger den gruppering pakkelisten i forvejen har', () => {
    const koekken = lavGruppe({ uid: 'g-1', navn: 'Køkken', item_ids: ['u-1', 'u-2'] });
    const tur = lavTur({ gruppe_ids: ['g-1'], loese_item_ids: ['u-3'] });

    expect(kategorierPaaTur(tur, [koekken], treItems)).toEqual(['Køkken', 'Løse items']);
  });
});

describe('opsummering og resumé', () => {
  const blandet = (): PakAfTjek => {
    let tjek = nytPakAfTjek(treItems, 'let', NU);
    tjek = saetStatus(tjek, 'u-2', 'ubrugt');
    tjek = saetStatus(tjek, 'u-3', 'i_stykker');
    return tjek;
  };

  it('tæller de tre udfald', () => {
    expect(opsummering(blandet())).toEqual({ brugt: 1, ubrugt: 1, i_stykker: 1 });
  });

  it('skriver kun det der er noget af', () => {
    expect(resumetekst(blandet())).toBe('1 brugt · 1 ubrugt · 1 i stykker');
    expect(resumetekst(nytPakAfTjek(treItems, 'let', NU))).toBe('3 brugt');
  });

  it('bøjer ubrugt i flertal', () => {
    let tjek = nytPakAfTjek(treItems, 'let', NU);
    tjek = saetStatus(tjek, 'u-1', 'ubrugt');
    tjek = saetStatus(tjek, 'u-2', 'ubrugt');

    expect(resumetekst(tjek)).toBe('1 brugt · 2 ubrugte');
  });

  it('siger det ligeud når der intet var på listen', () => {
    expect(resumetekst(nytPakAfTjek([], 'let', NU))).toBe('Intet gear på listen');
  });
});

describe('brugPrItem', () => {
  const gjortOp = (status: 'brugt' | 'ubrugt' | 'i_stykker', uid = 'u-1') =>
    lavTur({
      pak_af_tjek: {
        udfyldt_dato: NU.toISOString(),
        niveau: 'let',
        linjer: [{ item_uid: uid, status }]
      }
    });

  it('tæller brugte gange ud af de ture der er gjort op', () => {
    const ture = [gjortOp('brugt'), gjortOp('brugt'), gjortOp('ubrugt')];

    expect(brugPrItem(ture).get('u-1')).toEqual({ gjort_op: 3, brugt: 2, i_stykker: 0 });
  });

  // En tur uden pak-af-tjek ved ingenting om gearet. Talte den som ubrugt,
  // ville alt gear se ud som hyldevarer indtil man havde gjort alt op.
  it('ser bort fra ture der aldrig er gjort op', () => {
    const ture = [gjortOp('brugt'), lavTur({ loese_item_ids: ['u-1'] })];

    expect(brugPrItem(ture).get('u-1')).toEqual({ gjort_op: 1, brugt: 1, i_stykker: 0 });
  });

  it('tæller skader for sig', () => {
    expect(brugPrItem([gjortOp('i_stykker')]).get('u-1'))
      .toEqual({ gjort_op: 1, brugt: 0, i_stykker: 1 });
  });

  it('kender ikke gear der aldrig har stået på et tjek', () => {
    expect(brugPrItem([gjortOp('brugt')]).get('u-2')).toBeUndefined();
  });
});

describe('manglerPakAfTjek', () => {
  it('gælder en afsluttet tur uden opgørelse', () => {
    expect(manglerPakAfTjek(lavTur({ status: 'afsluttet' }))).toBe(true);
  });

  it('gælder ikke en tur der er gjort op', () => {
    const tur = lavTur({
      status: 'afsluttet',
      pak_af_tjek: { udfyldt_dato: NU.toISOString(), niveau: 'let', linjer: [] }
    });

    expect(manglerPakAfTjek(tur)).toBe(false);
  });

  it('gælder ikke ture der ikke er slut endnu', () => {
    expect(manglerPakAfTjek(lavTur({ status: 'kladde' }))).toBe(false);
    expect(manglerPakAfTjek(lavTur({ status: 'klar' }))).toBe(false);
    expect(manglerPakAfTjek(lavTur({ status: 'aktiv' }))).toBe(false);
  });
});

describe('dageSidenSlut', () => {
  it('tæller dage fra slutdatoen', () => {
    expect(dageSidenSlut(lavTur({ slutdato: '2026-07-25' }), NU)).toBe(5);
    expect(dageSidenSlut(lavTur({ slutdato: '2026-07-30' }), NU)).toBe(0);
  });

  it('giver et negativt tal når slutdatoen ligger forude', () => {
    expect(dageSidenSlut(lavTur({ slutdato: '2026-08-02' }), NU)).toBe(-3);
  });

  it('falder tilbage på startdatoen når der ingen slutdato er', () => {
    expect(dageSidenSlut(lavTur({ startdato: '2026-07-28', slutdato: '' }), NU)).toBe(2);
  });

  it('giver null når turen ingen datoer har', () => {
    expect(dageSidenSlut(lavTur({ startdato: '', slutdato: '' }), NU)).toBeNull();
  });
});
