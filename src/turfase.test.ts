import { describe, it, expect } from 'vitest';
import { turfase } from './turfase';
import { lavItem, lavGruppe, lavTur } from './test/data';

// En kladde der ikke mangler noget: datoer, sted, grej, og alene afsted.
function heltur() {
  const oekse = lavItem({ navn: 'Økse' });
  const tur = lavTur({
    startdato: '2026-08-01',
    slutdato: '2026-08-03',
    sted: 'Mols Bjerge',
    personer: 1,
    loese_item_ids: [oekse.uid]
  });
  return { tur, oekse };
}

// Manglerne bærer både en tekst og et sted, de kan rettes. Teksterne trækkes
// ud, hvor det kun er dem, en test handler om.
const tekster = (fase: { mangler: { tekst: string }[] }) => fase.mangler.map((m) => m.tekst);

describe('turfase', () => {
  it('fører en kladde videre til klar', () => {
    const { tur } = heltur();
    const fase = turfase(tur, []);

    expect(fase.fase).toBe('kladde');
    expect(fase.naeste).toEqual({ slags: 'status', til: 'klar', label: 'Markér som klar' });
    expect(fase.mangler).toEqual([]);
  });

  it('fører klar videre til aktiv, og aktiv til afsluttet', () => {
    expect(turfase(lavTur({ status: 'klar' }), []).naeste).toMatchObject({ til: 'aktiv' });
    expect(turfase(lavTur({ status: 'aktiv' }), []).naeste).toMatchObject({ til: 'afsluttet' });
  });

  it('sender en afsluttet tur videre til pak-af-tjekket', () => {
    const fase = turfase(lavTur({ status: 'afsluttet' }), []);

    expect(fase.fase).toBe('afsluttet');
    expect(fase.naeste).toEqual({ slags: 'pak_af_tjek', label: 'Lav pak-af-tjek' });
  });

  it('regner en tur med pak-af-tjek som gjort op', () => {
    const tur = lavTur({
      status: 'afsluttet',
      pak_af_tjek: { udfyldt_dato: '2026-08-04', niveau: 'let', linjer: [] }
    });
    const fase = turfase(tur, []);

    expect(fase.fase).toBe('evalueret');
    expect(fase.navn).toBe('Gjort op');
    expect(fase.naeste).toEqual({ slags: 'pak_af_tjek', label: 'Se pak-af-tjek' });
  });

  it('har en begrundelse på hver fase', () => {
    for (const status of ['kladde', 'klar', 'aktiv', 'afsluttet'] as const) {
      expect(turfase(lavTur({ status }), []).begrundelse).not.toBe('');
    }
  });
});

describe('turfase — hvad en kladde mangler', () => {
  it('nævner manglende datoer', () => {
    const { tur } = heltur();
    expect(tekster(turfase({ ...tur, startdato: '', slutdato: '' }, []))).toContain('Ingen datoer');
    expect(tekster(turfase({ ...tur, slutdato: '' }, []))).toContain('Ingen slutdato');
  });

  it('nævner manglende sted', () => {
    const { tur } = heltur();
    expect(tekster(turfase({ ...tur, sted: '  ' }, []))).toContain('Intet sted');
  });

  it('nævner at der ikke er valgt grej', () => {
    const { tur } = heltur();
    expect(tekster(turfase({ ...tur, loese_item_ids: [] }, []))).toContain('Intet grej valgt');
  });

  it('tæller grej der kommer med via et grejsæt', () => {
    const oekse = lavItem({ navn: 'Økse' });
    const saet = lavGruppe({ item_ids: [oekse.uid] });
    const tur = lavTur({
      startdato: '2026-08-01', slutdato: '2026-08-03', sted: 'Mols',
      loese_item_ids: [], gruppe_ids: [saet.uid]
    });

    expect(tekster(turfase(tur, [saet]))).not.toContain('Intet grej valgt');
  });

  it('spørger til deltagerne når turen er sat til flere end én', () => {
    const { tur } = heltur();
    const mangler = turfase({ ...tur, personer: 3 }, []).mangler;

    expect(mangler.some((m) => m.tekst.includes('3 personer'))).toBe(true);
  });

  it('spørger ikke til deltagerne når man er afsted alene', () => {
    const { tur } = heltur();
    expect(turfase({ ...tur, personer: 1 }, []).mangler).toEqual([]);
  });

  it('lader turen gå videre selvom noget mangler', () => {
    // Manglerne er oplysninger, ikke en laas. Fundamentet: Feltbogen hjaelper,
    // men tvinger aldrig.
    const tom = lavTur({ startdato: '', slutdato: '', sted: '', loese_item_ids: [] });
    const fase = turfase(tom, []);

    expect(fase.mangler.length).toBeGreaterThan(0);
    expect(fase.naeste).toMatchObject({ slags: 'status', til: 'klar' });
  });
});

