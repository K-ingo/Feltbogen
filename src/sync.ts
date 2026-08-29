import type { Table } from 'dexie';
import type { RecordModel } from 'pocketbase';
import {
  db,
  OVERNATNING,
  ITEM_STATUS,
  TUR_STATUS,
  AKTIVITET,
  TERRAEN,
  ERFARING,
  PAK_AF_STATUS,
  PAK_AF_NIVEAU,
  KATEGORI_VURDERING
} from './db';
import { pb, nuvaerendeBruger } from './pb';
import { fejlDetaljer } from './pbFejl';
import { noterFejl, rydFejl } from './syncfejl';
import { gyldig as gyldigVurdering } from './vurdering';
import type {
  Billede,
  Item,
  Gruppe,
  Tur,
  Synkroniserbar,
  Reference,
  Garanti,
  Deltager,
  Booking,
  BudgetLinje,
  PakAfTjek,
  PakAfLinje,
  KategoriNote,
  Udlaan,
  Laant,
  AfgangsTjek,
  AfgangsLinje,
  Feltnote,
  Vedligehold,
  Sted,
  Person
} from './db';

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
      baerer_delt_ids: referencer(d.baerer_delt_ids),
      person_uid: tekst(d.person_uid)
    };
  });
}

// Ture fra før pak-af-tjekket fandtes har ingen — og det er den rigtige
// værdi for dem: de er aldrig gjort op.
function pakAfTjek(v: unknown): PakAfTjek | null {
  if (!v || typeof v !== 'object') return null;
  const t = v as Record<string, unknown>;

  const linjer: PakAfLinje[] = (Array.isArray(t.linjer) ? t.linjer : [])
    .map((raa) => (raa ?? {}) as Record<string, unknown>)
    .filter((l) => tekst(l.item_uid) !== '')
    .map((l) => {
      const linje: PakAfLinje = {
        item_uid: tekst(l.item_uid),
        status: enumVaerdi(l.status, PAK_AF_STATUS, 'brugt')
      };
      const noter = tekst(l.noter);
      if (noter) linje.noter = noter;
      return linje;
    });

  const raaNoter = Array.isArray(t.kategori_noter) ? t.kategori_noter : [];
  const kategori_noter: KategoriNote[] = raaNoter
    .map((raa) => (raa ?? {}) as Record<string, unknown>)
    .filter((n) => tekst(n.kategori) !== '')
    .map((n) => ({
      kategori: tekst(n.kategori),
      vurdering: enumVaerdi(n.vurdering, KATEGORI_VURDERING, 'tilstraekkeligt'),
      noter: tekst(n.noter)
    }));

  const tjek: PakAfTjek = {
    udfyldt_dato: tekst(t.udfyldt_dato),
    niveau: enumVaerdi(t.niveau, PAK_AF_NIVEAU, 'let'),
    linjer
  };
  if (kategori_noter.length > 0) tjek.kategori_noter = kategori_noter;
  return tjek;
}

