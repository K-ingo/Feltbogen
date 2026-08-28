import { describe, it, expect } from 'vitest';
import { forslagTilTur, udenAfviste, tiltroAf } from './forslag';
import { lavGruppe, lavItem, lavTur } from './test/data';

describe('forslagTilTur', () => {
  it('giver ingen forslag uden en tur', () => {
    expect(forslagTilTur(null, [], [], [])).toEqual([]);
  });

  it('foreslår at kopiere en tidligere tur når der ikke er valgt grej endnu', () => {
    const oekse = lavItem({ navn: 'Økse' });
    const gammel = lavTur({
      navn: 'Sidste sommer',
      startdato: '2026-06-01',
      slutdato: '2026-06-03',
      status: 'afsluttet',
      loese_item_ids: [oekse.uid]
    });
    const ny = lavTur({ navn: 'Ny tur' });

    const kopi = forslagTilTur(ny, [], [oekse], [gammel]).find((f) => f.type === 'historik');

    expect(kopi?.titel).toBe('Pak ligesom Sidste sommer');
    expect(kopi?.begrundelse).not.toBe('');
    expect(kopi?.virkning).toEqual({ antal: 1 });
  });

  it('foreslår ikke at kopiere når turen allerede har grej', () => {
    const oekse = lavItem({ navn: 'Økse' });
    const gammel = lavTur({ navn: 'Sidste sommer', status: 'afsluttet', loese_item_ids: [oekse.uid] });
    const ny = lavTur({ loese_item_ids: [oekse.uid] });

    expect(forslagTilTur(ny, [], [oekse], [gammel]).some((f) => f.type === 'historik')).toBe(false);
  });

  it('foreslår et grejsæt hvis tags rammer turens', () => {
    const tur = lavTur({ overnatning: 'shelter', aktivitet: 'bushcraft' });
    const saet = lavGruppe({ navn: 'Shelter-sommer', tags: ['shelter', 'bushcraft'] });

    const gruppe = forslagTilTur(tur, [saet], [], []).find((f) => f.type === 'grej');

    expect(gruppe?.titel).toBe('Tag Shelter-sommer med');
    // Begge sættets tags ramte, så motoren er sikker på det.
    expect(gruppe?.tiltro).toBe('hoej');
    expect(gruppe?.virkning).toBeNull();
  });

  it('er mindre sikker på et sæt hvor kun ét ud af fire tags rammer', () => {
    const tur = lavTur({ overnatning: 'shelter', aktivitet: 'bushcraft', terraen: 'skov' });
    const saet = lavGruppe({ navn: 'Vinterkano', tags: ['shelter', 'kano', 'vinter', 'kyst'] });

    expect(forslagTilTur(tur, [saet], [], []).find((f) => f.type === 'grej')?.tiltro).toBe('lav');
  });

  it('foreslår ikke et grejsæt der allerede er på turen', () => {
    const saet = lavGruppe({ navn: 'Shelter-sommer', tags: ['shelter'] });
    const tur = lavTur({ overnatning: 'shelter', gruppe_ids: [saet.uid] });

    expect(forslagTilTur(tur, [saet], [], []).some((f) => f.type === 'grej')).toBe(false);
  });

  it('nævner kun vægten når der er noget at hente', () => {
    const tungt = lavItem({ navn: 'Stort telt', vaegt_g: 4000, tags: ['ly'] });
    const let_ = lavItem({ navn: 'Tarp', vaegt_g: 600, tags: ['ly'] });
    const tur = lavTur({ loese_item_ids: [tungt.uid] });

    const vaegt = forslagTilTur(tur, [], [tungt, let_], []).find((f) => f.type === 'vaegt');

    expect(vaegt?.titel).toBe('Lettere gear i skabet');
    expect(vaegt?.detalje).toContain('kg at hente');
    // Negativ: virkningen er den vej, vægten flytter sig.
    expect(vaegt?.virkning).toEqual({ vaegt_g: -3400, antal: 1 });
  });

  it('nævner ikke vægten når der ikke er et lettere alternativ', () => {
    const tungt = lavItem({ navn: 'Stort telt', vaegt_g: 4000, tags: ['ly'] });
    const tur = lavTur({ loese_item_ids: [tungt.uid] });

    expect(forslagTilTur(tur, [], [tungt], []).some((f) => f.type === 'vaegt')).toBe(false);
  });

  it('viser højst tre forslag', () => {
    const tungt = lavItem({ navn: 'Stort telt', vaegt_g: 4000, tags: ['ly'] });
    const let_ = lavItem({ navn: 'Tarp', vaegt_g: 600, tags: ['ly'] });
    const saet = lavGruppe({ navn: 'Shelter', tags: ['shelter', 'bushcraft', 'skov'] });
    const tur = lavTur({ loese_item_ids: [tungt.uid] });

    expect(forslagTilTur(tur, [saet], [tungt, let_], []).length).toBeLessThanOrEqual(3);
  });

  it('regner ikke gear man har solgt eller overvejer med', () => {
    const overvejet = lavItem({ navn: 'Ønsketelt', status: 'overvejer' });
    const tur = lavTur({ loese_item_ids: [overvejet.uid] });

    const gammel = lavTur({ navn: 'Sidste', status: 'afsluttet', loese_item_ids: [overvejet.uid] });
    expect(forslagTilTur(tur, [], [overvejet], [gammel]).some((f) => f.type === 'vaegt')).toBe(false);
  });
});

