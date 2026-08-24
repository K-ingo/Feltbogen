import { describe, it, expect } from 'vitest';
import {
  MAKS_KANT,
  beregnMaal,
  billederPaaTur,
  erBillede,
  filstoerrelse,
  hero,
  kanVises,
  optagetid,
  usendte
} from './billeder';
import { lavBillede, lavTur } from './test/data';

describe('beregnMaal', () => {
  it('skalerer den længste kant ned og holder forholdet', () => {
    expect(beregnMaal(4000, 3000, 1600)).toEqual({ bredde: 1600, hoejde: 1200 });
    expect(beregnMaal(3000, 4000, 1600)).toEqual({ bredde: 1200, hoejde: 1600 });
  });

  // Et lille billede bliver ikke bedre af at blive gjort stort — kun tungere.
  it('forstørrer ikke et billede der allerede er mindre', () => {
    expect(beregnMaal(800, 600, 1600)).toEqual({ bredde: 800, hoejde: 600 });
    expect(beregnMaal(1600, 900, 1600)).toEqual({ bredde: 1600, hoejde: 900 });
  });

  // Et meget aflangt panorama må ikke ende med en kant på nul pixels.
  it('lader ingen kant blive nul', () => {
    expect(beregnMaal(10000, 30, 1600).hoejde).toBeGreaterThanOrEqual(1);
  });

  it('klarer et billede uden mål', () => {
    expect(beregnMaal(0, 0)).toEqual({ bredde: 0, hoejde: 0 });
  });

  it('bruger 1600 px som standard', () => {
    expect(beregnMaal(3200, 1600)).toEqual({ bredde: MAKS_KANT, hoejde: 800 });
  });
});

describe('erBillede', () => {
  it('kender et billede fra alt andet', () => {
    expect(erBillede('image/jpeg')).toBe(true);
    expect(erBillede('image/heic')).toBe(true);
    expect(erBillede('application/pdf')).toBe(false);
    expect(erBillede('')).toBe(false);
  });
});

describe('filstoerrelse', () => {
  it('skriver størrelsen som man læser den', () => {
    expect(filstoerrelse(820)).toBe('820 B');
    expect(filstoerrelse(2048)).toBe('2 kB');
    expect(filstoerrelse(2_516_582)).toBe('2,4 MB');
  });
});

describe('optagetid', () => {
  const nu = new Date('2026-08-01T10:00:00Z');

  it('bruger filens eget tidsstempel', () => {
    const fil = new File([], 'a.jpg', { lastModified: Date.parse('2026-07-11T18:30:00Z') });
    expect(optagetid(fil, nu)).toBe('2026-07-11T18:30:00.000Z');
  });

  // En blob fra fx udklipsholderen har ingen lastModified.
  it('falder tilbage på nu når filen ikke ved det', () => {
    expect(optagetid(new Blob([]), nu)).toBe(nu.toISOString());
    expect(optagetid(new File([], 'a.jpg', { lastModified: 0 }), nu)).toBe(nu.toISOString());
  });
});

describe('billederPaaTur', () => {
  it('tager turens egne, kronologisk', () => {
    const billeder = [
      lavBillede({ uid: 'b-2', tur_uid: 't-1', tid: '2026-07-11T08:00:00Z' }),
      lavBillede({ uid: 'b-1', tur_uid: 't-1', tid: '2026-07-10T08:00:00Z' }),
      lavBillede({ uid: 'b-x', tur_uid: 't-2', tid: '2026-07-09T08:00:00Z' })
    ];

    expect(billederPaaTur(billeder, 't-1').map((b) => b.uid)).toEqual(['b-1', 'b-2']);
  });

  // To billeder taget i samme sekund skal stå i en fast rækkefølge, ellers
  // hopper galleriet rundt mellem to tegninger.
  it('har en stabil rækkefølge ved samme tid', () => {
    const billeder = [
      lavBillede({ uid: 'b-b', tur_uid: 't-1', tid: '2026-07-10T08:00:00Z' }),
      lavBillede({ uid: 'b-a', tur_uid: 't-1', tid: '2026-07-10T08:00:00Z' })
    ];

    expect(billederPaaTur(billeder, 't-1').map((b) => b.uid)).toEqual(['b-a', 'b-b']);
  });

  it('giver ingenting for en tur uden billeder', () => {
    expect(billederPaaTur([], 't-1')).toEqual([]);
  });
});

describe('hero', () => {
  const billeder = [
    lavBillede({ uid: 'b-1', tur_uid: 't-1', tid: '2026-07-10T08:00:00Z' }),
    lavBillede({ uid: 'b-2', tur_uid: 't-1', tid: '2026-07-11T08:00:00Z' })
  ];

  it('tager det valgte forsidebillede', () => {
    const tur = lavTur({ uid: 't-1', hero_billede: 'b-2' });
    expect(hero(billeder, tur)?.uid).toBe('b-2');
  });

  it('falder tilbage på det ældste når intet er valgt', () => {
    expect(hero(billeder, lavTur({ uid: 't-1', hero_billede: '' }))?.uid).toBe('b-1');
  });

  // Forsidebilledet kan være slettet på en anden enhed.
  it('falder tilbage når valget peger på noget der ikke findes', () => {
    const tur = lavTur({ uid: 't-1', hero_billede: 'b-væk' });
    expect(hero(billeder, tur)?.uid).toBe('b-1');
  });

  it('giver intet når turen ingen billeder har', () => {
    expect(hero(billeder, lavTur({ uid: 't-tom' }))).toBeNull();
  });
});

describe('kanVises', () => {
  it('kan vise det der ligger på enheden, også uden dækning', () => {
    const lokalt = lavBillede({ blob: new Blob(['x']), url: '' });
    expect(kanVises(lokalt, false)).toBe(true);
  });

  it('kan ikke vise et billede der kun er en url, når nettet er væk', () => {
    const fjernt = lavBillede({ blob: null, url: 'https://eksempel/x.jpg' });

    expect(kanVises(fjernt, true)).toBe(true);
    expect(kanVises(fjernt, false)).toBe(false);
  });

  it('kan ikke vise et billede der hverken har blob eller url', () => {
    expect(kanVises(lavBillede({ blob: null, url: '' }))).toBe(false);
  });
});

describe('usendte', () => {
  // Uden url er billedet ikke nået op, og så ligger det kun ét sted.
  it('tæller dem der endnu ikke er nået op', () => {
    const billeder = [
      lavBillede({ url: 'https://eksempel/a.jpg' }),
      lavBillede({ url: '' }),
      lavBillede({ url: '' })
    ];

    expect(usendte(billeder)).toBe(2);
    expect(usendte([])).toBe(0);
  });
});