// Ture fra før afgangs-tjeklisten fandtes har ingen. Tom betyder "ikke taget
// i brug", og det er den rigtige værdi for dem.
function afgangsTjek(v: unknown): AfgangsTjek | null {
  if (!v || typeof v !== 'object') return null;
  const t = v as Record<string, unknown>;

  const linjer: AfgangsLinje[] = (Array.isArray(t.linjer) ? t.linjer : [])
    .map((raa) => (raa ?? {}) as Record<string, unknown>)
    .filter((l) => tekst(l.tekst).trim() !== '')
    .map((l) => ({
      id: tekst(l.id) || crypto.randomUUID(),
      tekst: tekst(l.tekst),
      afkrydset: l.afkrydset === true,
      fra_skabelon: l.fra_skabelon === true
    }));

  return { linjer };
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

function udlaan(v: unknown): Udlaan | null {
  if (!v || typeof v !== 'object') return null;
  const u = v as Record<string, unknown>;
  // Uden et navn er lånet ikke til nogen, og så er der intet at holde styr på.
  if (!tekst(u.navn).trim()) return null;

  return {
    person_uid: tekst(u.person_uid),
    navn: tekst(u.navn),
    udlaant_dato: tekst(u.udlaant_dato),
    forventet_retur: tekst(u.forventet_retur),
    noter: tekst(u.noter)
  };
}

function laantAf(v: unknown): Laant | null {
  if (!v || typeof v !== 'object') return null;
  const l = v as Record<string, unknown>;
  if (!tekst(l.navn).trim()) return null;

  return {
    person_uid: tekst(l.person_uid),
    navn: tekst(l.navn),
    laant_dato: tekst(l.laant_dato),
    skal_retur: tekst(l.skal_retur)
  };
}

function vedligehold(v: unknown): Vedligehold[] {
  if (!Array.isArray(v)) return [];

  return v
    .map((raa) => (raa ?? {}) as Record<string, unknown>)
    // Uden et navn er handlingen ikke til at genkende, og så er der intet at
    // minde om.
    .filter((h) => tekst(h.navn).trim() !== '')
    .map((h) => ({
      id: tekst(h.id) || crypto.randomUUID(),
      navn: tekst(h.navn),
      sidst_udfoert: tekst(h.sidst_udfoert),
      interval_maaneder: tal(h.interval_maaneder),
      noter: tekst(h.noter)
    }));
}

// Ture fra før booking-felterne fandtes har ingen, og det er den rigtige
// værdi: man har ikke taget stilling.
function booking(v: unknown): Booking | null {
  if (!v || typeof v !== 'object') return null;
  const b = v as Record<string, unknown>;

  const link = tekst(b.link).trim();
  const reference = tekst(b.reference).trim();
  const booket = b.booket === true;

  // Er der hverken link, reference eller flueben, er der ikke taget stilling.
  return link || reference || booket ? { link, booket, reference } : null;
}

function feltnoter(v: unknown): Feltnote[] {
  if (!Array.isArray(v)) return [];

  return v
    .map((raa) => (raa ?? {}) as Record<string, unknown>)
    .filter((n) => tekst(n.tekst).trim() !== '')
    .map((n) => ({
      id: tekst(n.id) || crypto.randomUUID(),
      tid: tekst(n.tid),
      tekst: tekst(n.tekst)
    }));
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
  // Kaldes efter serveren har kvitteret, hvis der er noget i svaret der kun
  // kan komme derfra. Billeder bruger den til url'en efter en upload.
  efterSvar?(id: number, record: RecordModel): Promise<void>;
  // Et lettere forsøg, når det første blev afvist — eller null hvis der ikke
  // er noget at skære fra. Billeder bruger den til at komme op uden
  // originalen: visningskopien er den vigtige, og en server der ikke vil tage
  // imod fire megabyte, skal ikke koste hele billedet.
  udenTungeFelter?(payload: Record<string, unknown>): Record<string, unknown> | null;
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
    udlaan: i.udlaan ?? null,
    laant_af: i.laant_af ?? null,
    vedligehold: i.vedligehold ?? [],
    vurdering: i.vurdering ?? null,
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
    udlaan: udlaan(r.udlaan),
    laant_af: laantAf(r.laant_af),
    vedligehold: vedligehold(r.vedligehold),
    vurdering: gyldigVurdering(r.vurdering),
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
    sted_uid: t.sted_uid,
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
    pakkede_item_uids: t.pakkede_item_uids ?? [],
    deltagere: t.deltagere,
    budget_linjer: t.budget_linjer,
    pak_af_tjek: t.pak_af_tjek ?? null,
    afgangs_tjek: t.afgangs_tjek ?? null,
    feltnoter: t.feltnoter ?? [],
    besked_fra_ejer: t.besked_fra_ejer,
    noter: t.noter,
    vejrsnapshot: t.vejrsnapshot,
    dele_token: t.dele_token,
    dele_snapshot: t.dele_snapshot,
    turkort_token: t.turkort_token,
    turkort_retur: t.turkort_retur,
    turkort_besked: t.turkort_besked,
    turkort_snapshot: t.turkort_snapshot,
    // De her to blev læst ned uden nogensinde at blive sendt op. Et felt der
    // kun læses, er ikke et halvt felt — det er et felt der bliver slettet:
    // serverens udgave vinder ved en flettning og skriver sin tomme værdi ind
    // over den lokale. Valgte man en forside på telefonen og rettede turen på
    // PC'en, var forsiden væk efter næste sync.
    hero_billede: t.hero_billede,
    booking: t.booking ?? null
  }),
  fraPb: (r) => ({
    uid: uid(r),
    pb_id: r.id,
    navn: tekst(r.navn),
    sted: tekst(r.sted),
    sted_uid: tekst(r.sted_uid),
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
    pakkede_item_uids: referencer(r.pakkede_item_uids),
    deltagere: deltagere(r.deltagere),
    budget_linjer: budgetLinjer(r.budget_linjer),
    pak_af_tjek: pakAfTjek(r.pak_af_tjek),
    afgangs_tjek: afgangsTjek(r.afgangs_tjek),
    feltnoter: feltnoter(r.feltnoter),
    besked_fra_ejer: tekst(r.besked_fra_ejer),
    noter: tekst(r.noter),
    vejrsnapshot: tekst(r.vejrsnapshot),
    dele_token: tekst(r.dele_token),
    dele_snapshot: tekst(r.dele_snapshot),
    turkort_token: tekst(r.turkort_token),
    turkort_retur: tekst(r.turkort_retur),
    turkort_besked: tekst(r.turkort_besked),
    turkort_snapshot: tekst(r.turkort_snapshot),
    hero_billede: tekst(r.hero_billede),
    booking: booking(r.booking),
    oprettet: dato(r.created),
    aendret: dato(r.updated)
  })
};

