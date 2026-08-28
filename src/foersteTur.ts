import type { Aktivitet, Overnatning, Reference, Tur } from './db';
import { AKTIVITET, OVERNATNING } from './db';
import { maanedsnavn } from './datotekst';
import { saet, laes } from './indstillinger';
import { mitNavn } from './pb';

// Den første tur.
//
// En tom turskærm med fjorten felter er ikke svær at bruge, men den er svær at
// begynde på: den spørger om alt på én gang, og den spørger om det, før den
// har fortjent svaret. Første gang nogen åbner Feltbogen, er der ingen ture at
// kopiere fra og intet grej at pakke — og så er en formular det værste sted at
// stå.
//
// Derfor spørger vi ét ad gangen, og kun om det, motoren rent faktisk kan
// bruge til noget: hvor, hvornår, hvad slags tur, hvor mange. Fire spørgsmål,
// alle sammen med et svar man kan springe over, og til sidst et forslag frem
// for en tom liste.
//
// Tre ting holder den her fil fast på:
//
// Kladden er ikke en tur. Den bliver ikke skrevet i tur-tabellen, den bliver
// ikke synkroniseret, og den kan ikke findes i turlisten. Den lever i
// indstillingstabellen, som er enhedens egen — netop fordi en halvfærdig
// tanke ikke skal dukke op på telefonen hos resten af holdet.
//
// Der findes ingen wizard-model ved siden af Tur. `turFraKladde` laver en
// ganske almindelig Tur, og fra det øjeblik den er oprettet, er det de
// almindelige skærme, der overtager. Flowet er en indgang, ikke en verden.
//
// Og kladden overlever, at man lukker appen. Det er hele forskellen på et
// flow, man tør begynde på, og et man ikke gør.

export interface Kladde {
  sted: string;
  // Peger på et gemt sted, hvis man valgte et. Tom når stedet kun er skrevet.
  sted_uid: Reference;
  startdato: string;
  naetter: number;
  aktivitet: Aktivitet | null;
  overnatning: Overnatning | null;
  // Hvor mange der tager af sted i alt, den der planlægger talt med.
  personer: number;
  // Navnene på de andre. Må gerne være færre end `personer` — man kan sagtens
  // vide, at man er fire, uden at vide hvem den fjerde er endnu.
  medrejsende: string[];
  // Grej valgt fra forslagene på sidste trin. Ligger på kladden og ikke i
  // basen, fordi turen endnu ikke findes.
  gruppe_ids: Reference[];
  loese_item_ids: Reference[];
}

export const TOM_KLADDE: Kladde = {
  sted: '',
  sted_uid: '',
  startdato: '',
  naetter: 1,
  aktivitet: null,
  overnatning: null,
  personer: 1,
  medrejsende: [],
  gruppe_ids: [],
  loese_item_ids: []
};

// ─────────────────────────────────────────────
// Trinnene

export const TRIN = ['hvor', 'hvornaar', 'hvad', 'hvem', 'forslag'] as const;
export type Trin = (typeof TRIN)[number];

// Spørgsmålet står i overskriften og ikke som en label over et felt, fordi
// der kun er ét ad gangen. Underteksten siger, hvad svaret bruges til — et
// spørgsmål, man ikke kan se pointen i, er et spørgsmål, man springer over.
export const TRINTEKST: Record<Trin, { spoergsmaal: string; hvorfor: string }> = {
  hvor: {
    spoergsmaal: 'Hvor skal du hen?',
    hvorfor: 'Stedet giver turen sit navn, og har du været der før, kan Feltbogen huske hvordan der var.'
  },
  hvornaar: {
    spoergsmaal: 'Hvornår?',
    hvorfor: 'Årstiden afgør det meste af pakningen, og antallet af nætter afgører resten.'
  },
  hvad: {
    spoergsmaal: 'Hvad er det for en tur?',
    hvorfor: 'Aktivitet og overnatning er dét, forslagene bygger på.'
  },
  hvem: {
    spoergsmaal: 'Hvem tager med?',
    hvorfor: 'Er I flere, kan det fælles grej deles — og så bliver rygsækken lettere.'
  },
  forslag: {
    spoergsmaal: 'Så mangler du kun grejet',
    hvorfor: 'Her er, hvad Feltbogen ville tage med. Du kan altid ændre det bagefter.'
  }
};

export function naesteTrin(trin: Trin): Trin {
  return TRIN[Math.min(TRIN.indexOf(trin) + 1, TRIN.length - 1)];
}

