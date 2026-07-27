import Dexie from 'dexie';
import type { Table } from 'dexie';

export type ItemStatus = 'ejer' | 'overvejer' | 'solgt';
export type TurStatus = 'kladde' | 'klar' | 'aktiv' | 'afsluttet';
export type Overnatning = 'haengekoeje' | 'telt' | 'shelter' | 'blandet';
export type Aktivitet = 'bushcraft' | 'vandretur' | 'kano' | 'andet';
export type Terraen = 'skov' | 'kyst' | 'fjeld' | 'mix';
export type Erfaring = 'begynder' | 'oevet' | 'erfaren';

export interface Garanti {
  laengde_aar: number;
  udloeber_dato: string;
  paamindelse_dage: number;
}

export interface Item {
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

export interface Gruppe {
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

export interface Tur {
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
  oprettet: Date;
  aendret: Date;
}

export class FeltbogenDB extends Dexie {
  items!: Table<Item>;
  grupper!: Table<Gruppe>;
  ture!: Table<Tur>;

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