const stedSamling: Samling<Sted> = {
  pbNavn: 'steder',
  tabel: db.steder,
  tilPb: (s, user) => ({
    user,
    uid: s.uid,
    navn: s.navn,
    koordinater: s.koordinater,
    adresse: s.adresse,
    tags: s.tags,
    vurdering: s.vurdering ?? null,
    noter: s.noter
  }),
  fraPb: (r) => ({
    uid: uid(r),
    pb_id: r.id,
    navn: tekst(r.navn),
    koordinater: koordinater(r.koordinater),
    adresse: tekst(r.adresse),
    tags: tags(r.tags),
    vurdering: gyldigVurdering(r.vurdering),
    noter: tekst(r.noter),
    oprettet: dato(r.created),
    aendret: dato(r.updated)
  })
};

const personSamling: Samling<Person> = {
  pbNavn: 'personer',
  tabel: db.personer,
  tilPb: (p, user) => ({
    user,
    uid: p.uid,
    navn: p.navn,
    email: p.email,
    standard_overnatning: p.standard_overnatning,
    noter: p.noter
  }),
  fraPb: (r) => ({
    uid: uid(r),
    pb_id: r.id,
    navn: tekst(r.navn),
    email: tekst(r.email),
    standard_overnatning: OVERNATNING.includes(r.standard_overnatning as Person['standard_overnatning'] & string)
      ? (r.standard_overnatning as Person['standard_overnatning'])
      : null,
    noter: tekst(r.noter),
    oprettet: dato(r.created),
    aendret: dato(r.updated)
  })
};

