import type { Table } from 'dexie';
import type { RecordModel } from 'pocketbase';
import { db, OVERNATNING, ITEM_STATUS, TUR_STATUS, AKTIVITET, TERRAEN, ERFARING } from './db';
import { pb, nuvaerendeBruger } from './pb';
import type { Item, Gruppe, Tur, Synkroniserbar, Garanti, Deltager, BudgetLinje } from './db';

// Offline-first: alt skrives til IndexedDB først og sendes derefter til
// PocketBase. Fejler netværket, bliver posten liggende uden pb_id og forsøges
// igen ved næste appstart via sendAltUsendt().

// ─────────────────────────────────────────────
// Læsning af PocketBase-records
// Serveren kan i princippet sende hvad som helst, så felter der er typet som
// tal eller enum i db.ts køres gennem disse coercere på vej ind.
// ─────────────────────────────────────────────

function tekst(v: unknown, standard = ''): string {
  return typeof v === 'string' ? v : standard;
}

function tal(v: unknown, standard = 0): number {
  return typeof v === 'number' && Number.isFinite(v) ? v : standard;
}

function dato(v: unknown): Date {
  const d = new Date(tekst(v));
  return Number.isNaN(d.getTime()) ? new Date() : d;
}

function tags(v: unknown): string[] {
  return Array.isArray(v) ? v.map(String) : [];
}

// Item-referencer sendes som strenge til PocketBase, men er lokale Dexie-ids.
function lokaleIds(v: unknown): number[] {
  return Array.isArray(v) ? v.map(Number).filter((n) => Number.isFinite(n)) : [];
}

function enumVaerdi<T extends string>(v: unknown, tilladte: readonly T[], standard: T): T {
  return tilladte.includes(v as T) ? (v as T) : standard;
}

function garanti(v: unknown): Garanti | null {
  if (!v || typeof v !== 'object') return null;
  const g = v as Record<string, unknown>;
  return {
    laengde_aar: tal(g.laengde_aar),
    udloeber_dato: tekst(g.udloeber_dato),
    paamindelse_dage: tal(g.paamindelse_dage, 30)
  };
}

function koordinater(v: unknown): { lat: number; lng: number } | null {
  if (!v || typeof v !== 'object') return null;
  const k = v as Record<string, unknown>;
  if (typeof k.lat !== 'number' || typeof k.lng !== 'number') return null;
  return { lat: k.lat, lng: k.lng };
}

function deltagere(v: unknown): Deltager[] {
  if (!Array.isArray(v)) return [];
  return v.map((raa) => {
    const d = (raa ?? {}) as Record<string, unknown>;
    return {
      id: tekst(d.id) || crypto.randomUUID(),
      navn: tekst(d.navn),
      overnatning: OVERNATNING.includes(d.overnatning as Deltager['overnatning'] & string)
        ? (d.overnatning as Deltager['overnatning'])
        : null,
      personligt_gear_ids: lokaleIds(d.personligt_gear_ids),
      baerer_delt_ids: lokaleIds(d.baerer_delt_ids)
    };
  });
}

function budgetLinjer(v: unknown): BudgetLinje[] {
  if (!Array.isArray(v)) return [];
  return v.map((raa) => {
    const l = (raa ?? {}) as Record<string, unknown>;
    return {
      id: tekst(l.id) || crypto.randomUUID(),
      kategori: tekst(l.kategori, 'gear'),
      beskrivelse: tekst(l.beskrivelse),
      forventet_kr: tal(l.forventet_kr),
      faktisk_kr: tal(l.faktisk_kr)
    };
  });
}

// PocketBase-fejl bærer detaljerne i response.data — resten er støj.
function fejlDetaljer(e: unknown): unknown {
  if (e && typeof e === 'object') {
    const fejl = e as { response?: { data?: unknown }; data?: unknown };
    return fejl.response?.data ?? fejl.data ?? e;
  }
  return e;
}

// ─────────────────────────────────────────────
// Samlinger
// Én beskrivelse pr. posttype af hvordan den oversættes i begge retninger.
// ─────────────────────────────────────────────

type Post = Synkroniserbar & { id?: number; navn: string; aendret: Date };

interface Samling<T extends Post> {
  pbNavn: string;
  tabel: Table<T, number>;
  tilPb(post: T, brugerId: string): Record<string, unknown>;
  fraPb(record: RecordModel): T;
}

