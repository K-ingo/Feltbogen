import { vi } from 'vitest';

// En PocketBase-erstatning der holder records i hukommelsen, så sync kan
// testes uden en server. `offline` gør at alle kald fejler, ligesom når man
// ikke har forbindelse.
export interface PbMock {
  records: Map<string, Map<string, Record<string, unknown>>>;
  offline: boolean;
  // Efterligner en samling uden uid-felt i skemaet: PocketBase dropper
  // lydløst felter den ikke kender.
  udenUidFelt: boolean;
  kald: { metode: string; samling: string; id?: string }[];
  reset(): void;
  seed(samling: string, id: string, data?: Record<string, unknown>): void;
  roer(samling: string, id: string, aendringer: Record<string, unknown>): void;
  ids(samling: string): string[];
}

let naesteId = 1;

// PocketBase sætter `updated` ved hvert skriv. Uret rykker et sekund pr.
// skrivning, så to ændringer kan skelnes uden at en test skal vente.
let ur = Date.parse('2026-07-01T10:00:00Z');
function tik(): string {
  ur += 1000;
  return new Date(ur).toISOString().replace('T', ' ').replace('.000Z', 'Z');
}

function samlingAf(mock: PbMock, navn: string) {
  let s = mock.records.get(navn);
  if (!s) {
    s = new Map();
    mock.records.set(navn, s);
  }
  return s;
}

export const pbMock: PbMock = {
  records: new Map(),
  offline: false,
  udenUidFelt: false,
  kald: [],

  reset() {
    this.records = new Map();
    this.offline = false;
    this.udenUidFelt = false;
    this.kald = [];
    naesteId = 1;
    ur = Date.parse('2026-07-01T10:00:00Z');
    blokering = null;
  },

  // En record i PocketBase har altid en ejer, og hentningen filtrerer på den.
  // Uden en standard skulle hver eneste seed i testene gentage den samme
  // testbruger — så den sættes her, og kan stadig overskrives.
  seed(samling, id, data = {}) {
    const nu = tik();
    samlingAf(this, samling).set(id, { id, created: nu, updated: nu, user: 'bruger1', ...data });
  },

  // En anden enhed har rettet posten: felterne ændres, og `updated` rykker.
  roer(samling, id, aendringer) {
    const eksisterende = samlingAf(this, samling).get(id);
    if (!eksisterende) throw new Error(`Ukendt record ${samling}/${id}`);
    samlingAf(this, samling).set(id, { ...eksisterende, ...aendringer, id, updated: tik() });
  },

  ids(samling) {
    return [...samlingAf(this, samling).keys()];
  }
};

function kraevOnline() {
  if (pbMock.offline) {
    const fejl = new Error('Failed to fetch') as Error & { status: number };
    fejl.status = 0;
    throw fejl;
  }
}

// Holder næste update-kald i luften, så en test kan ramme vinduet hvor
// serveren er kontaktet men endnu ikke har svaret — uden at gætte på timing.
let blokering: { naaetFrem: () => void; slippet: Promise<void> } | null = null;

export function blokerNaesteUpdate() {
  let naaetFrem!: () => void;
  let slip!: () => void;
  const naaet = new Promise<void>((klar) => { naaetFrem = klar; });
  const slippet = new Promise<void>((klar) => { slip = klar; });

  blokering = { naaetFrem, slippet };
  return { naaet, slip };
}

