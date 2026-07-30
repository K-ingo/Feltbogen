import Dexie from 'dexie';
import type { Table, Transaction } from 'dexie';

// Værdilisterne er kilden til både typerne og de knapper/dropdowns der viser
// dem, så en ny mulighed kun skal tilføjes ét sted.
export const ITEM_STATUS = ['ejer', 'overvejer', 'solgt'] as const;
export const TUR_STATUS = ['kladde', 'klar', 'aktiv', 'afsluttet'] as const;
export const OVERNATNING = ['haengekoeje', 'telt', 'shelter', 'blandet'] as const;
export const AKTIVITET = ['bushcraft', 'vandretur', 'kano', 'andet'] as const;
export const TERRAEN = ['skov', 'kyst', 'fjeld', 'mix'] as const;
export const ERFARING = ['begynder', 'oevet', 'erfaren'] as const;

export type ItemStatus = (typeof ITEM_STATUS)[number];
export type TurStatus = (typeof TUR_STATUS)[number];
export type Overnatning = (typeof OVERNATNING)[number];
export type Aktivitet = (typeof AKTIVITET)[number];
export type Terraen = (typeof TERRAEN)[number];
export type Erfaring = (typeof ERFARING)[number];

export interface Garanti {
  laengde_aar: number;
  udloeber_dato: string;
  paamindelse_dage: number;
}

// Alle poster lever lokalt først. pb_id sættes når posten er nået op i
// PocketBase — er den tom, er posten kun i IndexedDB endnu.
export interface Synkroniserbar {
  // Postens identitet på tværs af enheder. Tildeles ved oprettelse, så den
  // også findes offline — i modsætning til pb_id, der først kommer efter sync.
  // Dexies ++id kan ikke bruges: det tælles op pr. enhed og betyder derfor
  // noget forskelligt to steder.
  uid: string;
  pb_id?: string;
  // Sat mens der er lokale ændringer serveren ikke har kvitteret. Overlever en
  // genstart, så en redigering der aldrig nåede op bliver prøvet igen.
  usendt_aendring?: boolean;
}

// Poster refererer til hinanden med uid, aldrig med lokale id'er.
export type Reference = string;

export interface Item extends Synkroniserbar {
  id?: number;
  navn: string;
  vaegt_g: number;
  pris_kr: number;
  dimensioner: string;
  antal: number;
  delt: boolean;
  status: ItemStatus;
  tags: string[];
  kraever: string[];
  komplementer: string[];
  koebt_hos: string;
  koebsdato: string;
  koebslink: string;
  ordrenummer: string;
  garanti: Garanti | null;
  noter: string;
  oprettet: Date;
  aendret: Date;
}

export interface Gruppe extends Synkroniserbar {
  id?: number;
  navn: string;
  tags: string[];
  item_ids: Reference[];
  noter: string;
  oprettet: Date;
  aendret: Date;
}

export interface Deltager {
  id: string;
  navn: string;
  overnatning: Overnatning | null;
  personligt_gear_ids: Reference[];
  baerer_delt_ids: Reference[];
}

export interface BudgetLinje {
  id: string;
  kategori: string;
  beskrivelse: string;
  forventet_kr: number;
  faktisk_kr: number;
}

export interface Tur extends Synkroniserbar {
  id?: number;
  navn: string;
  sted: string;
  koordinater: { lat: number; lng: number } | null;
  startdato: string;
  slutdato: string;
  naetter: number;
  personer: number;
  overnatning: Overnatning;
  aktivitet: Aktivitet;
  terraen: Terraen;
  baereafstand_km: number;
  erfaring: Erfaring;
  status: TurStatus;
  gruppe_ids: Reference[];
  loese_item_ids: Reference[];
  deltagere: Deltager[];
  budget_linjer: BudgetLinje[];
  besked_fra_ejer: string;
  noter: string;
  vejrsnapshot: string;
  oprettet: Date;
  aendret: Date;
}

