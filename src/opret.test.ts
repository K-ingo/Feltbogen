import { describe, it, expect, beforeEach, vi } from 'vitest';

vi.mock('./pb', () => import('./test/pbMock'));

import { db } from './db';
import { pbMock, saetTestNavn } from './test/pbMock';
import { opretTomTur, opretTomtItem, opretTomGruppe } from './opret';

beforeEach(async () => {
  pbMock.reset();
  saetTestNavn('');
  await Promise.all([db.ture.clear(), db.items.clear(), db.grupper.clear()]);
});

// Ejeren af turen skal selv stå på deltagerlisten. Uden det kunne hun ikke
// fordele sit eget grej på sin egen tur.
describe('opretTomTur', () => {
  it('sætter den der opretter turen på deltagerlisten', async () => {
    const tur = await db.ture.get(await opretTomTur());

    expect(tur?.deltagere).toHaveLength(1);
    expect(tur?.deltagere[0].overnatning).toBeNull();
    expect(tur?.deltagere[0].personligt_gear_ids).toEqual([]);
  });

  it('bruger navnet fra profilen', async () => {
    saetTestNavn('Emil');
    const tur = await db.ture.get(await opretTomTur());
    expect(tur?.deltagere[0].navn).toBe('Emil');
  });

  // Har man ikke sat et navn, står deltageren der stadig — man kan skrive
  // navnet på turen bagefter. Et tomt navn er bedre end ingen deltager.
  it('laver deltageren alligevel uden et navn på profilen', async () => {
    const tur = await db.ture.get(await opretTomTur());
    expect(tur?.deltagere).toHaveLength(1);
    expect(tur?.deltagere[0].navn).toBe('');
  });

  it('giver deltageren et id der kan peges på', async () => {
    const tur = await db.ture.get(await opretTomTur());
    expect(tur?.deltagere[0].id).toBeTruthy();
  });

  it('giver to ture hver deres deltager-id', async () => {
    const [a, b] = [await db.ture.get(await opretTomTur()), await db.ture.get(await opretTomTur())];
    expect(a?.deltagere[0].id).not.toBe(b?.deltagere[0].id);
  });
});

// Gear og grupper har ingen deltagere — de skal ikke have rørt noget her.
describe('de øvrige tomme poster', () => {
  it('opretter et item uden navn', async () => {
    const item = await db.items.get(await opretTomtItem());
    expect(item?.navn).toBe('');
    expect(item?.status).toBe('ejer');
  });

  it('opretter en gruppe uden navn', async () => {
    const gruppe = await db.grupper.get(await opretTomGruppe());
    expect(gruppe?.navn).toBe('');
    expect(gruppe?.item_ids).toEqual([]);
  });
});