export function forrigeTrin(trin: Trin): Trin {
  return TRIN[Math.max(TRIN.indexOf(trin) - 1, 0)];
}

// Er der svaret på trinnet? Bruges kun til at vise, hvor langt man er — ikke
// til at spærre for det næste trin. Alle fire spørgsmål kan springes over.
export function erBesvaret(trin: Trin, kladde: Kladde): boolean {
  switch (trin) {
    case 'hvor': return kladde.sted.trim() !== '';
    case 'hvornaar': return kladde.startdato !== '';
    case 'hvad': return kladde.aktivitet !== null || kladde.overnatning !== null;
    case 'hvem': return kladde.personer > 1 || kladde.medrejsende.length > 0;
    case 'forslag': return kladde.gruppe_ids.length > 0 || kladde.loese_item_ids.length > 0;
  }
}

// Om kladden overhovedet er begyndt. En kladde uden ét eneste svar er ikke
// værd at gemme og ikke værd at tilbyde at fortsætte.
export function erPaabegyndt(kladde: Kladde): boolean {
  return TRIN.some((t) => erBesvaret(t, kladde));
}

// Nok til at motoren kan sige noget kvalificeret. Under det viser sidste trin
// et ærligt "du har ikke fortalt mig nok endnu" i stedet for et gæt, der
// lader som om det ved noget.
export function nokTilForslag(kladde: Kladde): boolean {
  return kladde.aktivitet !== null || kladde.overnatning !== null || kladde.startdato !== '';
}

// ─────────────────────────────────────────────
// Fra kladde til tur

// Slutdatoen regnes af nætterne og skrives ikke ind af nogen. To felter til det
// samme spørgsmål er to steder at tage fejl.
export function slutdatoFor(startdato: string, naetter: number): string {
  if (!startdato) return '';
  const d = new Date(startdato);
  if (Number.isNaN(d.getTime())) return '';
  d.setDate(d.getDate() + Math.max(0, Math.round(naetter)));
  return d.toISOString().slice(0, 10);
}

// I dag og de to kommende weekender — de datoer man vælger uden at slå op.
// Længere ud end det er en dato, man finder i kalenderen, og så er datofeltet
// det rigtige sted.
//
// Falder to genveje på den samme dag — det gør de om fredagen — vises kun den
// første. To knapper, der gør det samme, er ikke to valg.
export function genveje(nu: Date = new Date()): { navn: string; dato: string }[] {
  const iso = (d: Date) => d.toISOString().slice(0, 10);
  const fredag = new Date(nu);
  fredag.setDate(fredag.getDate() + ((5 - fredag.getDay() + 7) % 7));
  const naeste = new Date(fredag);
  naeste.setDate(naeste.getDate() + 7);

  const alle = [
    { navn: 'I dag', dato: iso(nu) },
    { navn: 'Denne weekend', dato: iso(fredag) },
    { navn: 'Næste weekend', dato: iso(naeste) }
  ];

  return alle.filter((g, i) => alle.findIndex((a) => a.dato === g.dato) === i);
}

// "Rold Skov i september". Har man ikke sagt hvor, får turen intet navn — et
// gættet navn er værre end et tomt, fordi man skal slette det først.
export function navnForslag(kladde: Kladde): string {
  const sted = kladde.sted.trim();
  if (!sted) return '';
  const maaned = maanedsnavn(kladde.startdato);
  return maaned ? `${sted} i ${maaned}` : sted;
}

// Hvor mange der er af sted. Tallet er svaret, navnene er en præcisering af
// det — så hvis man har skrevet flere navne, end man har sagt personer, er
// navnene dem, der ved bedst. Den ene skal ikke kunne modsige den anden.
export function antalPersoner(kladde: Kladde): number {
  return Math.max(1, kladde.personer, 1 + kladde.medrejsende.length);
}

// Kladden som den tur, den er ved at blive. Uid'et er et pladsholder-uid:
// `opretTur` giver turen sit rigtige, og indtil da bruges det kun af motoren,
// der skal have en Tur at regne på.
export const KLADDE_UID = 'kladde';

