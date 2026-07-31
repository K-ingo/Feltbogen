import type { Table } from 'dexie';
import type { RecordModel } from 'pocketbase';
import { db, OVERNATNING, ITEM_STATUS, TUR_STATUS, AKTIVITET, TERRAEN, ERFARING } from './db';
import { pb, nuvaerendeBruger } from './pb';
import type { Item, Gruppe, Tur, Synkroniserbar, Reference, Garanti, Deltager, BudgetLinje } from './db';

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

// Referencer mellem poster er uid'er — enhedsuafhængige, i modsætning til
// Dexies ++id.
function referencer(v: unknown): Reference[] {
  return Array.isArray(v) ? v.map(String).filter(Boolean) : [];
}

// Postens uid. Mangler feltet på serveren, falder vi tilbage til record-id'et:
// det er også globalt unikt, så alle enheder når frem til samme værdi.
function uid(r: RecordModel): string {
  return tekst(r.uid) || r.id;
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
      personligt_gear_ids: referencer(d.personligt_gear_ids),
      baerer_delt_ids: referencer(d.baerer_delt_ids)
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

// PocketBase dropper lydløst felter der ikke findes i samlingens skema. Uden
// et uid-felt kan to enheder ikke blive enige om hvilken post der er hvilken,
// og det er værd at opdage med det samme frem for når data er rodet sammen.
let harAdvaretOmUid = false;

// Indstillingerne spørger til det her, så advarslen ikke kun står i konsollen
// hvor ingen ser den.
export function uidFeltMangler(): boolean {
  return harAdvaretOmUid;
}

function advarHvisUidTabt(skabt: RecordModel, forventet: string, pbNavn: string): void {
  if (harAdvaretOmUid || skabt.uid === forventet) return;
  harAdvaretOmUid = true;
  console.warn(
    `PocketBase gemte ikke feltet "uid" på samlingen "${pbNavn}". Tilføj et ` +
    'tekstfelt "uid" til samlingen — uden det peger grupper og pakkelister på ' +
    'forkert gear når appen bruges fra mere end én enhed.'
  );
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
    uid: i.uid,
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
    uid: uid(r),
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
    uid: g.uid,
    navn: g.navn,
    tags: g.tags,
    item_ids: g.item_ids,
    noter: g.noter
  }),
  fraPb: (r) => ({
    uid: uid(r),
    pb_id: r.id,
    navn: tekst(r.navn),
    tags: tags(r.tags),
    item_ids: referencer(r.item_ids),
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
    uid: t.uid,
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
    gruppe_ids: t.gruppe_ids,
    loese_item_ids: t.loese_item_ids,
    deltagere: t.deltagere,
    budget_linjer: t.budget_linjer,
    besked_fra_ejer: t.besked_fra_ejer,
    noter: t.noter,
    vejrsnapshot: t.vejrsnapshot
  }),
  fraPb: (r) => ({
    uid: uid(r),
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
    gruppe_ids: referencer(r.gruppe_ids),
    loese_item_ids: referencer(r.loese_item_ids),
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
    let svar: RecordModel;

    if (post.pb_id) {
      svar = await pb.collection(samling.pbNavn).update(post.pb_id, payload);
    } else {
      svar = await pb.collection(samling.pbNavn).create(payload);
      advarHvisUidTabt(svar, post.uid, samling.pbNavn);
    }

    // Er posten redigeret igen mens kaldet var i luften, står der en ny sync i
    // køen, og så skal flaget blive — ellers ville den ændring kunne tabes.
    const nyereAendring = afventende.has(koeNoegle(samling, id));

    // Kun sync-felterne skrives, så en samtidig redigering ikke overskrives.
    await samling.tabel.update(id, (gemt) => {
      gemt.pb_id = svar.id;
      // Vi er lige blevet enige med serveren. Uden det her ville næste
      // hentning tro at nogen havde rørt posten et andet sted.
      gemt.server_aendret = tekst(svar.updated);
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

// uid tildeles her frem for hos kalderen, så identiteten altid findes fra
// postens fødsel — også når den oprettes uden forbindelse.
async function opret<T extends Post>(
  samling: Samling<T>,
  post: Omit<T, 'id' | 'uid'>
): Promise<number> {
  const id = await samling.tabel.add({ ...post, uid: crypto.randomUUID() } as T);
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

  // En post kendes på to måder, og begge skal tælle.
  //
  // uid er identiteten på tværs af enheder. Men mangler uid-feltet i
  // PocketBase-skemaet, dropper serveren det lydløst, og posten kommer retur
  // med record-id'et som uid — et andet end det lokale. Uden også at matche
  // på pb_id blev ens egne poster derfor hentet ned igen som dubletter ved
  // hver opstart.
  const efterPbId = new Map(lokale.filter((p) => p.pb_id).map((p) => [p.pb_id!, p]));
  const efterUid = new Map(lokale.map((p) => [p.uid, p]));

  // Poster vi har slettet lokalt må ikke hentes tilbage, selvom de stadig
  // ligger på serveren fordi sletningen ikke er nået op endnu.
  const slettede = await db.slettede.where('samling').equals(samling.pbNavn).toArray();
  const slettedePbIds = new Set(slettede.map((s) => s.pb_id));

  const nye: T[] = [];

  for (const r of records) {
    if (slettedePbIds.has(r.id)) continue;

    const lokal = efterPbId.get(r.id) ?? efterUid.get(uid(r));
    if (lokal) {
      await fletNed(samling, lokal, r);
    } else {
      nye.push(samling.fraPb(r));
    }
  }

  if (nye.length > 0) await samling.tabel.bulkAdd(nye);
}

// Afgør hvad der skal ske med en post der findes begge steder.
//
// Rækkefølgen er valgt, så et ur kun bliver spurgt når der ikke er andet at
// gå efter. Serverens `updated` sammenlignes med den værdi vi gemte sidst vi
// var enige — det er den samme klokkes to aflæsninger, og den kan man stole
// på. Først når begge sider har ændret sig, står lokal tid mod servertid, og
// der er "nyeste vinder" et valg og ikke en kendsgerning.
async function fletNed<T extends Post>(samling: Samling<T>, lokal: T, r: RecordModel): Promise<void> {
  if (lokal.id === undefined) return;
  const serverAendret = tekst(r.updated);

  // Posten blev lavet her uden forbindelse og ligger nu deroppe med samme
  // uid. Knyt dem sammen, ellers ville de drive fra hinanden.
  if (!lokal.pb_id) {
    await samling.tabel.update(lokal.id, (p) => { p.pb_id = r.id; });
  }

  // Serveren har ikke rørt posten siden sidst. Er der lokale ændringer,
  // sendes de op af sendAltUsendt().
  if (serverAendret === lokal.server_aendret) return;

  // Serveren har ændret sig, og vi har intet at miste — tag dens udgave.
  // Ingen ure indblandet.
  if (!lokal.usendt_aendring) {
    await tagServerens(samling, lokal, r, serverAendret);
    return;
  }

  // Begge sider har ændret sig. Nyeste vinder.
  if (new Date(serverAendret).getTime() > lokal.aendret.getTime()) {
    await tagServerens(samling, lokal, r, serverAendret);
  }
  // Ellers er den lokale nyest; den ligger allerede i kø til at gå op og
  // overskrive serverens.
}

async function tagServerens<T extends Post>(
  samling: Samling<T>,
  lokal: T,
  r: RecordModel,
  serverAendret: string
): Promise<void> {
  const fraServer = samling.fraPb(r);

  await samling.tabel.update(lokal.id!, (gemt) => {
    Object.assign(gemt, fraServer, {
      id: lokal.id,
      // uid er identiteten andre poster peger på. Mangler uid-feltet i
      // PocketBase-skemaet, kommer posten retur med record-id'et som uid — og
      // at skrive det ind ville rive gruppernes og turenes referencer over.
      uid: lokal.uid,
      pb_id: r.id,
      server_aendret: serverAendret,
      usendt_aendring: false
    });
  });
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

export const opretItem = (item: Omit<Item, 'id' | 'uid'>) => opret(itemSamling, item);
export const opdaterItem = (id: number, aendringer: Partial<Item>) => opdater(itemSamling, id, aendringer);
export const sletItem = (id: number) => slet(itemSamling, id);

export const opretGruppe = (gruppe: Omit<Gruppe, 'id' | 'uid'>) => opret(gruppeSamling, gruppe);
export const opdaterGruppe = (id: number, aendringer: Partial<Gruppe>) => opdater(gruppeSamling, id, aendringer);
export const sletGruppe = (id: number) => slet(gruppeSamling, id);

export const opretTur = (tur: Omit<Tur, 'id' | 'uid'>) => opret(turSamling, tur);
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

// ─────────────────────────────────────────────
// Oprydning efter dublet-fejlen
// Manglede uid-feltet i PocketBase-skemaet, blev ens egne poster hentet ned
// igen med et andet uid. Resultatet er to lokale poster der peger på samme
// record deroppe. Den ældste beholdes, og referencer flyttes med.
// ─────────────────────────────────────────────

async function fjernDubletterI<T extends Post>(samling: Samling<T>): Promise<Map<Reference, Reference>> {
  const efterPbId = new Map<string, T[]>();
  for (const post of await samling.tabel.toArray()) {
    if (!post.pb_id) continue;
    efterPbId.set(post.pb_id, [...(efterPbId.get(post.pb_id) ?? []), post]);
  }

  const omdoeb = new Map<Reference, Reference>();
  const slettes: number[] = [];

  for (const poster of efterPbId.values()) {
    if (poster.length < 2) continue;

    // Lavest lokalt id er den man selv oprettede; resten er kopier hentet ned.
    const [beholdt, ...dubletter] = [...poster].sort((a, b) => (a.id ?? 0) - (b.id ?? 0));
    for (const dublet of dubletter) {
      if (dublet.id !== undefined) slettes.push(dublet.id);
      omdoeb.set(dublet.uid, beholdt.uid);
    }
  }

  // Kun lokalt. Begge poster peger på samme record i PocketBase, så en
  // sletning deroppe ville fjerne originalen.
  if (slettes.length > 0) await samling.tabel.bulkDelete(slettes);
  return omdoeb;
}

// Flytter referencer fra en fjernet dublet over på den post der blev beholdt,
// så en gruppe ikke ender med at pege på gear der ikke findes mere.
async function flytReferencer(omdoeb: Map<Reference, Reference>): Promise<void> {
  if (omdoeb.size === 0) return;
  const flyt = (uids: Reference[]) => uids.map((u) => omdoeb.get(u) ?? u);
  const aendret = (foer: Reference[], efter: Reference[]) => foer.some((u, i) => u !== efter[i]);

  for (const gruppe of await db.grupper.toArray()) {
    const nye = flyt(gruppe.item_ids);
    if (gruppe.id !== undefined && aendret(gruppe.item_ids, nye)) {
      await db.grupper.update(gruppe.id, { item_ids: nye });
    }
  }

  for (const tur of await db.ture.toArray()) {
    const grupper = flyt(tur.gruppe_ids);
    const loese = flyt(tur.loese_item_ids);
    const deltagere = tur.deltagere.map((d) => ({
      ...d,
      personligt_gear_ids: flyt(d.personligt_gear_ids),
      baerer_delt_ids: flyt(d.baerer_delt_ids)
    }));

    const roert = aendret(tur.gruppe_ids, grupper)
      || aendret(tur.loese_item_ids, loese)
      || tur.deltagere.some((d, i) =>
        aendret(d.personligt_gear_ids, deltagere[i].personligt_gear_ids)
        || aendret(d.baerer_delt_ids, deltagere[i].baerer_delt_ids));

    if (tur.id !== undefined && roert) {
      await db.ture.update(tur.id, { gruppe_ids: grupper, loese_item_ids: loese, deltagere });
    }
  }
}

// Kører ved hver afstemning. Er der ingen dubletter, gør den ingenting.
export async function fjernDubletter(): Promise<number> {
  const omdoeb = new Map<Reference, Reference>();
  let fjernet = 0;

  for (const kort of [
    await fjernDubletterI(itemSamling),
    await fjernDubletterI(gruppeSamling),
    await fjernDubletterI(turSamling)
  ]) {
    fjernet += kort.size;
    kort.forEach((til, fra) => omdoeb.set(fra, til));
  }

  await flytReferencer(omdoeb);
  if (fjernet > 0) console.log(`Ryddede ${fjernet} dubletter op`);
  return fjernet;
}

let igangvaerendeAfstemning: Promise<void> | null = null;

// Bringer lokalt og server-side på linje: send det usendte op, hent det vi
// mangler ned. Kaldes ved appstart og når forbindelsen kommer tilbage.
export function afstemMedServer(): Promise<void> {
  // Flakkende forbindelse kan udløse online-eventet flere gange lige efter
  // hinanden. Uden at lægge kørslerne sammen kunne to samtidige afstemninger
  // oprette samme post to gange i PocketBase.
  igangvaerendeAfstemning ??= (async () => {
    try {
      await fjernDubletter();
      await sendAltUsendt();
      await hentFraPocketBase();
    } finally {
      igangvaerendeAfstemning = null;
    }
  })();

  return igangvaerendeAfstemning;
}

// Hvor meget der venter på at komme op. Bruges af indstillingerne, så man kan
// se om det er sikkert at lukke appen efter en tur uden dækning.
export async function usendtAntal(): Promise<number> {
  const [items, grupper, ture, sletninger] = await Promise.all([
    db.items.filter((p) => !p.pb_id || !!p.usendt_aendring).count(),
    db.grupper.filter((p) => !p.pb_id || !!p.usendt_aendring).count(),
    db.ture.filter((p) => !p.pb_id || !!p.usendt_aendring).count(),
    db.slettede.count()
  ]);

  return items + grupper + ture + sletninger;
}
