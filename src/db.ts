import Dexie from 'dexie';
import type { Table } from 'dexie';

export type ItemStatus = 'ejer' | 'overvejer' | 'solgt';

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

export class FeltbogenDB extends Dexie {
  items!: Table<Item>;

  constructor() {
    super('FeltbogenDB');
    this.version(1).stores({
      items: '++id, navn, status, oprettet'
    });
  }
}

export const db = new FeltbogenDB();