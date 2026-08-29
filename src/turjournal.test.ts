import { describe, it, expect } from 'vitest';
import { journalen, dagnummer, antalSkribenter, nytBidrag, skrivBidrag } from './turjournal';
import type { Gaestesnapshot } from './gaest';
import type { Deltagelse } from './deltagelse';

const snapshot = (over: Partial<Gaestesnapshot> = {}): Gaestesnapshot => ({
  version: 5, navn: 'Rold Skov', sted: '', koordinater: null,
  startdato: '2026-09-18', slutdato: '2026-09-20', naetter: 2, personer: 3,
  baereafstand_km: 0, besked_fra_ejer: '', ejer: 'Emil', deltagere: [], vejr: null,
  afsnit: [], billeder: [], journal: [], vaegt_i_alt_g: 0,
  delt_den: '2026-09-17T10:00:00.000Z', ...over
});

const deltager = (navn: string, journal: { id: string; tid: string; tekst: string; billeder: string[] }[], user = navn): Deltagelse => ({
  pb_id: `d-${user}`, tur: 'pb-tur', user, navn, medbragt: [], baerer: [], journal, billedfiler: []
});

describe('dagnummer', () => {
  it('tæller fra turens første dag', () => {
    expect(dagnummer('2026-09-18', '2026-09-18')).toBe(1);
    expect(dagnummer('2026-09-18', '2026-09-19')).toBe(2);
    expect(dagnummer('2026-09-18', '2026-09-20')).toBe(3);
  });

  // En indgang fra før afgang er ikke "dag 0" — den er bare ikke på turen
  // endnu, og så er der ikke noget nummer at give den.
  it('giver ikke et nummer til noget der ligger før turen', () => {
    expect(dagnummer('2026-09-18', '2026-09-15')).toBe(0);
  });

  it('giver ikke et nummer når datoerne ikke kan læses', () => {
    expect(dagnummer('', '2026-09-19')).toBe(0);
    expect(dagnummer('2026-09-18', '')).toBe(0);
    expect(dagnummer('i september', '2026-09-19')).toBe(0);
  });
});

describe('journalen', () => {
  it('lægger ejerens og deltagernes indgange sammen', () => {
    const s = snapshot({ journal: [
      { id: 'e1', tid: '2026-09-18T18:00:00.000Z', tekst: 'Slog lejr.', skrevet_af: '' }
    ]});
    const d = [deltager('Jakob', [
      { id: 'j1', tid: '2026-09-19T11:26:00.000Z', tekst: 'Sindssygt flot udsigt herfra.', billeder: [] }
    ])];

    const dage = journalen(s, d, undefined, s.ejer);

    // Nyeste dag først.
    expect(dage.map((x) => x.nummer)).toEqual([2, 1]);
    expect(dage[0].indgange[0].navn).toBe('Jakob');
    expect(dage[1].indgange[0].navn).toBe('Emil');
  });

  it('sorterer inden for dagen i den rækkefølge det skete', () => {
    const d = [deltager('Jakob', [
      { id: 'b', tid: '2026-09-19T15:00:00.000Z', tekst: 'Sent', billeder: [] },
      { id: 'a', tid: '2026-09-19T08:00:00.000Z', tekst: 'Tidligt', billeder: [] }
    ])];

    expect(journalen(snapshot(), d)[0].indgange.map((i) => i.tekst)).toEqual(['Tidligt', 'Sent']);
  });

  it('markerer ens egne indgange, og kun dem', () => {
    const d = [
      deltager('Jakob', [{ id: 'j1', tid: '2026-09-19T11:00:00.000Z', tekst: 'Min', billeder: [] }], 'u-jakob'),
      deltager('Sofie', [{ id: 's1', tid: '2026-09-19T12:00:00.000Z', tekst: 'Hendes', billeder: [] }], 'u-sofie')
    ];

    const indgange = journalen(snapshot(), d, 'u-jakob')[0].indgange;
    expect(indgange.find((i) => i.tekst === 'Min')?.min).toBe(true);
    expect(indgange.find((i) => i.tekst === 'Hendes')?.min).toBe(false);
  });

  // Ejerens egne indgange kan aldrig rettes af en gæst: de står i et frosset
  // snapshot, ikke i noget hun har adgang til.
  it('markerer aldrig ejerens indgange som ens egne', () => {
    const s = snapshot({ journal: [{ id: 'e1', tid: '2026-09-18T18:00:00.000Z', tekst: 'Ejerens', skrevet_af: '' }] });
    expect(journalen(s, [], 'u-jakob')[0].indgange[0].min).toBe(false);
  });

  it('bruger ejerens navn, så hendes indgange ikke står uden afsender', () => {
    const s = snapshot({ journal: [{ id: 'e1', tid: '2026-09-18T18:00:00.000Z', tekst: 'Slog lejr.', skrevet_af: '' }] });
    expect(journalen(s, [], undefined, s.ejer)[0].indgange[0].navn).toBe('Emil');
  });

  it('er tom når ingen har skrevet noget', () => {
    expect(journalen(snapshot(), [])).toEqual([]);
  });

  // Ture gemt før journalen kom med i snapshottet har slet ikke feltet.
  it('tåler et snapshot fra før journalen fandtes', () => {
    const gammelt = { ...snapshot(), journal: undefined } as unknown as Gaestesnapshot;
    expect(journalen(gammelt, [])).toEqual([]);
  });
});

