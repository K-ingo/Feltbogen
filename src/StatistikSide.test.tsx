// @vitest-environment jsdom
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

vi.mock('./pb', () => import('./test/pbMock'));

import { db } from './db';
import type { PakAfLinje, PakAfStatus } from './db';
import StatistikSide from './StatistikSide';
import { lavItem, lavTur } from './test/data';
import { tegn, DESKTOP } from './test/skaerm';

// ─────────────────────────────────────────────
// Læringsafsnittet
//
// Regnestykkerne er testet for sig i laering.test.ts. Det her er skærmen: at
// den siger fra, når grundlaget er for tyndt, og at den ikke påstår noget, den
// ikke kan vide.
// ─────────────────────────────────────────────

const tjek = (linjer: [string, PakAfStatus][]) => ({
  udfyldt_dato: '2026-07-20',
  niveau: 'let' as const,
  linjer: linjer.map(([item_uid, status]): PakAfLinje => ({ item_uid, status }))
});

// Turene lægges i indeværende år, så standardperioden "I år" rammer dem.
const iAar = (maaned: number) => `${new Date().getFullYear()}-0${maaned}-10`;

beforeEach(async () => {
  await Promise.all([db.items.clear(), db.ture.clear(), db.grupper.clear(), db.steder.clear()]);
  vi.spyOn(console, 'error').mockImplementation(() => {});
});

const vis = () => tegn(
  <StatistikSide fane="statistik" skift={vi.fn()} aabnItem={vi.fn()} aabnAar={vi.fn()} />,
  DESKTOP
);

describe('grundlaget for mønstre', () => {
  it('siger fra, når ingen ture er gjort op', async () => {
    await db.items.add(lavItem({ navn: 'Økse' }));
    await db.ture.add(lavTur({ startdato: iAar(5), pak_af_tjek: null }));

    vis();

    expect(await screen.findByText('Mønstre i grejet')).toBeInTheDocument();
    expect(screen.getByText(/ingen ture gjort op/i)).toBeInTheDocument();
  });

  it('siger hvor mange ture der mangler', async () => {
    await db.items.add(lavItem({ uid: 'u-1', navn: 'Økse' }));
    await db.ture.add(lavTur({ startdato: iAar(5), pak_af_tjek: tjek([['u-1', 'brugt']]) }));

    vis();

    expect(await screen.findByText(/2 ture mere/i)).toBeInTheDocument();
  });
});

describe('hyldevarerne', () => {
  const treTure = () => [1, 2, 3].map((m) => lavTur({
    startdato: iAar(m),
    loese_item_ids: ['u-bog'],
    pak_af_tjek: tjek([['u-bog', 'ubrugt']])
  }));

  it('siger hvad man kan lade blive hjemme', async () => {
    await db.items.add(lavItem({ uid: 'u-bog', navn: 'Bog', vaegt_g: 400 }));
    await db.ture.bulkAdd(treTure());

    vis();

    // "Bog" står også under "Mest brugte grej", og det er rigtigt nok — den
    // var jo med. Assertionen skal derfor afgrænses til hyldevare-kortet.
    const titel = await screen.findByText(/Med hver gang, aldrig brugt/);
    const kort = titel.closest('div')!.parentElement!;

    expect(within(kort).getByText('Bog')).toBeInTheDocument();
    expect(within(kort).getByText(/med 3 gange/i)).toBeInTheDocument();
  });

  it('siger ingenting, når grejet faktisk bliver brugt', async () => {
    await db.items.add(lavItem({ uid: 'u-bog', navn: 'Bog', vaegt_g: 400 }));
    await db.ture.bulkAdd([1, 2, 3].map((m) => lavTur({
      startdato: iAar(m),
      pak_af_tjek: tjek([['u-bog', 'brugt']])
    })));

    vis();

    // Grundlaget er der — der står bare ingen hyldevarer.
    expect(await screen.findByText('Nætter i år')).toBeInTheDocument();
    expect(screen.queryByText(/Med hver gang, aldrig brugt/)).not.toBeInTheDocument();
  });
});

describe('stjernerne', () => {
  it('viser de bedst bedømte og hvor tyndt det er', async () => {
    await db.items.bulkAdd([
      lavItem({ navn: 'Elsket', vurdering: 5 }),
      lavItem({ navn: 'Skuffelse', vurdering: 1 }),
      lavItem({ navn: 'Aldrig vurderet' })
    ]);
    await db.ture.add(lavTur({ startdato: iAar(5) }));

    vis();

    expect(await screen.findByText('Bedst bedømt')).toBeInTheDocument();
    expect(screen.getByText('Elsket')).toBeInTheDocument();
    expect(screen.getByText('2 af 3 stykker grej er vurderet')).toBeInTheDocument();
  });

  // Med tre vurderinger i alt ville den nederste også stå på listen ovenfor.
  it('viser ikke "dårligst", når alt vurderet allerede står under "bedst"', async () => {
    await db.items.bulkAdd([
      lavItem({ navn: 'A', vurdering: 5 }),
      lavItem({ navn: 'B', vurdering: 3 })
    ]);
    await db.ture.add(lavTur({ startdato: iAar(5) }));

    vis();

    expect(await screen.findByText('Bedst bedømt')).toBeInTheDocument();
    expect(screen.queryByText('Dårligst bedømt')).not.toBeInTheDocument();
  });

  it('siger ingenting, når intet er vurderet', async () => {
    await db.items.add(lavItem({ navn: 'Uvurderet' }));
    await db.ture.add(lavTur({ startdato: iAar(5) }));

    vis();

    expect(await screen.findByText('Nætter i år')).toBeInTheDocument();
    expect(screen.queryByText('Bedst bedømt')).not.toBeInTheDocument();
  });
});

describe('tallene om perioden', () => {
  it('lægger nætterne sammen og siger snittet', async () => {
    await db.ture.bulkAdd([
      lavTur({ startdato: iAar(5), naetter: 2 }),
      lavTur({ startdato: iAar(6), naetter: 1 })
    ]);
    await db.items.add(lavItem({ navn: 'Økse' }));

    vis();

    expect(await screen.findByText('Nætter i år')).toBeInTheDocument();
    expect(screen.getByText('3')).toBeInTheDocument();
    expect(screen.getByText(/1\.5 pr\. tur i snit/)).toBeInTheDocument();
  });

  it('viser gennemsnitsvægten over de ture, der havde grej med', async () => {
    await db.items.add(lavItem({ uid: 'u-telt', navn: 'Telt', vaegt_g: 2000 }));
    await db.ture.bulkAdd([
      lavTur({ startdato: iAar(5), loese_item_ids: ['u-telt'] }),
      lavTur({ startdato: iAar(6), loese_item_ids: [] })
    ]);

    vis();

    expect(await screen.findByText('Gennemsnitsvægt pr. tur')).toBeInTheDocument();
    expect(screen.getByText(/bygger på én tur med valgt grej/i)).toBeInTheDocument();
  });

  it('følger perioden, man har valgt', async () => {
    await db.items.add(lavItem({ navn: 'Økse' }));
    await db.ture.bulkAdd([
      lavTur({ startdato: iAar(5), naetter: 2 }),
      lavTur({ startdato: `${new Date().getFullYear() - 1}-05-10`, naetter: 7 })
    ]);

    vis();

    expect(await screen.findByText('Nætter i år')).toBeInTheDocument();
    expect(screen.getByText('2')).toBeInTheDocument();

    await userEvent.click(screen.getAllByRole('button', { name: 'Alt' })[0]);

    expect(await screen.findByText('9')).toBeInTheDocument();
  });
});
