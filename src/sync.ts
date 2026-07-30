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
    let nytPbId: string | undefined;

    if (post.pb_id) {
      await pb.collection(samling.pbNavn).update(post.pb_id, payload);
    } else {
      nytPbId = (await pb.collection(samling.pbNavn).create(payload)).id;
    }

    // Er posten redigeret igen mens kaldet var i luften, står der en ny sync i
    // køen, og så skal flaget blive — ellers ville den ændring kunne tabes.
    const nyereAendring = afventende.has(koeNoegle(samling, id));

    // Kun sync-felterne skrives, så en samtidig redigering ikke overskrives.
    await samling.tabel.update(id, (gemt) => {
      if (nytPbId) gemt.pb_id = nytPbId;
      if (!nyereAendring) gemt.usendt_aendring = false;
    });
    return true;
  } catch (e) {
    console.error(`Kunne ikke synkronisere ${samling.pbNavn} "${post.navn}":`, fejlDetaljer(e));
    return false;
  }
}

// ─────────────────────────────────────────────
// Samling af udgående opdateringer
// Hvert tastetryk skal skrives lokalt med det samme, men det ville give én
// request pr. tegn. Sync udskydes derfor til man holder pause, så en hel
// indtastning bliver ét kald.
// ─────────────────────────────────────────────

const SYNC_FORSINKELSE_MS = 800;

interface Afventende {
  timer: ReturnType<typeof setTimeout>;
  synk: () => Promise<boolean>;
}

const afventende = new Map<string, Afventende>();

function koeNoegle<T extends Post>(samling: Samling<T>, id: number): string {
  return `${samling.pbNavn}:${id}`;
}

function planlaegSync<T extends Post>(samling: Samling<T>, id: number): void {
  const noegle = koeNoegle(samling, id);

  // Ny ændring på samme post nulstiller ventetiden.
  const igang = afventende.get(noegle);
  if (igang) clearTimeout(igang.timer);

  const synk = () => synkroniser(samling, id);
  const timer = setTimeout(() => {
    afventende.delete(noegle);
    void synk();
  }, SYNC_FORSINKELSE_MS);

  afventende.set(noegle, { timer, synk });
}

// Sender det der venter med det samme, uden at vente forsinkelsen ud. Kaldes
// når appen skjules, og inden der hentes fra serveren.
export async function sendAfventende(): Promise<void> {
  const ventende = [...afventende.values()];
  afventende.clear();
  ventende.forEach((v) => clearTimeout(v.timer));

  await Promise.all(ventende.map((v) => v.synk()));
}

async function opret<T extends Post>(samling: Samling<T>, post: Omit<T, 'id'>): Promise<number> {
  const id = await samling.tabel.add(post as T);
  await synkroniser(samling, id);
  return id;
}

// Skriver lokalt med det samme og planlægger sync. Den returnerede Promise
// venter kun på IndexedDB, så indtastning ikke afhænger af netværket.
async function opdater<T extends Post>(
  samling: Samling<T>,
  id: number,
  aendringer: Partial<T>
): Promise<void> {
  await samling.tabel.update(id, (post) => {
    Object.assign(post, aendringer);
    post.aendret = new Date();
    post.usendt_aendring = true;
  });
  planlaegSync(samling, id);
}

async function slet<T extends Post>(samling: Samling<T>, id: number): Promise<void> {
  const post = await samling.tabel.get(id);
  await samling.tabel.delete(id);

  // Nåede posten aldrig op i PocketBase, er der intet at gøre deroppe.
  if (!post?.pb_id) return;

  // Sporet lægges før forsøget, så sletningen ikke kan gå tabt hvis appen
  // lukkes midt i kaldet.
  const sporId = await db.slettede.add({
    samling: samling.pbNavn,
    pb_id: post.pb_id,
    slettet: new Date()
  });

  if (await sletIPb(samling.pbNavn, post.pb_id)) {
    await db.slettede.delete(sporId);
  }
}

// Returnerer om posten nu er væk i PocketBase. En 404 tæller som succes —
// så er den slettet et andet sted, og sporet skal ikke blive liggende.
async function sletIPb(pbNavn: string, pbId: string): Promise<boolean> {
  try {
    await pb.collection(pbNavn).delete(pbId);
    return true;
  } catch (e) {
    if (erIkkeFundet(e)) return true;
    console.error(`Kunne ikke slette ${pbNavn} ${pbId} i PocketBase:`, fejlDetaljer(e));
    return false;
  }
}

function erIkkeFundet(e: unknown): boolean {
  return typeof (e as { status?: unknown } | null)?.status === 'number'
    && (e as { status: number }).status === 404;
}

// Prøver de sletninger igen, der ikke nåede serveren.
async function sendUsendteSletninger(): Promise<{ ok: number; fejl: number }> {
  const spor = await db.slettede.toArray();

  let ok = 0;
  let fejl = 0;
  for (const s of spor) {
    if (await sletIPb(s.samling, s.pb_id)) {
      if (s.id !== undefined) await db.slettede.delete(s.id);
      ok++;
    } else {
      fejl++;
    }
  }
  return { ok, fejl };
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

  // Poster vi har slettet lokalt må ikke hentes tilbage, selvom de stadig
  // ligger på serveren fordi sletningen ikke er nået op endnu.
  const slettede = await db.slettede.where('samling').equals(samling.pbNavn).toArray();
  const slettedePbIds = new Set(slettede.map((s) => s.pb_id));

  const nye = records
    .filter((r) => !kendte.has(r.id) && !slettedePbIds.has(r.id))
    .map((r) => samling.fraPb(r));

  if (nye.length > 0) await samling.tabel.bulkAdd(nye);
}

async function sendUsendte<T extends Post>(samling: Samling<T>): Promise<{ ok: number; fejl: number }> {
  // Både poster der aldrig nåede op, og poster hvis redigering ikke blev
  // kvitteret — fx fordi appen blev lukket inden sync løb.
  const usendte = (await samling.tabel.toArray())
    .filter((p) => p.id !== undefined && (!p.pb_id || p.usendt_aendring));

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

// Sender alt der endnu ikke har nået PocketBase — både nye poster og
// sletninger. Kaldes ved appstart, så det man lavede offline kommer op så
// snart der er forbindelse igen.
export async function sendAltUsendt(): Promise<{ antal: number; fejl: number }> {
  if (!nuvaerendeBruger()) return { antal: 0, fejl: 0 };

  // Tøm køen først, så en igangværende redigering ikke tælles som usendt.
  await sendAfventende();

  const resultater = [
    await sendUsendte(itemSamling),
    await sendUsendte(gruppeSamling),
    await sendUsendte(turSamling),
    await sendUsendteSletninger()
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