// Billeder følger den samme maskine som alt andet, men skiller sig ud på to
// punkter, og begge er værd at kende:
//
// 1. Filen sendes kun ved oprettelsen. PocketBase-SDK'en laver selv FormData
//    af et objekt der indeholder en Blob, så `tilPb` behøver ikke en egen vej
//    op — men en *opdatering* med `fil` sat ville lægge billedet op én gang
//    til. Derfor udelades feltet, så snart posten har et pb_id.
//
// 2. `blob` kommer ikke ned fra serveren. `fraPb` sætter kun url'en; selve
//    billedet hentes først når det skal vises, og lægges så på plads. En
//    enhed skal ikke trække et helt turgalleri ned for at vise en liste.
const billedSamling: Samling<Billede> = {
  pbNavn: 'billeder',
  tabel: db.billeder,
  tilPb: (b, user) => ({
    user,
    uid: b.uid,
    navn: b.navn,
    tur_uid: b.tur_uid,
    tid: b.tid,
    bredde: b.bredde,
    hoejde: b.hoejde,
    byte: b.byte,
    beskrivelse: b.beskrivelse,
    original_byte: b.original_byte,
    ...(b.pb_id || !b.blob ? {} : { fil: new File([b.blob], filnavnTil(b), { type: b.blob.type }) }),
    ...(b.original_url || !b.original_blob
      ? {}
      : { original: new File([b.original_blob], originalnavnTil(b), { type: b.original_blob.type }) })
  }),
  fraPb: (r) => ({
    uid: uid(r),
    pb_id: r.id,
    navn: tekst(r.navn),
    tur_uid: tekst(r.tur_uid),
    tid: tekst(r.tid),
    bredde: tal(r.bredde),
    hoejde: tal(r.hoejde),
    byte: tal(r.byte),
    beskrivelse: tekst(r.beskrivelse),
    blob: null,
    url: tekst(r.fil) ? pb.files.getURL(r, tekst(r.fil)) : '',
    original_blob: null,
    original_url: tekst(r.original) ? pb.files.getURL(r, tekst(r.original)) : '',
    original_byte: tal(r.original_byte),
    oprettet: dato(r.created),
    aendret: dato(r.updated)
  }),
  // Url'en kommer først med serverens svar. Uden den ville billedet blive
  // stående som "ikke sendt" og blive lagt op igen ved næste afstemning.
  // Originalen er en bonus. Kan den ikke komme op, skal visningskopien stadig
  // kunne — ellers ville et manglende `original`-felt i PocketBase koste hele
  // billedfunktionen.
  udenTungeFelter: (payload) => {
    if (!('original' in payload)) return null;

    const { original, ...resten } = payload;
    void original;
    return resten;
  },
  efterSvar: async (id, record) => {
    const aendringer: Partial<Billede> = {};

    const fil = tekst(record.fil);
    if (fil) aendringer.url = pb.files.getURL(record, fil);

    // Originalen er nået op, og så skal den lokale kopi væk. Den der tog
    // billedet, har det i forvejen i kamerarullen, og et turgalleri i fuld
    // størrelse ville fylde IndexedDB op uden at give noget.
    const original = tekst(record.original);
    if (original) {
      aendringer.original_url = pb.files.getURL(record, original);
      aendringer.original_blob = null;
    }

    if (Object.keys(aendringer).length > 0) await db.billeder.update(id, aendringer);
  }
};

// PocketBase renser selv filnavnet, men et navn uden endelse giver en fil
// uden type når den hentes igen.
function filnavnTil(b: Billede): string {
  return `${b.uid}.jpg`;
}

// Originalen beholder sin egen endelse — den kan være HEIC, PNG eller noget
// helt fjerde, og den skal kunne åbnes af det program den hører til.
function originalnavnTil(b: Billede): string {
  const endelse = /\.([a-z0-9]{1,5})$/i.exec(b.navn)?.[1]?.toLowerCase() ?? 'jpg';
  return `${b.uid}-original.${endelse}`;
}

// ─────────────────────────────────────────────
// Generiske operationer
// ─────────────────────────────────────────────

