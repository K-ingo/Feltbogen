import type { Item, Gruppe, Tur } from '../db';

// Fabrikker til testdata. Kun det en test bryder sig om angives; resten får
// harmløse standardværdier.

export function lavItem(felter: Partial<Item> = {}): Item {
  const nu = new Date('2026-07-01T12:00:00Z');
  return {
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
    noter: '',
    oprettet: nu,
    aendret: nu,
    ...felter
  };
}

export function lavGruppe(felter: Partial<Gruppe> = {}): Gruppe {
  const nu = new Date('2026-07-01T12:00:00Z');
  return {
    navn: 'Testgruppe',
    tags: [],
    item_ids: [],
    noter: '',
    oprettet: nu,
    aendret: nu,
    ...felter
  };
}

export function lavTur(felter: Partial<Tur> = {}): Tur {
  const nu = new Date('2026-07-01T12:00:00Z');
  return {
    navn: 'Testtur',
    sted: '',
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
    besked_fra_ejer: '',
    noter: '',
    vejrsnapshot: '',
    oprettet: nu,
    aendret: nu,
    ...felter
  };
}
