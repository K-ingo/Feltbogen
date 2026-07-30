import { vi } from 'vitest';

// En PocketBase-erstatning der holder records i hukommelsen, så sync kan
// testes uden en server. `offline` gør at alle kald fejler, ligesom når man
// ikke har forbindelse.
export interface PbMock {
  records: Map<string, Map<string, Record<string, unknown>>>;
  offline: boolean;
  kald: { metode: string; samling: string; id?: string }[];
  reset(): void;
  seed(samling: string, id: string, data?: Record<string, unknown>): void;
  ids(samling: string): string[];
}

let naesteId = 1;

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
  kald: [],

  reset() {
    this.records = new Map();
    this.offline = false;
    this.kald = [];
    naesteId = 1;
    blokering = null;
  },

  seed(samling, id, data = {}) {
    samlingAf(this, samling).set(id, {
      id,
      created: '2026-07-01 10:00:00Z',
      updated: '2026-07-01 10:00:00Z',
      ...data
    });
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

  collection: (navn: string) => ({
    async getFullList() {
      pbMock.kald.push({ metode: 'getFullList', samling: navn });
      kraevOnline();
      return [...samlingAf(pbMock, navn).values()];
    },

    async create(data: Record<string, unknown>) {
      pbMock.kald.push({ metode: 'create', samling: navn });
      kraevOnline();
      const id = `pb${naesteId++}`;
      const record = { id, created: '2026-07-01 10:00:00Z', updated: '2026-07-01 10:00:00Z', ...data };
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
      const record = { ...eksisterende, ...data, id };
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
