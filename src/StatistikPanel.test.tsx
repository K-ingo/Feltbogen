// @vitest-environment jsdom
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

vi.mock('./pb', () => import('./test/pbMock'));

import { db } from './db';
import type { PakAfLinje, PakAfStatus } from './db';
import StatistikPanel from './StatistikPanel';
import { lavItem, lavTur } from './test/data';
import { tegn, DESKTOP } from './test/skaerm';

// ─────────────────────────────────────────────
// Statistik-fanen på Friluftshistorik
//
// Regnestykkerne er testet for sig i laering.test.ts og
// friluftshistorik.test.ts. Det her er skærmen: at de rolige tal står øverst,
// at mønstrene ligger foldet sammen bagved, og at den siger fra, når
// grundlaget er for tyndt — den påstår ikke noget, den ikke kan vide.
// ─────────────────────────────────────────────

const tjek = (linjer: [string, PakAfStatus][]) => ({
  udfyldt_dato: '2026-07-20',
  niveau: 'let' as const,
  linjer: linjer.map(([item_uid, status]): PakAfLinje => ({ item_uid, status }))
});

// Turene lægges i indeværende år, så standardperioden rammer dem.
const AAR = new Date().getFullYear();
const iAar = (maaned: number) => `${AAR}-0${maaned}-10`;

beforeEach(async () => {
  await Promise.all([db.items.clear(), db.ture.clear(), db.grupper.clear(), db.steder.clear()]);
  vi.spyOn(console, 'error').mockImplementation(() => {});
});

const vis = () => tegn(<StatistikPanel aabnItem={vi.fn()} />, DESKTOP);

// Mønstrene ligger bag en fold. Testene, der handler om dem, slår den op
// først — ligesom man selv gør.
const visMoenstre = async () => {
  vis();
  await userEvent.click(await screen.findByRole('button', { name: /hvad turene har lært os/i }));
};

// Kortet omkring en widget-overskrift, så en assertion kan afgrænses til det.
const widget = (titel: string | RegExp) =>
  screen.getByText(titel).closest('div')!.parentElement as HTMLElement;

describe('de rolige tal øverst', () => {
  it('viser ture, nætter, grej og kilo', async () => {
    await db.ture.bulkAdd([
      lavTur({ startdato: iAar(8), naetter: 2 }),
      lavTur({ startdato: iAar(9), naetter: 1 })
    ]);
    await db.items.add(lavItem({ navn: 'Telt', vaegt_g: 2400 }));

    vis();

    const felter = ['Ture', 'Nætter', 'Grej i bog', 'Kg grej'];
    for (const navn of felter) {
      expect(await screen.findByText(navn)).toBeInTheDocument();
    }

    const tal = (navn: string) => screen.getByText(navn).parentElement!.textContent;
    expect(tal('Ture')).toContain('2');
    expect(tal('Nætter')).toContain('3');
    expect(tal('Grej i bog')).toContain('1');
    expect(tal('Kg grej')).toContain('2,4');
  });

  // Grejet og kiloene er inventaret som det ser ud nu. De skifter ikke, når
  // man vælger et andet år, og så skal det stå der.
  it('siger hvad der følger perioden, og hvad der ikke gør', async () => {
    await db.ture.add(lavTur({ startdato: iAar(8), naetter: 2 }));

    vis();

    expect(await screen.findByText(/Grej og kilo er det, du ejer nu/)).toBeInTheDocument();
  });

  it('er ærlig, når der hverken er grej eller ture', async () => {
    vis();

    expect(await screen.findByText(/Ingen tal endnu/)).toBeInTheDocument();
    expect(screen.queryByText('Kg grej')).not.toBeInTheDocument();
  });
});

describe('nætter pr. måned', () => {
  it('viser månederne fra den første nat ude til den sidste', async () => {
    await db.ture.bulkAdd([
      lavTur({ startdato: iAar(6), naetter: 3 }),
      lavTur({ startdato: iAar(8), naetter: 1 })
    ]);

    vis();

    const kort = (await screen.findByText('Nætter pr. måned')).parentElement as HTMLElement;

    // Juli ligger midt i sæsonen uden en eneste nat, og dét er selve
    // oplysningen — måneden står med som en tom rille.
    expect(within(kort).getByText('jun')).toBeInTheDocument();
    expect(within(kort).getByText('jul')).toBeInTheDocument();
    expect(within(kort).getByText('aug')).toBeInTheDocument();
    // Maj ligger uden for sæsonen og hører ikke til.
    expect(within(kort).queryByText('maj')).not.toBeInTheDocument();
    expect(within(kort).getByText('3 nætter')).toBeInTheDocument();
    expect(within(kort).getByText('1 nat')).toBeInTheDocument();
  });

  it('siger det, når turene var dagsture', async () => {
    await db.ture.add(lavTur({ startdato: iAar(6), naetter: 0 }));

    vis();

    expect(await screen.findByText(/turene var dagsture/i)).toBeInTheDocument();
  });
});