export const pb = {
  autoCancellation: vi.fn(),

  filter: (raa: string, params: Record<string, unknown> = {}) =>
    raa.replace(/\{:(\w+)\}/g, (_, n) => JSON.stringify(params[n])),

  // Filadresser. Den rigtige klient bygger den af collectionId og record-id;
  // her er formen ligegyldig, så længe den er stabil og entydig.
  files: {
    getURL: (record: { id?: string }, filnavn: string) =>
      filnavn ? `https://test.pb/api/files/${record.id}/${filnavn}` : ''
  },

  collection: (navn: string) => ({
    async getFullList(opts: { filter?: string } = {}) {
      pbMock.kald.push({ metode: 'getFullList', samling: navn });
      kraevOnline();
      return filtreret([...samlingAf(pbMock, navn).values()], opts.filter);
    },

    // Gæstesiden slår op på ét felt. Filteret er allerede skrevet ud af
    // pb.filter ovenfor, så her skal der kun læses `felt = "værdi"`.
    async getList(_side: number, perSide: number, opts: { filter?: string } = {}) {
      pbMock.kald.push({ metode: 'getList', samling: navn });
      kraevOnline();

      const fundne = filtreret([...samlingAf(pbMock, navn).values()], opts.filter);
      return { page: 1, perPage: perSide, totalItems: fundne.length, items: fundne.slice(0, perSide) };
    },

    async create(data: Record<string, unknown>) {
      pbMock.kald.push({ metode: 'create', samling: navn });
      kraevOnline();
      const id = `pb${naesteId++}`;
      const nu = tik();
      const record = { id, created: nu, updated: nu, ...gemtData(medFilnavne(data)) };
      samlingAf(pbMock, navn).set(id, record);
      return record;
    },

    async update(id: string, data: Record<string, unknown>) {
      pbMock.kald.push({ metode: 'update', samling: navn, id });
      kraevOnline();

      if (blokering) {
        const denne = blokering;
        blokering = null;
        denne.naaetFrem();
        await denne.slippet;
      }

      const eksisterende = samlingAf(pbMock, navn).get(id);
      if (!eksisterende) throw ikkeFundet();
      const record = { ...eksisterende, ...gemtData(medFilnavne(data)), id, updated: tik() };
      samlingAf(pbMock, navn).set(id, record);
      return record;
    },

    async delete(id: string) {
      pbMock.kald.push({ metode: 'delete', samling: navn, id });
      kraevOnline();
      if (!samlingAf(pbMock, navn).has(id)) throw ikkeFundet();
      samlingAf(pbMock, navn).delete(id);
      return true;
    }
  })
};

// Filteret er allerede skrevet ud af pb.filter, så her skal der kun læses
// `felt = "værdi"`. Andre former bruges ikke af appen.
function filtreret(poster: Record<string, unknown>[], filter?: string) {
  const m = /^(\w+)\s*=\s*(.+)$/.exec(filter ?? '');
  if (!m) return poster;
  return poster.filter((r) => JSON.stringify(r[m[1]] ?? '') === m[2].trim());
}

// PocketBase gemmer filnavnet i feltet, ikke filen. Mocken gør det samme, så
// en test kan se forskel på "filen blev sendt" og "filen blev sendt igen".
function medFilnavne(data: Record<string, unknown>): Record<string, unknown> {
  const ud: Record<string, unknown> = {};
  for (const [felt, vaerdi] of Object.entries(data)) {
    ud[felt] = vaerdi instanceof File ? vaerdi.name
      : vaerdi instanceof Blob ? 'fil.jpg'
        : vaerdi;
  }
  return ud;
}

// Felter uden for skemaet forsvinder, præcis som i PocketBase.
function gemtData(data: Record<string, unknown>): Record<string, unknown> {
  if (!pbMock.udenUidFelt) return data;
  const { uid, ...resten } = data;
  void uid;
  return resten;
}

function ikkeFundet() {
  const fejl = new Error("The requested resource wasn't found.") as Error & { status: number };
  fejl.status = 404;
  return fejl;
}

export const nuvaerendeBruger = () => ({
  id: 'bruger1',
  email: 'test@eksempel.dk',
  created: '2026-01-01 00:00:00Z',
  updated: '2026-01-01 00:00:00Z'
});

// Profilnavnet. Testene sætter det direkte, så de kan vise hvad der sker med
// og uden et navn på kontoen.
export let testNavn = '';
export function saetTestNavn(navn: string) { testNavn = navn; }

// Testenes session udløber ikke, så der er intet at forny.
export const erLoggetInd = () => true;
export const fornyLogin = async () => {};

export const mitNavn = () => testNavn.trim();
export const gemNavn = async (navn: string) => { testNavn = navn.trim(); };
export const logUd = () => { testNavn = ''; };