describe('turfase — det sidste inden afgang', () => {
  it('siger til når afgangs-tjekket ikke er taget i brug', () => {
    const fase = turfase(lavTur({ status: 'klar' }), []);
    expect(fase.mangler).toEqual([
      { tekst: 'Afgangs-tjekket er ikke taget i brug', maal: 'afgangstjek' }
    ]);
  });

  it('tæller hvor mange punkter der er tilbage', () => {
    const tur = lavTur({
      status: 'klar',
      afgangs_tjek: {
        linjer: [
          { id: 'a', tekst: 'Nøgler', afkrydset: true, fra_skabelon: false },
          { id: 'b', tekst: 'Telefon', afkrydset: false, fra_skabelon: false },
          { id: 'c', tekst: 'Bålforbud', afkrydset: false, fra_skabelon: false }
        ]
      }
    });

    expect(turfase(tur, []).mangler).toEqual([
      { tekst: 'Afgangs-tjek: 2 tilbage af 3', maal: 'afgangstjek' }
    ]);
  });

  it('siger ingenting når alt er krydset af', () => {
    const tur = lavTur({
      status: 'klar',
      afgangs_tjek: {
        linjer: [{ id: 'a', tekst: 'Nøgler', afkrydset: true, fra_skabelon: false }]
      }
    });

    expect(turfase(tur, []).mangler).toEqual([]);
  });

  it('nævner ingen mangler mens turen er i gang', () => {
    expect(turfase(lavTur({ status: 'aktiv' }), []).mangler).toEqual([]);
  });

  it('siger hvor meget der mangler i tasken', () => {
    const grej = [lavItem({ navn: 'Telt' }), lavItem({ navn: 'Sovepose' }), lavItem({ navn: 'Trangia' })];
    const tur = lavTur({
      status: 'klar',
      loese_item_ids: grej.map((i) => i.uid),
      pakkede_item_uids: [grej[0].uid]
    });

    expect(turfase(tur, []).mangler[0]).toEqual({
      tekst: 'Pakning: 2 af 3 mangler i tasken',
      // Pakkelisten og ikke pakke-fanen: det er dér, man krydser af.
      maal: 'pakkeliste'
    });
  });

  it('nævner ikke pakningen når alt er i tasken', () => {
    const grej = [lavItem({ navn: 'Telt' })];
    const tur = lavTur({
      status: 'klar',
      loese_item_ids: grej.map((i) => i.uid),
      pakkede_item_uids: grej.map((i) => i.uid)
    });

    expect(turfase(tur, []).mangler.some((m) => m.tekst.startsWith('Pakning'))).toBe(false);
  });

  it('nævner ikke pakningen når der ikke er valgt grej', () => {
    // Der er ingenting at pakke. Kladden har allerede sagt til om det.
    const tur = lavTur({ status: 'klar', loese_item_ids: [] });

    expect(tur.pakkede_item_uids).toEqual([]);
    expect(turfase(tur, []).mangler.some((m) => m.tekst.startsWith('Pakning'))).toBe(false);
  });

  it('sætter pakningen først — det er den der tager tid', () => {
    const grej = [lavItem({ navn: 'Telt' })];
    const tur = lavTur({
      status: 'klar',
      loese_item_ids: grej.map((i) => i.uid),
      afgangs_tjek: { linjer: [{ id: 'a', tekst: 'Nøgler', afkrydset: false, fra_skabelon: false }] }
    });

    const mangler = turfase(tur, []).mangler;
    expect(mangler).toHaveLength(2);
    expect(mangler[0].tekst).toContain('Pakning');
    expect(mangler[1].tekst).toContain('Afgangs-tjek');
  });
});