const itemSamling: Samling<Item> = {
  pbNavn: 'items',
  tabel: db.items,
  tilPb: (i, user) => ({
    user,
    navn: i.navn,
    vaegt_g: i.vaegt_g,
    pris_kr: i.pris_kr,
    dimensioner: i.dimensioner,
    antal: i.antal,
    delt: i.delt,
    status: i.status,
    tags: i.tags,
    kraever: i.kraever,
    komplementer: i.komplementer,
    koebt_hos: i.koebt_hos,
    koebsdato: i.koebsdato,
    koebslink: i.koebslink,
    ordrenummer: i.ordrenummer,
    garanti: i.garanti,
    noter: i.noter
  }),
  fraPb: (r) => ({
    pb_id: r.id,
    navn: tekst(r.navn),
    vaegt_g: tal(r.vaegt_g),
    pris_kr: tal(r.pris_kr),
    dimensioner: tekst(r.dimensioner),
    antal: tal(r.antal, 1),
    delt: r.delt === true,
    status: enumVaerdi(r.status, ITEM_STATUS, 'ejer'),
    tags: tags(r.tags),
    kraever: tags(r.kraever),
    komplementer: tags(r.komplementer),
    koebt_hos: tekst(r.koebt_hos),
    koebsdato: tekst(r.koebsdato),
    koebslink: tekst(r.koebslink),
    ordrenummer: tekst(r.ordrenummer),
    garanti: garanti(r.garanti),
    noter: tekst(r.noter),
    oprettet: dato(r.created),
    aendret: dato(r.updated)
  })
};

const gruppeSamling: Samling<Gruppe> = {
  pbNavn: 'grupper',
  tabel: db.grupper,
  tilPb: (g, user) => ({
    user,
    navn: g.navn,
    tags: g.tags,
    item_ids: g.item_ids.map(String),
    noter: g.noter
  }),
  fraPb: (r) => ({
    pb_id: r.id,
    navn: tekst(r.navn),
    tags: tags(r.tags),
    item_ids: lokaleIds(r.item_ids),
    noter: tekst(r.noter),
    oprettet: dato(r.created),
    aendret: dato(r.updated)
  })
};

const turSamling: Samling<Tur> = {
  pbNavn: 'ture',
  tabel: db.ture,
  tilPb: (t, user) => ({
    user,
    navn: t.navn,
    sted: t.sted,
    koordinater: t.koordinater,
    startdato: t.startdato,
    slutdato: t.slutdato,
    naetter: t.naetter,
    personer: t.personer,
    overnatning: t.overnatning,
    aktivitet: t.aktivitet,
    terraen: t.terraen,
    baereafstand_km: t.baereafstand_km,
    erfaring: t.erfaring,
    status: t.status,
    gruppe_ids: t.gruppe_ids.map(String),
    loese_item_ids: t.loese_item_ids.map(String),
    deltagere: t.deltagere,
    budget_linjer: t.budget_linjer,
    besked_fra_ejer: t.besked_fra_ejer,
    noter: t.noter,
    vejrsnapshot: t.vejrsnapshot
  }),
  fraPb: (r) => ({
    pb_id: r.id,
    navn: tekst(r.navn),
    sted: tekst(r.sted),
    koordinater: koordinater(r.koordinater),
    startdato: tekst(r.startdato),
    slutdato: tekst(r.slutdato),
    naetter: tal(r.naetter),
    personer: tal(r.personer, 1),
    overnatning: enumVaerdi(r.overnatning, OVERNATNING, 'shelter'),
    aktivitet: enumVaerdi(r.aktivitet, AKTIVITET, 'bushcraft'),
    terraen: enumVaerdi(r.terraen, TERRAEN, 'skov'),
    baereafstand_km: tal(r.baereafstand_km),
    erfaring: enumVaerdi(r.erfaring, ERFARING, 'oevet'),
    status: enumVaerdi(r.status, TUR_STATUS, 'kladde'),
    gruppe_ids: lokaleIds(r.gruppe_ids),
    loese_item_ids: lokaleIds(r.loese_item_ids),
    deltagere: deltagere(r.deltagere),
    budget_linjer: budgetLinjer(r.budget_linjer),
    besked_fra_ejer: tekst(r.besked_fra_ejer),
    noter: tekst(r.noter),
    vejrsnapshot: tekst(r.vejrsnapshot),
    oprettet: dato(r.created),
    aendret: dato(r.updated)
  })
};

// ─────────────────────────────────────────────
// Generiske operationer
// ─────────────────────────────────────────────

// Sender én post op: opdaterer hvis den kendes i PocketBase, opretter ellers.
// Returnerer om den nu ligger deroppe.
async function synkroniser<T extends Post>(samling: Samling<T>, id: number): Promise<boolean> {
  const bruger = nuvaerendeBruger();
  if (!bruger) return false;

  const post = await samling.tabel.get(id);
  if (!post) return false;

  try {
    const payload = samling.tilPb(post, bruger.id);
    if (post.pb_id) {
      await pb.collection(samling.pbNavn).update(post.pb_id, payload);
    } else {
      const skabt = await pb.collection(samling.pbNavn).create(payload);
      // Kun pb_id skrives, så en samtidig redigering af posten ikke overskrives.
      await samling.tabel.update(id, (post) => {
        post.pb_id = skabt.id;
      });
    }
    return true;
  } catch (e) {
    console.error(`Kunne ikke synkronisere ${samling.pbNavn} "${post.navn}":`, fejlDetaljer(e));
    return false;
  }
}

