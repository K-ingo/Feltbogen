import Dexie from 'dexie';
import type { Table } from 'dexie';

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
  pb_id?: string;
}

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
  item_ids: number[];
  noter: string;
  oprettet: Date;
  aendret: Date;
}

export interface Deltager {
  id: string;
  navn: string;
  overnatning: Overnatning | null;
  personligt_gear_ids: number[];
  baerer_delt_ids: number[];
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
  gruppe_ids: number[];
  loese_item_ids: number[];
  deltagere: Deltager[];
  budget_linjer: BudgetLinje[];
  besked_fra_ejer: string;
  noter: string;
  vejrsnapshot: string;
  oprettet: Date;
  aendret: Date;
}

export class FeltbogenDB extends Dexie {
  // Nøgletypen er number (++id), så get/add/update slipper for id-casts.
  items!: Table<Item, number>;
  grupper!: Table<Gruppe, number>;
  ture!: Table<Tur, number>;

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
  }
}

export const db = new FeltbogenDB();