export function turFraKladde(kladde: Kladde, nu: Date = new Date()): Tur {
  const idag = nu.toISOString().slice(0, 10);
  const startdato = kladde.startdato || idag;

  return {
    uid: KLADDE_UID,
    navn: navnForslag(kladde),
    sted: kladde.sted.trim(),
    sted_uid: kladde.sted_uid,
    koordinater: null,
    startdato,
    slutdato: slutdatoFor(startdato, kladde.naetter),
    naetter: Math.max(0, Math.round(kladde.naetter)),
    personer: antalPersoner(kladde),
    // Standarderne er de samme som en tom turs. Springer man et spørgsmål
    // over, skal man ende samme sted, som hvis man havde trykket "+ Ny tur".
    overnatning: kladde.overnatning ?? 'shelter',
    aktivitet: kladde.aktivitet ?? 'bushcraft',
    terraen: 'skov',
    baereafstand_km: 0,
    // Flowet findes for dem, der ikke har været her før. Erfaringen bliver
    // ikke spurgt om — den ville være det femte spørgsmål, og svaret ville
    // være et gæt om en selv frem for om turen.
    erfaring: 'oevet',
    status: 'kladde',
    gruppe_ids: [...kladde.gruppe_ids],
    loese_item_ids: [...kladde.loese_item_ids],
    pakkede_item_uids: [],
    deltagere: [
      { id: crypto.randomUUID(), navn: mitNavn(), overnatning: null, personligt_gear_ids: [], baerer_delt_ids: [], person_uid: '' },
      ...kladde.medrejsende
        .map((navn) => navn.trim())
        .filter((navn) => navn !== '')
        .map((navn) => ({
          id: crypto.randomUUID(),
          navn,
          overnatning: null,
          personligt_gear_ids: [],
          baerer_delt_ids: [],
          person_uid: ''
        }))
    ],
    budget_linjer: [],
    pak_af_tjek: null,
    afgangs_tjek: null,
    feltnoter: [],
    besked_fra_ejer: '',
    noter: '',
    vejrsnapshot: '',
    dele_token: '',
    dele_snapshot: '',
    turkort_token: '',
    turkort_retur: '',
    turkort_besked: '',
    turkort_snapshot: '',
    hero_billede: '',
    booking: null,
    oprettet: nu,
    aendret: nu
  };
}

// ─────────────────────────────────────────────
// Kladden på disken
//
// Indstillingstabellen kan kun tekst, så kladden gemmes som JSON — på samme
// måde som afgangs-tjekkets skabelon. Tabellen er lokal og synkroniseres
// ikke, og det er præcis dét, der gør den til det rigtige sted.

export const KLADDE_NOEGLE = 'foerste_tur_kladde';

export function gemKladde(kladde: Kladde): Promise<void> {
  return saet(KLADDE_NOEGLE, JSON.stringify(kladde));
}

export async function hentKladde(): Promise<Kladde | null> {
  return laesKladde(await laes(KLADDE_NOEGLE));
}

export function rydKladde(): Promise<void> {
  return saet(KLADDE_NOEGLE, '');
}

// Læsningen tror ikke på noget. Teksten kan komme fra en ældre udgave af
// appen, fra en halvskrevet skrivning eller fra en hånd i udviklerværktøjet —
// og en kladde, der får skærmen til at gå i stykker, er værre end ingen
// kladde. Hvert felt tages kun med, hvis det har den form, det skal have;
// resten falder tilbage på den tomme kladde.
export function laesKladde(tekst: string | null): Kladde | null {
  if (!tekst) return null;

  let raa: unknown;
  try {
    raa = JSON.parse(tekst);
  } catch {
    return null;
  }
  if (typeof raa !== 'object' || raa === null) return null;
  const o = raa as Record<string, unknown>;

  const kladde: Kladde = {
    sted: tekst_(o.sted),
    sted_uid: tekst_(o.sted_uid),
    startdato: tekst_(o.startdato),
    naetter: tal(o.naetter, TOM_KLADDE.naetter),
    aktivitet: valg(o.aktivitet, AKTIVITET),
    overnatning: valg(o.overnatning, OVERNATNING),
    personer: Math.max(1, tal(o.personer, 1)),
    medrejsende: tekstliste(o.medrejsende),
    gruppe_ids: tekstliste(o.gruppe_ids),
    loese_item_ids: tekstliste(o.loese_item_ids)
  };

  // En kladde uden et eneste svar er det samme som ingen kladde — så skal der
  // ikke stå "fortsæt hvor du slap" for noget, ingen har skrevet.
  return erPaabegyndt(kladde) ? kladde : null;
}

function tekst_(v: unknown): string {
  return typeof v === 'string' ? v : '';
}

function tal(v: unknown, standard: number): number {
  return typeof v === 'number' && Number.isFinite(v) ? v : standard;
}

function tekstliste(v: unknown): string[] {
  return Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : [];
}

function valg<T extends string>(v: unknown, tilladte: readonly T[]): T | null {
  return tilladte.includes(v as T) ? (v as T) : null;
}