// En post der er slettet lokalt, men endnu ikke i PocketBase — typisk fordi
// man var offline. Uden dette spor ville hentFraPocketBase() hente posten
// tilbage næste gang appen startede.
export interface Slettet {
  id?: number;
  samling: string;
  pb_id: string;
  slettet: Date;
}

export class FeltbogenDB extends Dexie {
  // Nøgletypen er number (++id), så get/add/update slipper for id-casts.
  items!: Table<Item, number>;
  grupper!: Table<Gruppe, number>;
  ture!: Table<Tur, number>;
  slettede!: Table<Slettet, number>;

  constructor() {
    super('FeltbogenDB');
    this.version(1).stores({
      items: '++id, navn, status, oprettet'
    });
    this.version(2).stores({
      items: '++id, navn, status, oprettet',
      grupper: '++id, navn, oprettet'
    });
    this.version(3).stores({
      items: '++id, navn, status, oprettet',
      grupper: '++id, navn, oprettet',
      ture: '++id, navn, startdato, status, oprettet'
    });
    this.version(4).stores({
      items: '++id, navn, status, oprettet',
      grupper: '++id, navn, oprettet',
      ture: '++id, navn, startdato, status, oprettet',
      slettede: '++id, samling, pb_id, [samling+pb_id]'
    });

    // v5 giver hver post et uid og skriver referencerne om fra lokale id'er.
    this.version(5)
      .stores({
        items: '++id, &uid, navn, status, oprettet',
        grupper: '++id, &uid, navn, oprettet',
        ture: '++id, &uid, navn, startdato, status, oprettet',
        slettede: '++id, samling, pb_id, [samling+pb_id]'
      })
      .upgrade(migrerTilUid);
  }
}

// Oversætter en base fra lokale id'er til uid. Kører én gang pr. enhed.
//
// Rækkefølgen er vigtig: alle poster skal have et uid, og der skal bygges en
// oversættelsestabel fra gammelt lokalt id, før referencerne kan skrives om.
//
// Eksporteret så migrationen kan testes direkte — den rører rigtige data og
// kan kun køre én gang pr. enhed.
export async function migrerTilUid(tx: Transaction): Promise<void> {
  const nytUid = () => crypto.randomUUID();

  const items = tx.table<Item & { id: number }>('items');
  const grupper = tx.table<Gruppe & { id: number }>('grupper');
  const ture = tx.table<Tur & { id: number }>('ture');

  // Poster der allerede ligger i PocketBase bruger pb_id som uid. Så er de
  // enige med enhver anden enhed, der har hentet de samme records ned.
  const tildelUid = async (tabel: Table<Synkroniserbar & { id: number }, number>) => {
    const oversaet = new Map<number, string>();
    for (const post of await tabel.toArray()) {
      const uid = post.uid || post.pb_id || nytUid();
      oversaet.set(post.id, uid);
      if (post.uid !== uid) await tabel.update(post.id, { uid });
    }
    return oversaet;
  };

  const itemUid = await tildelUid(items);
  const gruppeUid = await tildelUid(grupper);
  await tildelUid(ture);

  // De gamle referencer er tal; slå dem op i oversættelsestabellen. Peger en
  // reference på noget der ikke findes længere, droppes den.
  const oversaetListe = (gamle: unknown, tabel: Map<number, string>): string[] =>
    Array.isArray(gamle)
      ? gamle.map((v) => tabel.get(Number(v))).filter((u): u is string => !!u)
      : [];

  for (const gruppe of await grupper.toArray()) {
    await grupper.update(gruppe.id, {
      item_ids: oversaetListe(gruppe.item_ids, itemUid)
    });
  }

  for (const tur of await ture.toArray()) {
    await ture.update(tur.id, {
      gruppe_ids: oversaetListe(tur.gruppe_ids, gruppeUid),
      loese_item_ids: oversaetListe(tur.loese_item_ids, itemUid),
      deltagere: (tur.deltagere ?? []).map((d) => ({
        ...d,
        personligt_gear_ids: oversaetListe(d.personligt_gear_ids, itemUid),
        baerer_delt_ids: oversaetListe(d.baerer_delt_ids, itemUid)
      }))
    });
  }
}

export const db = new FeltbogenDB();