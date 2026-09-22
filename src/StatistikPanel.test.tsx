// @vitest-environment jsdom
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

vi.mock('./pb', () => import('./test/pbMock'));

import { db } from './db';
import type { PakAfLinje, PakAfStatus } from './db';
import StatistikPanel from './StatistikPanel';
import { lavItem, lavSted, lavTur } from './test/data';
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

// Kortet omkring en historik-kort-titel.
const kort = async (titel: string) =>
  (await screen.findByText(titel)).parentElement as HTMLElement;

describe('top-steder', () => {
  it('viser stederne med flest ture i perioden', async () => {
    await db.steder.add(lavSted({ uid: 's-rold', navn: 'Rold Skov' }));
    await db.ture.bulkAdd([
      lavTur({ startdato: iAar(5), sted_uid: 's-rold', naetter: 1 }),
      lavTur({ startdato: iAar(6), sted_uid: 's-rold', naetter: 2 }),
      lavTur({ startdato: iAar(7), sted: 'Øhaven', naetter: 1 }),
      // Sidste år — uden for standardperioden.
      lavTur({ startdato: `${AAR - 1}-05-10`, sted: 'Mols', naetter: 1 })
    ]);

    vis();

    const k = await kort('Top-steder');
    const linjer = within(k).getAllByText(/^\d\.$/).map((n) => n.nextSibling?.textContent);
    expect(linjer).toEqual(['Rold Skov', 'Øhaven']);
    expect(within(k).getByText('2 ture · 3 nætter i alt')).toBeInTheDocument();
    expect(within(k).queryByText('Mols')).not.toBeInTheDocument();
  });

  it('åbner et gemt sted, men ikke et der kun er et navn på en tur', async () => {
    const id = await db.steder.add(lavSted({ uid: 's-rold', navn: 'Rold Skov' }));
    await db.ture.bulkAdd([
      lavTur({ startdato: iAar(5), sted_uid: 's-rold' }),
      lavTur({ startdato: iAar(6), sted: 'Øhaven' })
    ]);
    const aabnSted = vi.fn();

    tegn(<StatistikPanel aabnItem={vi.fn()} aabnSted={aabnSted} />, DESKTOP);

    const k = await kort('Top-steder');
    await userEvent.click(within(k).getByRole('button', { name: /Rold Skov/ }));
    expect(aabnSted).toHaveBeenCalledWith(id);
    expect(within(k).queryByRole('button', { name: /Øhaven/ })).not.toBeInTheDocument();
  });

  it('siger det, når ingen tur har et sted', async () => {
    await db.ture.add(lavTur({ startdato: iAar(5), sted: '' }));

    vis();

    expect(await screen.findByText(/har et sted skrevet på/)).toBeInTheDocument();
  });
});

describe('grej brugt vs urørt', () => {
  it('forklarer, hvor tallet kommer fra, når ingen tur er gjort op', async () => {
    await db.items.add(lavItem({ uid: 'u-1', navn: 'Økse' }));
    await db.ture.bulkAdd([
      lavTur({ startdato: iAar(5), status: 'afsluttet', pak_af_tjek: null, loese_item_ids: ['u-1'] }),
      lavTur({ startdato: iAar(6), status: 'afsluttet', pak_af_tjek: null })
    ]);

    vis();

    const k = await kort('Grej brugt vs urørt');
    expect(within(k).getByText(/Ingen ture i perioden er gjort op endnu/)).toBeInTheDocument();
    expect(within(k).getByText(/2 afsluttede ture i perioden mangler pak-af-tjekket/)).toBeInTheDocument();
    expect(within(k).queryByText('Brugt')).not.toBeInTheDocument();
  });

  it('viser tallene, men holder listen tilbage, når grundlaget er for tyndt', async () => {
    await db.items.bulkAdd([
      lavItem({ uid: 'u-kniv', navn: 'Kniv' }),
      lavItem({ uid: 'u-sav', navn: 'Sav' })
    ]);
    await db.ture.add(lavTur({
      startdato: iAar(5),
      status: 'afsluttet',
      pak_af_tjek: tjek([['u-kniv', 'brugt'], ['u-sav', 'ubrugt']])
    }));

    vis();

    const k = await kort('Grej brugt vs urørt');
    expect(within(k).getByText('Brugt').nextSibling?.textContent).toBe('1');
    expect(within(k).getByText('Urørt').nextSibling?.textContent).toBe('1');
    expect(within(k).getByText(/Fra pak-af-tjekket på 1 tur\./)).toBeInTheDocument();
    expect(within(k).getByText(/ikke et mønster endnu/)).toBeInTheDocument();
    expect(within(k).queryByText('Sav')).not.toBeInTheDocument();
  });

  it('lister det urørte grej, når der er gjort nok ture op', async () => {
    await db.items.bulkAdd([
      lavItem({ uid: 'u-kniv', navn: 'Kniv' }),
      lavItem({ uid: 'u-sav', navn: 'Sav', vaegt_g: 400 })
    ]);
    await db.ture.bulkAdd([1, 2, 3].map((m) => lavTur({
      startdato: iAar(m),
      status: 'afsluttet',
      pak_af_tjek: tjek([['u-kniv', 'brugt'], ['u-sav', 'ubrugt']])
    })));

    vis();

    const k = await kort('Grej brugt vs urørt');
    expect(within(k).getByText(/Fra pak-af-tjekket på 3 ture\./)).toBeInTheDocument();
    expect(within(k).getByRole('button', { name: /Sav/ })).toHaveTextContent('0,4 kg · urørt 3 gange');
    expect(within(k).queryByText('Kniv')).not.toBeInTheDocument();
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

    // Kortet om brugt vs urørt siger også, hvor mange der mangler — så
    // assertionen afgrænses til mønster-widget'en.
    await screen.findByText('Mønstre i grejet');
    expect(within(widget('Mønstre i grejet')).getByText(/2 ture mere/i)).toBeInTheDocument();
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
