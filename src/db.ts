import Dexie from 'dexie';
import type { Table, Transaction } from 'dexie';
// Kun typen. Den er erased ved build, så den gensidige import mellem db og
// gaest findes ikke i det der køres.
import type { Gaestesnapshot } from './gaest';

// Værdilisterne er kilden til både typerne og de knapper/dropdowns der viser
// dem, så en ny mulighed kun skal tilføjes ét sted.
export const ITEM_STATUS = ['ejer', 'overvejer', 'solgt'] as const;
export const TUR_STATUS = ['kladde', 'klar', 'aktiv', 'afsluttet'] as const;
export const OVERNATNING = ['haengekoeje', 'telt', 'shelter', 'blandet'] as const;
export const AKTIVITET = ['bushcraft', 'vandretur', 'kano', 'andet'] as const;
export const TERRAEN = ['skov', 'kyst', 'fjeld', 'mix'] as const;
export const ERFARING = ['begynder', 'oevet', 'erfaren'] as const;
export const AKTIVITETSNIVEAU = ['lav', 'middel', 'hoej'] as const;
export const PAK_AF_STATUS = ['brugt', 'ubrugt', 'i_stykker'] as const;
export const PAK_AF_NIVEAU = ['let', 'grundig'] as const;
export const KATEGORI_VURDERING = ['tilstraekkeligt', 'for_meget', 'for_lidt'] as const;

// Værdierne gemmes uden æ/ø/å, så de er stabile som nøgler og i PocketBase.
// Til visning skrives de ud på dansk.
const ETIKETTER: Record<string, string> = {
  haengekoeje: 'hængekøje',
  oevet: 'øvet',
  hoej: 'høj',
  i_stykker: 'gik i stykker',
  tilstraekkeligt: 'tilstrækkeligt',
  for_meget: 'for meget',
  for_lidt: 'for lidt'
};

export function etiket(vaerdi: string): string {
  return ETIKETTER[vaerdi] ?? vaerdi;
}

export type ItemStatus = (typeof ITEM_STATUS)[number];
export type TurStatus = (typeof TUR_STATUS)[number];
export type Overnatning = (typeof OVERNATNING)[number];
export type Aktivitet = (typeof AKTIVITET)[number];
export type Terraen = (typeof TERRAEN)[number];
export type Erfaring = (typeof ERFARING)[number];
export type Aktivitetsniveau = (typeof AKTIVITETSNIVEAU)[number];
export type PakAfStatus = (typeof PAK_AF_STATUS)[number];
export type PakAfNiveau = (typeof PAK_AF_NIVEAU)[number];
export type KategoriVurdering = (typeof KATEGORI_VURDERING)[number];

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
  // Serverens `updated` som den så ud sidst vi var enige med den. Er den en
  // anden nu, har nogen rørt posten et andet sted. Uden dette felt måtte
  // spørgsmålet afgøres ved at sammenligne serverens ur med enhedens — og de
  // går ikke ens.
  server_aendret?: string;
}

// Poster refererer til hinanden med uid, aldrig med lokale id'er.
export type Reference = string;

// Et stykke gear der er ude af huset. Personen kan være en post i person-
// tabellen, men behøver ikke at være det — man låner også ud til folk man
// ikke har tænkt sig at føre bog over.
export interface Udlaan {
  person_uid: Reference;
  navn: string;
  udlaant_dato: string;
  forventet_retur: string;
  noter: string;
}

// Den modsatte vej: noget man selv har lånt og skal huske at aflevere.
export interface Laant {
  person_uid: Reference;
  navn: string;
  laant_dato: string;
  skal_retur: string;
}

// Imprægnering af tarp, slibning af økse, olie i lygte. Det er den skjulte
// grund til at gear går i stykker: det bliver ikke passet.
export interface Vedligehold {
  id: string;
  navn: string;
  // MM/ÅÅÅÅ som købsdatoen — man husker sjældent hvilken dag man
  // imprægnerede, og måneden er præcis nok til et interval på et år.
  sidst_udfoert: string;
  interval_maaneder: number;
  noter: string;
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
  // null når gearet står hjemme. Ældre poster har feltet slet ikke — læs det
  // altid med ?? null.
  udlaan: Udlaan | null;
  laant_af: Laant | null;
  // Tom liste når der ikke er noget at holde ved lige. Ældre poster har feltet
  // slet ikke — læs det altid med ?? [].
  vedligehold: Vedligehold[];
  // 1-5, eller null når man ikke har taget stilling. Det er det eneste sted
  // appen ved, om man kan lide sit grej — resten af det den ved, er tal og
  // datoer. Ældre poster har feltet slet ikke; se vurdering.ts.
  vurdering: number | null;
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
  // Kobling til person-tabellen. Tom når deltageren bare er skrevet ind som
  // fritekst — det skal blive ved med at være nok til at komme i gang.
  person_uid: Reference;
}

