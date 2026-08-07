import type { Item, Gruppe, Tur, Sted, Person } from '../db';

// Fabrikker til testdata. Kun det en test bryder sig om angives; resten får
// harmløse standardværdier. Hver post får et uid, ligesom opret() ville give
// den — referencer mellem poster bruger uid, ikke lokale id'er.

export function lavItem(felter: Partial<Item> = {}): Item {
  const nu = new Date('2026-07-01T12:00:00Z');
  return {
    uid: crypto.randomUUID(),
    navn: 'Testitem',
    vaegt_g: 100,
    pris_kr: 200,
    dimensioner: '',
    antal: 1,
    delt: false,
    status: 'ejer',
    tags: [],
    kraever: [],
    komplementer: [],
    koebt_hos: '',
    koebsdato: '',
    koebslink: '',
    ordrenummer: '',
    garanti: null,
    udlaan: null,
    laant_af: null,
    noter: '',
    oprettet: nu,
    aendret: nu,
    ...felter
  };
}

export function lavGruppe(felter: Partial<Gruppe> = {}): Gruppe {
  const nu = new Date('2026-07-01T12:00:00Z');
  return {
    uid: crypto.randomUUID(),
    navn: 'Testgruppe',
    tags: [],
    item_ids: [],
    noter: '',
    oprettet: nu,
    aendret: nu,
    ...felter
  };
}

export function lavSted(felter: Partial<Sted> = {}): Sted {
  const nu = new Date('2026-07-01T12:00:00Z');
  return {
    uid: crypto.randomUUID(),
    navn: 'Teststed',
    koordinater: { lat: 56.8, lng: 9.9 },
    adresse: '',
    tags: [],
    noter: '',
    oprettet: nu,
    aendret: nu,
    ...felter
  };
}

export function lavPerson(felter: Partial<Person> = {}): Person {
  const nu = new Date('2026-07-01T12:00:00Z');
  return {
    uid: crypto.randomUUID(),
    navn: 'Testperson',
    email: '',
    standard_overnatning: null,
    noter: '',
    oprettet: nu,
    aendret: nu,
    ...felter
  };
}

export function lavTur(felter: Partial<Tur> = {}): Tur {
  const nu = new Date('2026-07-01T12:00:00Z');
  return {
    uid: crypto.randomUUID(),
    navn: 'Testtur',
    sted: '',
    sted_uid: '',
    koordinater: null,
    startdato: '2026-07-10',
    slutdato: '2026-07-12',
    naetter: 2,
    personer: 1,
    overnatning: 'shelter',
    aktivitet: 'bushcraft',
    terraen: 'skov',
    baereafstand_km: 0,
    erfaring: 'oevet',
    status: 'kladde',
    gruppe_ids: [],
    loese_item_ids: [],
    deltagere: [],
    budget_linjer: [],
    pak_af_tjek: null,
    afgangs_tjek: null,
    besked_fra_ejer: '',
    noter: '',
    vejrsnapshot: '',
    dele_token: '',
    dele_snapshot: '',
    turkort_token: '',
    turkort_retur: '',
    turkort_besked: '',
    turkort_snapshot: '',
    oprettet: nu,
    aendret: nu,
    ...felter
  };
}
