import { describe, it, expect, beforeAll, vi } from 'vitest';

vi.mock('./pb', () => import('./test/pbMock'));

import { db } from './db';
import type { Tur } from './db';
import { pbMock, saetTestNavn } from './test/pbMock';
import { forslagTilTur } from './forslag';

beforeAll(async () => {
  pbMock.reset();
  saetTestNavn('Emil');
  await Promise.all([db.ture.clear(), db.items.clear(), db.grupper.clear(), db.steder.clear()]);
});

describe('foerste tur wizard & kladde-logik', () => {
  it('kan generere en kladde-tur til smart-motoren uden at oprette i DB først', () => {
    const kladdeTur: Tur = {
      uid: 'draft-wizard',
      navn: 'Min første tur',
      startdato: '2026-08-01',
      slutdato: '2026-08-03',
      naetter: 2,
      personer: 1,
      overnatning: 'telt',
      aktivitet: 'vandretur',
      terraen: 'skov',
      baereafstand_km: 0,
      erfaring: 'begynder',
      sted: 'Mols Bjerge',
      sted_uid: '',
      koordinater: null,
      status: 'kladde',
      gruppe_ids: [],
      loese_item_ids: [],
      pakkede_item_uids: [],
      afgangs_tjek: null,
      deltagere: [],
      budget_linjer: [],
      feltnoter: [],
      pak_af_tjek: null,
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
      oprettet: new Date(),
      aendret: new Date()
    };

    const forslag = forslagTilTur(kladdeTur, [], [], []);
    expect(Array.isArray(forslag)).toBe(true);
  });
});