// Booking af shelter eller lejrplads.
//
// Oplæggets MVP (§5.2): et link, et flueben og en reference. Den fulde
// udgave slår op i Udinaturens data, men de felter her er det der fjerner
// "shit, det havde jeg glemt" — og de virker uden noget API.
export interface Booking {
  link: string;
  booket: boolean;
  reference: string;
}

// Et foto fra en tur.
//
// Billederne hører til turen gennem `tur_uid` og ikke gennem en liste på
// turen. Med en liste ville der være to steder at holde styr på det samme, og
// et billede taget på én enhed ville først dukke op på en anden når *turen*
// var synkroniseret. Rækkefølgen er `tid` — en turdagbog læses kronologisk,
// og der er ikke noget at flytte rundt på.
//
// `blob` er billedet som det ligger på denne enhed, og `url` er det samme
// billede i PocketBase. Enheden der tog billedet, har begge dele. En anden
// enhed har kun url'en, indtil billedet vises første gang og hentes ned.
// Mindst én af dem skal være sat, ellers er posten ikke et billede.
export interface Billede extends Synkroniserbar {
  id?: number;
  // Filnavnet det kom ind med. Det er også postens `navn` i sync-laget, hvor
  // det bruges i fejlbeskeder — "kunne ikke sende billeder \"IMG_0421.jpg\"".
  navn: string;
  tur_uid: Reference;
  // Da billedet blev taget, hvis filen ved det — ellers da det blev lagt ind.
  tid: string;
  bredde: number;
  hoejde: number;
  byte: number;
  blob: Blob | null;
  url: string;
  // Originalen, urørt, som den kom ind. Den vises aldrig — den er kun til at
  // hente ned igen i fuld kvalitet, af én selv eller af de andre på turen.
  //
  // `original_blob` er kun med indtil uploaden er lykkedes, og ryddes så: den
  // der tog billedet, har det i forvejen i sin kamerarulle, og et helt
  // turgalleri i fuld størrelse ville fylde IndexedDB op. Er den aldrig nået
  // op, bliver den liggende — ellers ville originalen gå tabt for altid.
  original_blob: Blob | null;
  original_url: string;
  original_byte: number;
  beskrivelse: string;
  oprettet: Date;
  aendret: Date;
}

// Et sted man kommer tilbage til. Steder er en genbrugsressource: shelteret i
// Klosterheden er det samme shelter hver gang, og det appen ved om det —
// kildevand mod øst, myg i juli — skal ikke skrives igen for hver tur.
export interface Sted extends Synkroniserbar {
  id?: number;
  navn: string;
  koordinater: { lat: number; lng: number } | null;
  // Fra DAWA-opslaget, når stedet er fundet ad den vej.
  adresse: string;
  tags: string[];
  noter: string;
  oprettet: Date;
  aendret: Date;
}

// En man tager på tur med. "Mikkel" på to ture er to fremmede for en app der
// kun har fritekst; her bliver det den samme.
//
// Der gemmes kun navn, en valgfri e-mail og et par noter. Det bliver på
// enheden og i brugerens egen PocketBase-konto — intet deles med tredjepart,
// og gæster på en tur ser kun navnet.
export interface Person extends Synkroniserbar {
  id?: number;
  navn: string;
  email: string;
  standard_overnatning: Overnatning | null;
  noter: string;
  oprettet: Date;
  aendret: Date;
}

export interface BudgetLinje {
  id: string;
  kategori: string;
  beskrivelse: string;
  forventet_kr: number;
  faktisk_kr: number;
}

// Hvad der skete med ét stykke gear på turen. Noterne findes kun på det
// grundige niveau — på det lette er en linje tre knapper og ikke andet.
export interface PakAfLinje {
  item_uid: Reference;
  status: PakAfStatus;
  noter?: string;
}

// Hvordan en hel kategori føltes — om der var for meget eller for lidt med.
// Det er den vurdering motoren senere skal lære mængder af; en enkelt linje
// siger kun om ét item blev brugt.
export interface KategoriNote {
  kategori: string;
  vurdering: KategoriVurdering;
  noter: string;
}