// Specens §13: samme input skal give samme output, og hvert forslag skal have
// en forklaring og to handlinger.
describe('forslagenes form', () => {
  const tungt = lavItem({ navn: 'Stort telt', vaegt_g: 4000, tags: ['ly'] });
  const let_ = lavItem({ navn: 'Tarp', vaegt_g: 600, tags: ['ly'] });
  const saet = lavGruppe({ navn: 'Shelter', tags: ['shelter'] });
  const tur = lavTur({ overnatning: 'shelter', loese_item_ids: [tungt.uid] });

  const alle = () => forslagTilTur(tur, [saet], [tungt, let_], []);

  it('giver de samme id-er ved to kald med de samme data', () => {
    expect(alle().map((f) => f.id)).toEqual(alle().map((f) => f.id));
  });

  it('binder id-et til det forslaget handler om', () => {
    const forslag = alle();
    expect(forslag.find((f) => f.type === 'grej')?.id).toBe(`grej:${saet.uid}`);
    expect(forslag.find((f) => f.type === 'vaegt')?.id).toBe(`vaegt:${tungt.uid}`);
  });

  it('har en forklaring og to handlinger på hvert forslag', () => {
    const forslag = alle();
    expect(forslag.length).toBeGreaterThan(0);

    for (const f of forslag) {
      expect(f.begrundelse).not.toBe('');
      expect(f.handling.tag_imod).not.toBe('');
      expect(f.handling.afvis).not.toBe('');
    }
  });
});

describe('tiltroAf', () => {
  it('kræver to tredjedele for at være sikker', () => {
    expect(tiltroAf(1)).toBe('hoej');
    expect(tiltroAf(2 / 3)).toBe('hoej');
    expect(tiltroAf(0.6)).toBe('mellem');
    expect(tiltroAf(1 / 3)).toBe('mellem');
    expect(tiltroAf(0.25)).toBe('lav');
    expect(tiltroAf(0)).toBe('lav');
  });
});

describe('fordelingsforslag', () => {
  const deltager = (navn: string, baerer: string[] = []) => ({
    id: navn.toLowerCase(),
    navn,
    overnatning: null,
    personligt_gear_ids: [],
    baerer_delt_ids: baerer,
    person_uid: ''
  });

  it('siger til når fælles grej ikke har en bærer', () => {
    const telt = lavItem({ navn: 'Telt', vaegt_g: 3000, delt: true });
    const tur = lavTur({
      loese_item_ids: [telt.uid],
      personer: 2,
      deltagere: [deltager('Emil'), deltager('Jakob')]
    });

    const f = forslagTilTur(tur, [], [telt], []).find((x) => x.type === 'fordeling');
    expect(f?.titel).toBe('Fælles grej uden en bærer');
    expect(f?.tiltro).toBe('hoej');
    // Vægten var der hele tiden — den stod bare ikke på nogens ryg.
    expect(f?.virkning).toEqual({ antal: 1 });
  });

  it('siger til når den ene bærer det hele', () => {
    const telt = lavItem({ navn: 'Telt', vaegt_g: 3000, delt: true });
    const kogegrej = lavItem({ navn: 'Kogegrej', vaegt_g: 800, delt: true });
    const tur = lavTur({
      loese_item_ids: [telt.uid, kogegrej.uid],
      personer: 2,
      deltagere: [deltager('Emil', [telt.uid, kogegrej.uid]), deltager('Jakob')]
    });

    const f = forslagTilTur(tur, [], [telt, kogegrej], []).find((x) => x.type === 'fordeling');
    expect(f?.titel).toBe('Rygsækkene er skæve');
    expect(f?.virkning?.vaegt_g).toBe(-800);
    expect(f?.begrundelse).not.toBe('');
  });

  it('siger ingenting når fordelingen er jævn', () => {
    const a = lavItem({ navn: 'Telt', vaegt_g: 2000, delt: true });
    const b = lavItem({ navn: 'Tarp', vaegt_g: 2000, delt: true });
    const tur = lavTur({
      loese_item_ids: [a.uid, b.uid],
      personer: 2,
      deltagere: [deltager('Emil', [a.uid]), deltager('Jakob', [b.uid])]
    });

    expect(forslagTilTur(tur, [], [a, b], []).some((f) => f.type === 'fordeling')).toBe(false);
  });
});

describe('udenAfviste', () => {
  const tungt = lavItem({ navn: 'Stort telt', vaegt_g: 4000, tags: ['ly'] });
  const let_ = lavItem({ navn: 'Tarp', vaegt_g: 600, tags: ['ly'] });
  const tur = lavTur({ loese_item_ids: [tungt.uid] });

  it('sorterer et afvist forslag fra', () => {
    const forslag = forslagTilTur(tur, [], [tungt, let_], []);
    expect(forslag).toHaveLength(1);

    expect(udenAfviste(forslag, new Set([forslag[0].id]))).toEqual([]);
    expect(udenAfviste(forslag, new Set(['noget-andet']))).toEqual(forslag);
  });
});
