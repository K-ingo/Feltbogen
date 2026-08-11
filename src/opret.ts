import type { ItemStatus, Sted, Person } from './db';
import { opretItem, opretGruppe, opretTur, opretSted, opretPerson } from './sync';
import { mitNavn } from './pb';

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
    udlaan: null,
    laant_af: null,
    vedligehold: [],
    noter: '',
    oprettet: nu,
    aendret: nu
  });
}

export function opretTomGruppe(): Promise<number> {
  const nu = new Date();
  return opretGruppe({
    navn: '',
    tags: [],
    item_ids: [],
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
    sted_uid: '',
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
    // Den der opretter turen skal selv med på den. Uden det stod ejeren ikke
    // på sin egen deltagerliste, og hendes eget grej kunne ikke fordeles.
    deltagere: [{
      id: crypto.randomUUID(),
      navn: mitNavn(),
      overnatning: null,
      personligt_gear_ids: [],
      baerer_delt_ids: [],
      person_uid: ''
    }],
    budget_linjer: [],
    pak_af_tjek: null,
    afgangs_tjek: null,
    feltnoter: [],
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
    aendret: nu
  });
}

// Steder og personer oprettes ofte med et navn i hånden — fra stedsøgningen
// på en tur, eller fra deltagerfeltet. Derfor tager de begge et navn med.
export function opretTomtSted(felter: Partial<Sted> = {}): Promise<number> {
  const nu = new Date();
  return opretSted({
    navn: '',
    koordinater: null,
    adresse: '',
    tags: [],
    noter: '',
    oprettet: nu,
    aendret: nu,
    ...felter
  });
}

export function opretTomPerson(felter: Partial<Person> = {}): Promise<number> {
  const nu = new Date();
  return opretPerson({
    navn: '',
    email: '',
    standard_overnatning: null,
    noter: '',
    oprettet: nu,
    aendret: nu,
    ...felter
  });
}
