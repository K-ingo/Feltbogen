import type { ItemStatus } from './db';
import { opretItem, opretTur } from './sync';

// Tomme poster med fornuftige standardværdier. De ligger her, fordi både
// listeskærmene og dashboardet opretter gear og ture — en post skal se ens ud
// uanset hvor man startede den fra.

export function opretTomtItem(status: ItemStatus = 'ejer'): Promise<number> {
  const nu = new Date();
  return opretItem({
    navn: '',
    vaegt_g: 0,
    pris_kr: 0,
    dimensioner: '',
    antal: 1,
    delt: false,
    status,
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
    aendret: nu
  });
}

export function opretTomTur(): Promise<number> {
  const nu = new Date();
  const idag = nu.toISOString().slice(0, 10);

  return opretTur({
    navn: '',
    sted: '',
    koordinater: null,
    startdato: idag,
    slutdato: idag,
    naetter: 0,
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
    aendret: nu
  });
}