describe('perioden', () => {
  it('står på indeværende år og kan skifte til alle år', async () => {
    await db.items.add(lavItem({ navn: 'Økse' }));
    await db.ture.bulkAdd([
      lavTur({ startdato: iAar(5), naetter: 2 }),
      lavTur({ startdato: `${AAR - 1}-05-10`, naetter: 7 })
    ]);

    vis();

    const naetter = async () =>
      (await screen.findByText('Nætter')).parentElement!.textContent;

    expect(await naetter()).toContain('2');
    expect(screen.getByRole('button', { name: `${AAR}` })).toHaveAttribute('aria-pressed', 'true');

    await userEvent.click(screen.getByRole('button', { name: 'Alle år' }));

    expect(await screen.findByText('9')).toBeInTheDocument();
  });
});

describe('mønstrene bag folden', () => {
  it('ligger sammenfoldet, indtil man slår dem op', async () => {
    await db.items.add(lavItem({ navn: 'Økse' }));
    await db.ture.add(lavTur({ startdato: iAar(5) }));

    vis();

    expect(await screen.findByText('Ture')).toBeInTheDocument();
    expect(screen.queryByText('Inventarværdi')).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: /hvad turene har lært os/i }));

    expect(await screen.findByText('Inventarværdi')).toBeInTheDocument();
  });

  it('siger fra, når ingen ture er gjort op', async () => {
    await db.items.add(lavItem({ navn: 'Økse' }));
    await db.ture.add(lavTur({ startdato: iAar(5), pak_af_tjek: null }));

    await visMoenstre();

    expect(await screen.findByText('Mønstre i grejet')).toBeInTheDocument();
    expect(screen.getByText(/ingen ture gjort op/i)).toBeInTheDocument();
  });

  it('siger hvor mange ture der mangler', async () => {
    await db.items.add(lavItem({ uid: 'u-1', navn: 'Økse' }));
    await db.ture.add(lavTur({ startdato: iAar(5), pak_af_tjek: tjek([['u-1', 'brugt']]) }));

    await visMoenstre();

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

    await visMoenstre();

    // "Bog" står også under "Mest brugte grej", og det er rigtigt nok — den
    // var jo med. Assertionen skal derfor afgrænses til hyldevare-kortet.
    const kort = widget(/Med hver gang, aldrig brugt/);

    expect(within(kort).getByText('Bog')).toBeInTheDocument();
    expect(within(kort).getByText(/med 3 gange/i)).toBeInTheDocument();
  });

  it('siger ingenting, når grejet faktisk bliver brugt', async () => {
    await db.items.add(lavItem({ uid: 'u-bog', navn: 'Bog', vaegt_g: 400 }));
    await db.ture.bulkAdd([1, 2, 3].map((m) => lavTur({
      startdato: iAar(m),
      pak_af_tjek: tjek([['u-bog', 'brugt']])
    })));

    await visMoenstre();

    // Grundlaget er der — der står bare ingen hyldevarer.
    expect(await screen.findByText(`Nætter ${AAR}`)).toBeInTheDocument();
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

    await visMoenstre();

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

    await visMoenstre();

    expect(await screen.findByText('Bedst bedømt')).toBeInTheDocument();
    expect(screen.queryByText('Dårligst bedømt')).not.toBeInTheDocument();
  });

  it('siger ingenting, når intet er vurderet', async () => {
    await db.items.add(lavItem({ navn: 'Uvurderet' }));
    await db.ture.add(lavTur({ startdato: iAar(5) }));

    await visMoenstre();

    expect(await screen.findByText(`Nætter ${AAR}`)).toBeInTheDocument();
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

    await visMoenstre();

    const kort = widget(`Nætter ${AAR}`);
    expect(within(kort).getByText('3')).toBeInTheDocument();
    expect(within(kort).getByText(/1\.5 pr\. tur i snit/)).toBeInTheDocument();
  });

  it('viser gennemsnitsvægten over de ture, der havde grej med', async () => {
    await db.items.add(lavItem({ uid: 'u-telt', navn: 'Telt', vaegt_g: 2000 }));
    await db.ture.bulkAdd([
      lavTur({ startdato: iAar(5), loese_item_ids: ['u-telt'] }),
      lavTur({ startdato: iAar(6), loese_item_ids: [] })
    ]);

    await visMoenstre();

    expect(await screen.findByText('Gennemsnitsvægt pr. tur')).toBeInTheDocument();
    expect(screen.getByText(/bygger på én tur med valgt grej/i)).toBeInTheDocument();
  });
});