// Turens efterregnskab. Uden det har smart-motoren ingen data at lære af —
// se fundamentets §8.
export interface PakAfTjek {
  udfyldt_dato: string;
  niveau: PakAfNiveau;
  // Turen som helhed, 1-5. Udeladt indtil man har sat den.
  tur_vurdering?: number;
  linjer: PakAfLinje[];
  // Kun på det grundige niveau. Skifter man tilbage til let, bliver de
  // liggende — de er dyrere at skrive end at bære rundt på.
  kategori_noter?: KategoriNote[];
}

// Alt det man glemmer, som ikke er gear: nøgler, telefon opladet, besked til
// den derhjemme. Det bor i hovedet i dag, og hovedet er et dårligt sted at
// gemme noget man kun bruger fire gange om året.
export interface AfgangsLinje {
  id: string;
  tekst: string;
  afkrydset: boolean;
  // Kom fra skabelonen i indstillingerne, i modsætning til noget man skrev
  // ind på netop denne tur. Skabelonlinjer kan genindlæses; egne kan ikke.
  fra_skabelon: boolean;
}

export interface AfgangsTjek {
  linjer: AfgangsLinje[];
}

// En dagbogsindgang fra turen. Feltbogens løfte står i navnet — turen er
// andet end en pakkeliste.
export interface Feltnote {
  id: string;
  // ISO. Indgangene står i den rækkefølge de blev skrevet, ikke i den
  // rækkefølge de blev rettet.
  tid: string;
  tekst: string;
}

export interface Tur extends Synkroniserbar {
  id?: number;
  navn: string;
  sted: string;
  // Peger på en post i sted-tabellen når turen er knyttet til et gemt sted.
  // Er den tom, står stedet kun som den fritekst der altid har været her.
  sted_uid: Reference;
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
  // Det grej der er lagt i tasken. En delmængde af det grej turen har — ikke
  // en liste for sig. Ture fra før feltet fandtes har det slet ikke, så læs
  // det altid med ?? []; se pakning.ts.
  pakkede_item_uids: Reference[];
  deltagere: Deltager[];
  budget_linjer: BudgetLinje[];
  // null indtil turen er gjort op. Ture fra før feltet fandtes har det slet
  // ikke — læs det derfor altid med ?? null.
  pak_af_tjek: PakAfTjek | null;
  // null indtil listen er taget i brug på turen.
  afgangs_tjek: AfgangsTjek | null;
  // Turlogen. Tom liste indtil man skriver den første indgang.
  feltnoter: Feltnote[];
  besked_fra_ejer: string;
  noter: string;
  vejrsnapshot: string;
  // Tom betyder ikke delt. Sættes når man laver et gæstelink og tømmes igen
  // når linket trækkes tilbage.
  dele_token: string;
  // Det gæsten får at se, frosset ned som JSON da linket blev lavet. Gæsten
  // læser aldrig inventaret — kun dette ene felt.
  dele_snapshot: string;
  // Turkortet til én pårørende: "hvis jeg ikke er hjemme torsdag, ved du hvor
  // du skal begynde at lede". Det er ikke live-tracking og ikke en app til den
  // anden — ét link med fire oplysninger.
  //
  // Felterne står fladt og ikke i ét objekt, af samme grund som dele_token og
  // dele_snapshot gør det: tokenet skal kunne filtreres på i PocketBase, og
  // snapshottet er den ene ting læsereglen åbner for. Modtageren ser aldrig
  // resten af turen.
  turkort_token: string;
  turkort_retur: string;
  turkort_besked: string;
  turkort_snapshot: string;
  // Billedet der bruges som forside i turlisten og på gæstesiden. Tomt
  // betyder det ældste — det første man tog. Feltet peger på et uid og ikke
  // på et indeks: et indeks ville pege på noget andet, så snart et billede
  // blev slettet på en anden enhed.
  hero_billede: Reference;
  // null indtil man har taget stilling til om der skal bookes.
  booking: Booking | null;
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

// Små valg der hører til denne enhed og ikke til dataene — om onboardingen
// er set, om et tip er væk. De synkroniseres ikke: to enheder kan sagtens
// have set forskellige ting.
export interface Indstilling {
  noegle: string;
  vaerdi: string;
}

// En tur en anden har delt med én, gemt så den kan findes igen uden linket.
//
// Den ligger ikke i `ture`: den er ikke ens egen, den kan ikke redigeres, og
// den skal aldrig sendes op i ens egen PocketBase-konto. Snapshottet er alt
// hvad ejeren delte — der er ingen forbindelse til hendes inventar.
export interface DeltTur {
  id?: number;
  // Linkets token. Åbner man samme link igen, opdateres den gemte i stedet
  // for at blive lagt ved siden af.
  token: string;
  // Allerede læst igennem laesSnapshot(). Ligger som objekt og ikke som JSON,
  // fordi Dexie gemmer det direkte.
  snapshot: Gaestesnapshot;
  // Adressen linket blev åbnet fra, så turen kan hentes forfra senere.
  kilde: string;
  // Turens record-id i PocketBase. Deltagelser hænger på den og ikke på
  // tokenet. Mangler på ture gemt før deltagelse fandtes.
  tur_pb_id?: string;
  gemt: Date;
  opdateret: Date;
}

export class FeltbogenDB extends Dexie {
  // Nøgletypen er number (++id), så get/add/update slipper for id-casts.
  items!: Table<Item, number>;
  grupper!: Table<Gruppe, number>;
  ture!: Table<Tur, number>;
  slettede!: Table<Slettet, number>;
  indstillinger!: Table<Indstilling, string>;
  delte_ture!: Table<DeltTur, number>;
  steder!: Table<Sted, number>;
  personer!: Table<Person, number>;
  billeder!: Table<Billede, number>;

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

