import { describe, it, expect, beforeAll, vi } from 'vitest';

vi.mock('./pb', () => import('./test/pbMock'));

import { db } from './db';
import { pbMock } from './test/pbMock';
import { opretTurDag, opdaterTurDag, sletTurDag } from './sync';

beforeAll(async () => {
  pbMock.reset();
  await Promise.all([db.ture.clear(), db.tur_dage.clear()]);
});

describe('flerdages turDag domænelag og repository', () => {
  it('kan oprette, opdatere og slette en TurDag post', async () => {
    const nu = new Date();
    const id = await opretTurDag({
      tur_uid: 'tur-123',
      dag_nr: 1,
      dato: '2026-07-10',
      aktivitet: 'vandretur',
      destination_navn: 'Shelterplads A',
      destination_sted_uid: 'sted-1',
      destination_koordinater: { lat: 56.1, lng: 10.2 },
      overnatning_type: 'shelter',
      overnatning_noter: 'Booket via udinaturen',
      rute_distance_km: 14.5,
      vejrsnapshot: 'Sol, 22C',
      forbrug_vand_l: 3,
      forbrug_mad_kcal: 2500,
      noter: 'God start på turen',
      navn: 'Dag 1',
      oprettet: nu,
      aendret: nu
    });

    let dag = await db.tur_dage.get(id);
    expect(dag).toBeDefined();
    expect(dag?.destination_navn).toBe('Shelterplads A');
    expect(dag?.rute_distance_km).toBe(14.5);

    await opdaterTurDag(id, { rute_distance_km: 16.0 });
    dag = await db.tur_dage.get(id);
    expect(dag?.rute_distance_km).toBe(16.0);

    await sletTurDag(id);
    dag = await db.tur_dage.get(id);
    expect(dag).toBeUndefined();
  });
});
