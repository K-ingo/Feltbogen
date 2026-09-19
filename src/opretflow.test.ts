import { describe, it, expect, beforeEach, vi } from 'vitest';

vi.mock('./pb', () => import('./test/pbMock'));

import { db } from './db';
import { opretTomTur, opretTomtItem } from './opret';
import { usendtAntal } from './sync';
import { pbMock } from './test/pbMock';
import { turFraArk, grejFraArk } from './opretark';
import type { NyTurFelter, NytGrejFelter } from './opretark';

// ─────────────────────────────────────────────
// Fra ark til post
//
// `opretark.test.ts` prøver regnestykket, og `Ark.test.tsx` prøver skærmen.
// Imellem dem er der en ledning: felterne skal blive til en post, der faktisk
// står i basen med de rigtige værdier.
//
// Den ledning var kun dækket indirekte, og det er den slags sted, hvor to
// rigtige halvdele bliver sat forkert sammen. App.tsx har ingen tests, så
// sammenkoblingen prøves her, hvor den kan prøves uden en browser.
// ─────────────────────────────────────────────

beforeEach(async () => {
  pbMock.reset();
  await Promise.all([db.ture.clear(), db.items.clear()]);
});

const turfelter = (over: Partial<NyTurFelter> = {}): NyTurFelter => ({
  titel: 'Fovslet Skov',
  fra: '2026-08-27',
  til: '2026-08-29',
  sted: 'Fovslet',
  deltagere: '',
  ...over
});

const grejfelter = (over: Partial<NytGrejFelter> = {}): NytGrejFelter => ({
  navn: 'Telt', status: 'ejer', vaegt: '2000', pris: '3499', antal: '1', ...over
});

describe('turen, som den lander i basen', () => {
  it('har det, arket spurgte om', async () => {
    const id = await opretTomTur(turFraArk(turfelter(), 'Emil'));
    const tur = await db.ture.get(id);

    expect(tur).toMatchObject({
      navn: 'Fovslet Skov',
      sted: 'Fovslet',
      startdato: '2026-08-27',
      slutdato: '2026-08-29',
      naetter: 2,
      personer: 1
    });
  });

  it('har standardværdierne med for alt det, arket ikke spurgte om', async () => {
    const id = await opretTomTur(turFraArk(turfelter(), 'Emil'));
    const tur = await db.ture.get(id);

    // En tur skal se ens ud, uanset hvor den blev startet. Kommer arket til
    // at overskrive en standardværdi, den ikke har spurgt om, er det her det
    // opdages.
    expect(tur).toMatchObject({
      status: 'kladde',
      overnatning: 'shelter',
      aktivitet: 'bushcraft',
      terraen: 'skov',
      erfaring: 'oevet',
      gruppe_ids: [],
      loese_item_ids: [],
      pakkede_item_uids: [],
      budget_linjer: [],
      feltnoter: [],
      dele_token: '',
      hero_billede: ''
    });
  });

  it('sætter opretteren på deltagerlisten sammen med dem, man skrev ind', async () => {
    const id = await opretTomTur(turFraArk(turfelter({ deltagere: 'Zindy, Noor' }), 'Emil'));
    const tur = await db.ture.get(id);

    expect(tur?.deltagere.map((d) => d.navn)).toEqual(['Emil', 'Zindy', 'Noor']);
    expect(tur?.personer).toBe(3);
  });

  it('får sit eget uid', async () => {
    const a = await opretTomTur(turFraArk(turfelter(), 'Emil'));
    const b = await opretTomTur(turFraArk(turfelter({ titel: 'En anden' }), 'Emil'));

    const [foerste, anden] = await Promise.all([db.ture.get(a), db.ture.get(b)]);
    expect(foerste?.uid).toBeTruthy();
    expect(foerste?.uid).not.toBe(anden?.uid);
  });

  it('er nået op på serveren med det samme', async () => {
    // Posten er kun halvt oprettet, hvis den bliver liggende i browseren.
    // Et pb_id er kvitteringen for, at den kom op.
    const id = await opretTomTur(turFraArk(turfelter(), 'Emil'));

    expect((await db.ture.get(id))?.pb_id).toBeTruthy();
    expect(await usendtAntal()).toBe(0);
  });

  it('venter som usendt, når man er offline', async () => {
    pbMock.offline = true;
    const id = await opretTomTur(turFraArk(turfelter(), 'Emil'));

    // Offline-first: turen findes lokalt og går op, når der er net igen.
    // Den må ikke gå tabt, fordi serveren ikke svarede.
    expect((await db.ture.get(id))?.navn).toBe('Fovslet Skov');
    expect((await db.ture.get(id))?.pb_id).toBeFalsy();
    expect(await usendtAntal()).toBeGreaterThan(0);
  });

  it('kan findes på sit navn bagefter', async () => {
    // Hele pointen med at kræve en titel: posten skal kunne findes igen.
    await opretTomTur(turFraArk(turfelter(), 'Emil'));
    const fundet = await db.ture.filter((t) => t.navn === 'Fovslet Skov').toArray();
    expect(fundet).toHaveLength(1);
  });
});

describe('grejet, som det lander i basen', () => {
  it('har det, arket spurgte om', async () => {
    const id = await opretTomtItem('ejer', grejFraArk(grejfelter()));
    const item = await db.items.get(id);

    expect(item).toMatchObject({ navn: 'Telt', status: 'ejer', vaegt_g: 2000, pris_kr: 3499, antal: 1 });
  });

  it('lander i den status, man stod i', async () => {
    const felter = grejfelter({ status: 'overvejer', navn: 'Økse' });
    const id = await opretTomtItem(felter.status, grejFraArk(felter));

    expect((await db.items.get(id))?.status).toBe('overvejer');
  });

  it('har standardværdierne med for resten', async () => {
    const id = await opretTomtItem('ejer', grejFraArk(grejfelter()));
    const item = await db.items.get(id);

    expect(item).toMatchObject({
      delt: false, tags: [], kraever: [], komplementer: [],
      vedligehold: [], vurdering: null, udlaan: null, noter: ''
    });
  });

  it('er nået op på serveren med det samme', async () => {
    const id = await opretTomtItem('ejer', grejFraArk(grejfelter()));
    expect((await db.items.get(id))?.pb_id).toBeTruthy();
  });
});

describe('ingen af dem skriver noget, før de bliver kaldt', () => {
  it('lader basen være i fred, når man bare regner felterne ud', async () => {
    // `turFraArk` og `grejFraArk` er rene. Får en af dem en bivirkning, er
    // vi tilbage ved create-before-confirm ad bagdøren.
    turFraArk(turfelter(), 'Emil');
    grejFraArk(grejfelter());

    expect(await db.ture.count()).toBe(0);
    expect(await db.items.count()).toBe(0);
    expect(await usendtAntal()).toBe(0);
  });
});