    // v6 lægger et sted at huske enhedens egne valg. Ingen upgrade: tabellen
    // er tom til at begynde med, og det den mangler har fornuftige standarder.
    this.version(6).stores({
      items: '++id, &uid, navn, status, oprettet',
      grupper: '++id, &uid, navn, oprettet',
      ture: '++id, &uid, navn, startdato, status, oprettet',
      slettede: '++id, samling, pb_id, [samling+pb_id]',
      indstillinger: '&noegle'
    });

    // v7 giver turene et delefelt. Ældre ture har ingen — og en tom streng
    // betyder "ikke delt", så de har allerede den rigtige værdi.
    this.version(7).stores({
      items: '++id, &uid, navn, status, oprettet',
      grupper: '++id, &uid, navn, oprettet',
      ture: '++id, &uid, navn, startdato, status, oprettet, dele_token',
      slettede: '++id, samling, pb_id, [samling+pb_id]',
      indstillinger: '&noegle'
    });

    // v8 giver plads til ture andre har delt med én. Ingen upgrade: tabellen
    // er tom indtil man åbner sit første gæstelink.
    this.version(8).stores({
      items: '++id, &uid, navn, status, oprettet',
      grupper: '++id, &uid, navn, oprettet',
      ture: '++id, &uid, navn, startdato, status, oprettet, dele_token',
      slettede: '++id, samling, pb_id, [samling+pb_id]',
      indstillinger: '&noegle',
      delte_ture: '++id, &token, gemt'
    });

    // v9 lægger steder og personer til. Begge tabeller er tomme til at
    // begynde med, og de felter der kobler dem til ture og gear er tomme
    // strenge på ældre poster — hvilket er den rigtige værdi: de er ikke
    // koblet til noget.
    this.version(9).stores({
      items: '++id, &uid, navn, status, oprettet',
      grupper: '++id, &uid, navn, oprettet',
      ture: '++id, &uid, navn, startdato, status, oprettet, dele_token',
      slettede: '++id, samling, pb_id, [samling+pb_id]',
      indstillinger: '&noegle',
      delte_ture: '++id, &token, gemt',
      steder: '++id, &uid, navn, oprettet',
      personer: '++id, &uid, navn, oprettet'
    });

    // v10 giver plads til fotos. Ingen upgrade: tabellen er tom, og
    // `hero_billede` mangler på ældre ture — hvilket er den rigtige værdi.
    // Tomt betyder "det ældste billede", og ture uden billeder har ingen.
    //
    // Der er ikke noget indeks på `blob`. Man slår aldrig et billede op på
    // dets indhold, og et indeks på binære data ville koste plads uden at
    // give noget.
    this.version(10).stores({
      items: '++id, &uid, navn, status, oprettet',
      grupper: '++id, &uid, navn, oprettet',
      ture: '++id, &uid, navn, startdato, status, oprettet, dele_token',
      slettede: '++id, samling, pb_id, [samling+pb_id]',
      indstillinger: '&noegle',
      delte_ture: '++id, &token, gemt',
      steder: '++id, &uid, navn, oprettet',
      personer: '++id, &uid, navn, oprettet',
      billeder: '++id, &uid, tur_uid, tid, oprettet'
    });
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