// Sender én post op: opdaterer hvis den kendes i PocketBase, opretter ellers.
// Returnerer om den nu ligger deroppe.
// Opretter posten, og prøver igen med mindre i hvis det første blev afvist.
//
// Det er der for billedernes skyld. En upload med originalen er fire megabyte
// hvor visningskopien er tre hundrede kilobyte, og afviser serveren den —
// fordi feltet ikke findes, eller fordi den er for stor — så skal billedet
// stadig kunne komme op. Fejlen skrives ud, så det ikke sker i det skjulte.
async function opretIPb<T extends Post>(
  samling: Samling<T>,
  payload: Record<string, unknown>,
  navn: string
): Promise<RecordModel> {
  try {
    return await pb.collection(samling.pbNavn).create(payload);
  } catch (e) {
    const lettere = samling.udenTungeFelter?.(payload);
    if (!lettere) throw e;

    console.warn(
      `"${navn}" blev afvist af ${samling.pbNavn}. Prøver igen uden det tungeste:`,
      fejlDetaljer(e)
    );
    return pb.collection(samling.pbNavn).create(lettere);
  }
}

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
      svar = await opretIPb(samling, payload, post.navn);
      advarHvisUidTabt(svar, post.uid, samling.pbNavn);
    }

    await samling.efterSvar?.(id, svar);

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
    // Det lykkedes. Står der en fejl fra sidst, er den ikke sand længere.
    await rydFejl();
    return true;
  } catch (e) {
    console.error(`Kunne ikke synkronisere ${samling.pbNavn} "${post.navn}":`, fejlDetaljer(e));
    // Konsollen er ikke et sted, brugeren kigger. Se syncfejl.ts.
    await noterFejl(e);
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

// Kaldes efter hver lokal skrivning. Delingen bruger den til at bygge
// gæsternes udgave om, men sync skal ikke kende til deling — derfor en krog
// frem for en import der peger begge veje.
let efterSkrivning: (() => void) | null = null;

export function saetEfterSkrivning(fn: () => void): void {
  efterSkrivning = fn;
}

// uid tildeles her frem for hos kalderen, så identiteten altid findes fra
// postens fødsel — også når den oprettes uden forbindelse.
async function opret<T extends Post>(
  samling: Samling<T>,
  post: Omit<T, 'id' | 'uid'>
): Promise<number> {
  const id = await samling.tabel.add({ ...post, uid: crypto.randomUUID() } as T);
  efterSkrivning?.();
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
  efterSkrivning?.();
  planlaegSync(samling, id);
}

// Lægger en slettet post tilbage, som den var.
//
// uid'et følger med. Det er postens identitet, og alt der peger på den —
// gruppernes `item_ids`, pakkelistens `loese_item_ids`, deltagernes gear —
// peger på uid. Derfor er en fortrudt sletning hel og ikke bare en ny post
// der ligner: grejet dukker op igen i præcis de grupper og ture det lå i.
//
// Det lokale id følger også med, så en skærm der stadig peger på posten,
// finder den igen. Dexies tæller genbruger aldrig et id, så der er intet at
// støde sammen med.
//
// `pb_id` ryddes derimod. Posten deroppe er slettet — eller står til at blive
// det via `slettede`-sporet — så den skal oprettes på ny og have sit eget id.
// `server_aendret` hørte til den gamle post og ryddes med.
async function genopret<T extends Post>(samling: Samling<T>, post: T): Promise<void> {
  const { pb_id, server_aendret, ...resten } = post;
  void pb_id;
  void server_aendret;

  const id = await samling.tabel.add({
    ...resten,
    aendret: new Date(),
    usendt_aendring: true
  } as T);
  efterSkrivning?.();
  await synkroniser(samling, id);
}

// Fortryder sletningen. Findes kun så længe nogen holder fast i den.
export type Genskab = () => Promise<void>;

// Sletter posten, og giver en vej tilbage.
//
// Sletningen sker med det samme og bliver ved med at være sket — den ligger
// ikke og venter på at fortrydelsesvinduet løber ud. Det er den rigtige vej
// rundt: en udskudt sletning, der forsvandt fordi telefonen røg i lommen,
// ville efterlade noget man troede var væk. Fortrydelsen genskaber i stedet.
//
// Kaldere der ikke tilbyder en fortrydelse, kan roligt se bort fra svaret.
async function slet<T extends Post>(samling: Samling<T>, id: number): Promise<Genskab | null> {
  const post = await samling.tabel.get(id);
  await samling.tabel.delete(id);
  efterSkrivning?.();

  const genskab = post ? () => genopret(samling, post) : null;

  // Nåede posten aldrig op i PocketBase, er der intet at gøre deroppe.
  if (!post?.pb_id) return genskab;

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

  return genskab;
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
    await noterFejl(e);
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
  efterSkrivning?.();
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
// Billederne kan ikke leve uden deres tur, så de følger med i sletningen —
// og med tilbage, hvis man fortryder. Ellers ville et galleri blive liggende
// i basen for evigt uden noget at høre til.
export async function sletTur(id: number): Promise<Genskab | null> {
  const tur = await db.ture.get(id);
  const billeder = tur
    ? await db.billeder.where('tur_uid').equals(tur.uid).toArray()
    : [];

  const genskabBilleder: Genskab[] = [];
  for (const billede of billeder) {
    if (billede.id === undefined) continue;
    const tilbage = await slet(billedSamling, billede.id);
    if (tilbage) genskabBilleder.push(tilbage);
  }

  const genskabTuren = await slet(turSamling, id);
  if (!genskabTuren) return null;

  return async () => {
    await genskabTuren();
    for (const tilbage of genskabBilleder) await tilbage();
  };
}

export const opretSted = (sted: Omit<Sted, 'id' | 'uid'>) => opret(stedSamling, sted);
export const opdaterSted = (id: number, aendringer: Partial<Sted>) => opdater(stedSamling, id, aendringer);
export const sletSted = (id: number) => slet(stedSamling, id);

export const opretPerson = (person: Omit<Person, 'id' | 'uid'>) => opret(personSamling, person);
export const opdaterPerson = (id: number, aendringer: Partial<Person>) => opdater(personSamling, id, aendringer);
export const sletPerson = (id: number) => slet(personSamling, id);

// Billeder oprettes og slettes, men redigeres ikke — der er ingen
// opdaterBillede. Beskrivelsen er det eneste der kan rettes, og den går
// gennem opdater() med samlingen, hvor `tilPb` sørger for ikke at sende
// filen igen.
export const opretBillede = (billede: Omit<Billede, 'id' | 'uid'>) => opret(billedSamling, billede);
export const opdaterBillede = (id: number, aendringer: Partial<Billede>) => opdater(billedSamling, id, aendringer);
export const sletBillede = (id: number) => slet(billedSamling, id);

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
    await sendUsendte(stedSamling),
    await sendUsendte(personSamling),
    await sendUsendte(billedSamling),
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
      hent(turSamling, bruger.id),
      hent(stedSamling, bruger.id),
      hent(personSamling, bruger.id),
      hent(billedSamling, bruger.id)
    ]);
    await rydFejl();
  } catch (e) {
    console.error('Kunne ikke hente data fra PocketBase:', fejlDetaljer(e));
    await noterFejl(e);
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
    const sted_uid = omdoeb.get(tur.sted_uid) ?? tur.sted_uid;
    const hero_billede = omdoeb.get(tur.hero_billede) ?? tur.hero_billede;
    const deltagere = tur.deltagere.map((d) => ({
      ...d,
      personligt_gear_ids: flyt(d.personligt_gear_ids),
      baerer_delt_ids: flyt(d.baerer_delt_ids),
      person_uid: omdoeb.get(d.person_uid) ?? d.person_uid
    }));

    const roert = aendret(tur.gruppe_ids, grupper)
      || aendret(tur.loese_item_ids, loese)
      || sted_uid !== tur.sted_uid
      || hero_billede !== tur.hero_billede
      || tur.deltagere.some((d, i) =>
        aendret(d.personligt_gear_ids, deltagere[i].personligt_gear_ids)
        || aendret(d.baerer_delt_ids, deltagere[i].baerer_delt_ids)
        || d.person_uid !== deltagere[i].person_uid);

    if (tur.id !== undefined && roert) {
      await db.ture.update(tur.id, { gruppe_ids: grupper, loese_item_ids: loese, sted_uid, hero_billede, deltagere });
    }
  }

  // Billederne peger på deres tur.
  for (const billede of await db.billeder.toArray()) {
    const tur_uid = omdoeb.get(billede.tur_uid);
    if (billede.id !== undefined && tur_uid) {
      await db.billeder.update(billede.id, { tur_uid });
    }
  }

  // Låne-loggen peger også på personer.
  for (const item of await db.items.toArray()) {
    const udlaanTil = omdoeb.get(item.udlaan?.person_uid ?? '');
    const laantAfUid = omdoeb.get(item.laant_af?.person_uid ?? '');
    if (item.id === undefined || (!udlaanTil && !laantAfUid)) continue;

    await db.items.update(item.id, {
      ...(udlaanTil && item.udlaan ? { udlaan: { ...item.udlaan, person_uid: udlaanTil } } : {}),
      ...(laantAfUid && item.laant_af ? { laant_af: { ...item.laant_af, person_uid: laantAfUid } } : {})
    });
  }
}

// Kører ved hver afstemning. Er der ingen dubletter, gør den ingenting.
export async function fjernDubletter(): Promise<number> {
  const omdoeb = new Map<Reference, Reference>();
  let fjernet = 0;

  for (const kort of [
    await fjernDubletterI(itemSamling),
    await fjernDubletterI(gruppeSamling),
    await fjernDubletterI(turSamling),
    await fjernDubletterI(stedSamling),
    await fjernDubletterI(personSamling),
    await fjernDubletterI(billedSamling)
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