async function opret<T extends Post>(samling: Samling<T>, post: Omit<T, 'id'>): Promise<number> {
  const id = await samling.tabel.add(post as T);
  await synkroniser(samling, id);
  return id;
}

async function opdater<T extends Post>(
  samling: Samling<T>,
  id: number,
  aendringer: Partial<T>
): Promise<void> {
  await samling.tabel.update(id, (post) => {
    Object.assign(post, aendringer);
    post.aendret = new Date();
  });
  await synkroniser(samling, id);
}

async function slet<T extends Post>(samling: Samling<T>, id: number): Promise<void> {
  const post = await samling.tabel.get(id);
  await samling.tabel.delete(id);

  if (!post?.pb_id) return;
  try {
    await pb.collection(samling.pbNavn).delete(post.pb_id);
  } catch (e) {
    console.error(`Kunne ikke slette ${samling.pbNavn} "${post.navn}" i PocketBase:`, fejlDetaljer(e));
  }
}

// Henter de records vi ikke har lokalt endnu.
// Bemærk: poster vi allerede kender springes over, så ændringer lavet på en
// anden enhed hentes ikke ned. Tovejs-sync mangler stadig.
async function hent<T extends Post>(samling: Samling<T>, brugerId: string): Promise<void> {
  const records = await pb.collection(samling.pbNavn).getFullList({
    filter: pb.filter('user = {:bruger}', { bruger: brugerId })
  });

  const lokale = await samling.tabel.toArray();
  const kendte = new Set(lokale.map((p) => p.pb_id).filter(Boolean));

  const nye = records.filter((r) => !kendte.has(r.id)).map((r) => samling.fraPb(r));
  if (nye.length > 0) await samling.tabel.bulkAdd(nye);
}

async function sendUsendte<T extends Post>(samling: Samling<T>): Promise<{ ok: number; fejl: number }> {
  const usendte = (await samling.tabel.toArray()).filter((p) => !p.pb_id && p.id !== undefined);

  let ok = 0;
  let fejl = 0;
  for (const post of usendte) {
    if (await synkroniser(samling, post.id as number)) ok++;
    else fejl++;
  }
  return { ok, fejl };
}

// ─────────────────────────────────────────────
// Offentligt API
// ─────────────────────────────────────────────

export const opretItem = (item: Omit<Item, 'id'>) => opret(itemSamling, item);
export const opdaterItem = (id: number, aendringer: Partial<Item>) => opdater(itemSamling, id, aendringer);
export const sletItem = (id: number) => slet(itemSamling, id);

export const opretGruppe = (gruppe: Omit<Gruppe, 'id'>) => opret(gruppeSamling, gruppe);
export const opdaterGruppe = (id: number, aendringer: Partial<Gruppe>) => opdater(gruppeSamling, id, aendringer);
export const sletGruppe = (id: number) => slet(gruppeSamling, id);

export const opretTur = (tur: Omit<Tur, 'id'>) => opret(turSamling, tur);
export const opdaterTur = (id: number, aendringer: Partial<Tur>) => opdater(turSamling, id, aendringer);
export const sletTur = (id: number) => slet(turSamling, id);

// Sender alt der endnu ikke har nået PocketBase. Kaldes ved appstart, så
// poster oprettet offline kommer op så snart der er forbindelse igen.
export async function sendAltUsendt(): Promise<{ antal: number; fejl: number }> {
  if (!nuvaerendeBruger()) return { antal: 0, fejl: 0 };

  const resultater = [
    await sendUsendte(itemSamling),
    await sendUsendte(gruppeSamling),
    await sendUsendte(turSamling)
  ];

  const antal = resultater.reduce((s, r) => s + r.ok, 0);
  const fejl = resultater.reduce((s, r) => s + r.fejl, 0);
  if (antal + fejl > 0) {
    console.log(`Sync: ${antal} sendt til PocketBase, ${fejl} fejlede`);
  }
  return { antal, fejl };
}

export async function hentFraPocketBase(): Promise<void> {
  const bruger = nuvaerendeBruger();
  if (!bruger) return;

  try {
    await Promise.all([
      hent(itemSamling, bruger.id),
      hent(gruppeSamling, bruger.id),
      hent(turSamling, bruger.id)
    ]);
  } catch (e) {
    console.error('Kunne ikke hente data fra PocketBase:', fejlDetaljer(e));
  }
}
