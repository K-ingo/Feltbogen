import Dexie from 'dexie';
import type { Table } from 'dexie';

export interface Item {
  id?: number;
  navn: string;
  vaegt_g: number;
  pris_kr: number;
  tags: string[];
  oprettet: Date;
}

export class FeltbogenDB extends Dexie {
  items!: Table<Item>;

  constructor() {
    super('FeltbogenDB');
    this.version(1).stores({
      items: '++id, navn, oprettet'
    });
  }
}

export const db = new FeltbogenDB();