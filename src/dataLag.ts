import { db } from './db';
import { pb, nuvaerendeBruger } from './pb';
import type { Item, Gruppe, Tur } from './db';

// ============================================
// HJÆLPEFUNKTIONER
// ============================================

function brugerId(): string {
  const bruger = nuvaerendeBruger();
  if (!bruger) throw new Error('Ikke logget ind');
  return bruger.id;
}

// PocketBase records har et pb_id ekstra felt vi tilføjer til Dexie
interface MedPbId {
  pb_id?: string;
}

// Konverter Dexie item til PocketBase record
function itemTilPb(item: Item, userId: string): any {
  return {
    user: userId,
    navn: item.navn,
    vaegt_g: item.vaegt_g,
    pris_kr: item.pris_kr,
    dimensioner: item.dimensioner,
    antal: item.antal,
    delt: item.delt,
    status: item.status,
    tags: item.tags,
    kraever: item.kraever,
    komplementer: item.komplementer,
    koebt_hos: item.koebt_hos,
    koebsdato: item.koebsdato,
    koebslink: item.koebslink,
    ordrenummer: item.ordrenummer,
    garanti: item.garanti,
    noter: item.noter
  };
}

function gruppeTilPb(gruppe: Gruppe, userId: string): any {
  return {
    user: userId,
    navn: gruppe.navn,
    tags: gruppe.tags,
    item_ids: gruppe.item_ids.map(String),
    noter: gruppe.noter
  };
}

function turTilPb(tur: Tur, userId: string): any {
  return {
    user: userId,
    navn: tur.navn,
    sted: tur.sted,
    koordinater: tur.koordinater,
    startdato: tur.startdato,
    slutdato: tur.slutdato,
    naetter: tur.naetter,
    personer: tur.personer,
    overnatning: tur.overnatning,
    aktivitet: tur.aktivitet,
    terraen: tur.terraen,
    baereafstand_km: tur.baereafstand_km,
    erfaring: tur.erfaring,
    status: tur.status,
    gruppe_ids: tur.gruppe_ids.map(String),
    loese_item_ids: tur.loese_item_ids.map(String),
    deltagere: tur.deltagere,
    budget_linjer: tur.budget_linjer,
    besked_fra_ejer: tur.besked_fra_ejer,
    noter: tur.noter,
    vejrsnapshot: tur.vejrsnapshot
  };
}

// ============================================
// ITEMS
// ============================================

export async function opretItem(item: Omit<Item, 'id' | 'oprettet' | 'aendret'>): Promise<Item> {
  const nu = new Date();
  const nytItem = { ...item, oprettet: nu, aendret: nu } as Item;

  const id = await db.items.add(nytItem);
  nytItem.id = id as number;

  try {
    const pbData = itemTilPb(nytItem, brugerId());
    const skabt = await pb.collection('items').create(pbData);
    await db.items.update(id as number, { ...nytItem, pb_id: skabt.id } as any);
  } catch (e) {
    console.warn('PB opret item fejlede, forsøger senere:', e);
  }

  return nytItem;
}

export async function opdaterItem(id: number, aendringer: Partial<Item>): Promise<void> {
  const nu = new Date();
  await db.items.update(id, { ...aendringer, aendret: nu });

  const item = await db.items.get(id) as (Item & MedPbId) | undefined;
  if (!item?.pb_id) return;

  try {
    const pbData = itemTilPb(item, brugerId());
    await pb.collection('items').update(item.pb_id, pbData);
  } catch (e) {
    console.warn('PB opdater item fejlede:', e);
  }
}

export async function sletItem(id: number): Promise<void> {
  const item = await db.items.get(id) as (Item & MedPbId) | undefined;
  await db.items.delete(id);

  if (!item?.pb_id) return;
  try {
    await pb.collection('items').delete(item.pb_id);
  } catch (e) {
    console.warn('PB slet item fejlede:', e);
  }
}

// ============================================
// GRUPPER
// ============================================

export async function opretGruppe(gruppe: Omit<Gruppe, 'id' | 'oprettet' | 'aendret'>): Promise<Gruppe> {
  const nu = new Date();
  const nyGruppe = { ...gruppe, oprettet: nu, aendret: nu } as Gruppe;

  const id = await db.grupper.add(nyGruppe);
  nyGruppe.id = id as number;

  try {
    const pbData = gruppeTilPb(nyGruppe, brugerId());
    const skabt = await pb.collection('grupper').create(pbData);
    await db.grupper.update(id as number, { ...nyGruppe, pb_id: skabt.id } as any);
  } catch (e) {
    console.warn('PB opret gruppe fejlede:', e);
  }

  return nyGruppe;
}

export async function opdaterGruppe(id: number, aendringer: Partial<Gruppe>): Promise<void> {
  const nu = new Date();
  await db.grupper.update(id, { ...aendringer, aendret: nu });

  const gruppe = await db.grupper.get(id) as (Gruppe & MedPbId) | undefined;
  if (!gruppe?.pb_id) return;

  try {
    const pbData = gruppeTilPb(gruppe, brugerId());
    await pb.collection('grupper').update(gruppe.pb_id, pbData);
  } catch (e) {
    console.warn('PB opdater gruppe fejlede:', e);
  }
}

export async function sletGruppe(id: number): Promise<void> {
  const gruppe = await db.grupper.get(id) as (Gruppe & MedPbId) | undefined;
  await db.grupper.delete(id);

  if (!gruppe?.pb_id) return;
  try {
    await pb.collection('grupper').delete(gruppe.pb_id);
  } catch (e) {
    console.warn('PB slet gruppe fejlede:', e);
  }
}

// ============================================
// TURE
// ============================================

export async function opretTur(tur: Omit<Tur, 'id' | 'oprettet' | 'aendret'>): Promise<Tur> {
  const nu = new Date();
  const nyTur = { ...tur, oprettet: nu, aendret: nu } as Tur;

  const id = await db.ture.add(nyTur);
  nyTur.id = id as number;

  try {
    const pbData = turTilPb(nyTur, brugerId());
    const skabt = await pb.collection('ture').create(pbData);
    await db.ture.update(id as number, { ...nyTur, pb_id: skabt.id } as any);
  } catch (e) {
    console.warn('PB opret tur fejlede:', e);
  }

  return nyTur;
}

export async function opdaterTur(id: number, aendringer: Partial<Tur>): Promise<void> {
  const nu = new Date();
  await db.ture.update(id, { ...aendringer, aendret: nu });

  const tur = await db.ture.get(id) as (Tur & MedPbId) | undefined;
  if (!tur?.pb_id) return;

  try {
    const pbData = turTilPb(tur, brugerId());
    await pb.collection('ture').update(tur.pb_id, pbData);
  } catch (e) {
    console.warn('PB opdater tur fejlede:', e);
  }
}

export async function sletTur(id: number): Promise<void> {
  const tur = await db.ture.get(id) as (Tur & MedPbId) | undefined;
  await db.ture.delete(id);

  if (!tur?.pb_id) return;
  try {
    await pb.collection('ture').delete(tur.pb_id);
  } catch (e) {
    console.warn('PB slet tur fejlede:', e);
  }
}