describe('antalSkribenter', () => {
  it('tæller hvor mange der har skrevet med', () => {
    const s = snapshot({ journal: [{ id: 'e1', tid: '2026-09-18T18:00:00.000Z', tekst: 'Ejerens', skrevet_af: '' }] });
    const d = [deltager('Jakob', [{ id: 'j1', tid: '2026-09-19T11:00:00.000Z', tekst: 'Hans', billeder: [] }])];

    expect(antalSkribenter(journalen(s, d, undefined, s.ejer))).toBe(2);
    expect(antalSkribenter(journalen(snapshot(), []))).toBe(0);
  });
});

describe('nytBidrag', () => {
  it('trimmer teksten og sætter tiden', () => {
    const b = nytBidrag('  Sindssygt flot  ', [], new Date('2026-09-19T11:26:00.000Z'));
    expect(b.tekst).toBe('Sindssygt flot');
    expect(b.tid).toBe('2026-09-19T11:26:00.000Z');
  });

  // Uden et stabilt id kunne den samme indgang komme op to gange, hvis den
  // blev sendt igen efter en fejlet skrivning.
  it('giver hver indgang sit eget id', () => {
    expect(nytBidrag('a').id).not.toBe(nytBidrag('a').id);
  });

  it('bærer billedernes filnavne med', () => {
    expect(nytBidrag('a', ['en.jpg', 'to.jpg']).billeder).toEqual(['en.jpg', 'to.jpg']);
    expect(nytBidrag('a').billeder).toEqual([]);
  });
});

describe('skrivBidrag', () => {
  const min = (over: Partial<Deltagelse> = {}): Deltagelse => ({
    pb_id: 'd1', tur: 'pb-tur', user: 'u1', navn: 'Jakob',
    medbragt: [], baerer: [], journal: [], billedfiler: [], ...over
  });
  const fil = () => new File(['x'], 'billede.jpg', { type: 'image/jpeg' });

  it('skriver teksten når der ikke er billeder', async () => {
    const sendt: Deltagelse[] = [];
    const svar = await skrivBidrag(min(), 'Rimfrost', [], async (d) => { sendt.push(d); return d; });

    expect(svar).toBe('ok');
    expect(sendt).toHaveLength(1);
    expect(sendt[0].journal[0].tekst).toBe('Rimfrost');
  });

  // Serveren bestemmer selv filnavnene, så indgangen kan først pege på dem,
  // når uploaden er sket.
  it('sender filerne først og lader indgangen pege på navnene', async () => {
    const kald: { antalFiler: number }[] = [];
    const svar = await skrivBidrag(min(), 'Udsigt', [fil()], async (d, filer) => {
      kald.push({ antalFiler: filer.length });
      return filer.length > 0 ? { ...d, billedfiler: ['billede_ab12.jpg'] } : d;
    });

    expect(svar).toBe('ok');
    expect(kald.map((k) => k.antalFiler)).toEqual([1, 0]);
  });

  it('tæller kun de billeder med, som kom til ved den her skrivning', async () => {
    let skrevet: Deltagelse | null = null;
    await skrivBidrag(min({ billedfiler: ['gammelt.jpg'] }), 'Nyt', [fil()], async (d, filer) => {
      if (filer.length > 0) return { ...d, billedfiler: ['gammelt.jpg', 'nyt_cd34.jpg'] };
      skrevet = d;
      return d;
    });

    expect(skrevet!.journal[0].billeder).toEqual(['nyt_cd34.jpg']);
  });

  // Mangler billeder-feltet i PocketBase, dropper serveren filerne og svarer
  // 200. Teksten skal stadig op, og det skal siges, at billederne ikke kom.
  it('siger til, når teksten kom op men billederne ikke gjorde', async () => {
    const svar = await skrivBidrag(min(), 'Udsigt', [fil()], async (d) => d);
    expect(svar).toBe('kun_tekst');
  });

  // En note, man har skrevet i felten, skal ikke gå tabt, fordi et billede
  // ikke ville op.
  it('skriver teksten alligevel, når uploaden fejler', async () => {
    let skrevet: Deltagelse | null = null;
    const svar = await skrivBidrag(min(), 'Udsigt', [fil()], async (d, filer) => {
      if (filer.length > 0) return null;
      skrevet = d;
      return d;
    });

    expect(svar).toBe('kun_tekst');
    expect(skrevet!.journal[0].tekst).toBe('Udsigt');
  });

  it('svarer fejl, når selve skrivningen ikke lykkes', async () => {
    expect(await skrivBidrag(min(), 'Udsigt', [], async () => null)).toBe('fejl');
  });
});
