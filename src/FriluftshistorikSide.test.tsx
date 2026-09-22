// @vitest-environment jsdom
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

vi.mock('./pb', () => import('./test/pbMock'));

import { db } from './db';
import type { Fane } from './Skal';
import type { PakAfLinje, PakAfStatus } from './db';
import FriluftshistorikSide from './FriluftshistorikSide';
import { lavItem, lavSted, lavTur } from './test/data';
import { tegn, DESKTOP } from './test/skaerm';

// Friluftshistorikken: Steder og Statistik som ét skærmbillede med to
// faneblade. Se docs/design/desktop/09-steder-statistik.html.
//
// Regnestykkerne er testet for sig i friluftshistorik.test.ts og
// laering.test.ts. Det her er skærmen: at den siger fra, når der ikke er
// noget at sige, at den ikke påstår noget, den ikke kan vide, og at der kun
// er én fyldt accent på den.

const tjek = (linjer: [string, PakAfStatus][]) => ({
  udfyldt_dato: '2026-07-20',
  niveau: 'let' as const,
  linjer: linjer.map(([item_uid, status]): PakAfLinje => ({ item_uid, status }))
});

const AAR = new Date().getFullYear();
// Turene lægges i indeværende år, så årsvælgeren rammer dem uden at skulle
// trykkes på først.
const iAar = (maaned: number) => `${AAR}-0${maaned}-10`;

const skift = vi.fn();
const aabnAar = vi.fn();
const nytSted = vi.fn();
const aabnSted = vi.fn();

beforeEach(async () => {
  await Promise.all([db.items.clear(), db.ture.clear(), db.grupper.clear(), db.steder.clear()]);
  skift.mockClear();
  aabnAar.mockClear();
  nytSted.mockClear();
  aabnSted.mockClear();
  vi.spyOn(console, 'error').mockImplementation(() => {});
});

const vis = (fane: Fane = 'statistik') => tegn(
  <FriluftshistorikSide
    fane={fane}
    skift={skift}
    aabnSted={aabnSted}
    aabnItem={vi.fn()}
    aabnAar={aabnAar}
    nytSted={nytSted}
  />,
  DESKTOP
);

// De fyldte accent-flader på skærmen. Designsystemet tillader én.
const fyldteAccenter = () =>
  Array.from(document.querySelectorAll<HTMLElement>('.hist-faner > button[aria-selected="true"], .ui-button--primaer'));

describe('rammen om de to faneblade', () => {
  it('hedder Friluftshistorik og siger hvad der står på den', async () => {
    await db.ture.add(lavTur({ startdato: iAar(8) }));

    vis();

    expect(await screen.findByRole('heading', { level: 1, name: 'Friluftshistorik' })).toBeInTheDocument();
    expect(screen.getByText('Steder du har været · rolige tal fra dine ture')).toBeInTheDocument();
  });

  it('har en vej tilbage til Mere', async () => {
    vis();

    await userEvent.click(await screen.findByRole('button', { name: '‹ Mere' }));
    expect(skift).toHaveBeenCalledWith('mere');
  });

  it('skifter mellem Steder og Statistik med fanerne', async () => {
    vis('steder');

    const steder = await screen.findByRole('tab', { name: 'Steder' });
    expect(steder).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByRole('tab', { name: 'Statistik' })).toHaveAttribute('aria-selected', 'false');

    await userEvent.click(screen.getByRole('tab', { name: 'Statistik' }));
    expect(skift).toHaveBeenCalledWith('statistik');
  });

  // Fanebladet er den ene fyldte accent. Derfor er årsopgørelsen outline —
  // og derfor må der ikke komme en primær knap mere på skærmen.
  it.each<Fane>(['steder', 'statistik'])('har præcis én fyldt accent på %s', async (fane) => {
    await db.ture.add(lavTur({ startdato: iAar(8), status: 'afsluttet', sted: 'Fovslet Skov' }));

    vis(fane);

    // Både fanebladet og årsopgørelsen er tegnet, før der tælles.
    await screen.findByRole('button', { name: `Årsopgørelse ${AAR}` });
    expect(fyldteAccenter()).toHaveLength(1);
  });

  it('åbner årsopgørelsen for det nyeste år, den har noget at sige om', async () => {
    await db.ture.add(lavTur({ startdato: iAar(8), status: 'afsluttet' }));

    vis();

    await userEvent.click(await screen.findByRole('button', { name: `Årsopgørelse ${AAR}` }));
    expect(aabnAar).toHaveBeenCalledWith(AAR);
  });

  it('lover ikke en årsopgørelse, når der ikke er et år at gøre op', async () => {
    vis();

    await screen.findByRole('heading', { level: 1, name: 'Friluftshistorik' });
    expect(screen.queryByRole('button', { name: /Årsopgørelse/ })).not.toBeInTheDocument();
  });
});

describe('stederne', () => {
  it('tæller de steder, turene har været på — også dem der aldrig er gemt', async () => {
    await db.ture.bulkAdd([
      lavTur({ sted: 'Fovslet Skov', startdato: `${AAR}-08-27`, slutdato: `${AAR}-08-29`, naetter: 2, status: 'afsluttet' }),
      lavTur({ sted: 'Fovslet Skov', startdato: `${AAR}-05-01`, slutdato: `${AAR}-05-03`, naetter: 2, status: 'afsluttet' }),
      lavTur({ sted: 'Øhaven', startdato: `${AAR}-08-01`, slutdato: `${AAR}-08-05`, naetter: 4, status: 'afsluttet' })
    ]);

    vis('steder');

    expect(await screen.findByText(/^2 steder ·/)).toBeInTheDocument();
    expect(screen.getByText('Fovslet Skov')).toBeInTheDocument();
    expect(screen.getByText('2 ture · 4 nætter i alt')).toBeInTheDocument();
  });

  it('skriver turens aktivitet, terræn og hvornår man sidst var der', async () => {
    await db.ture.add(lavTur({
      sted: 'Øhaven',
      aktivitet: 'kano',
      terraen: 'kyst',
      startdato: `${AAR}-08-01`,
      slutdato: `${AAR}-08-05`
    }));

    vis('steder');

    expect(await screen.findByText('Kano · Kyst · sidst 1.–5. august')).toBeInTheDocument();
  });

  // Kladder tæller med — man har været der — men det skal stå, at turen ikke
  // er gjort færdig.
  it('siger til, når besøget kun er en kladde', async () => {
    await db.ture.add(lavTur({ sted: 'Palnatokesvej 22', status: 'kladde', naetter: 6 }));

    vis('steder');

    expect(await screen.findByText('kladde')).toBeInTheDocument();
  });

  it('siger ærligt, at ingen ture har et sted på endnu', async () => {
    await db.ture.add(lavTur({ sted: '', sted_uid: '' }));

    vis('steder');

    expect(await screen.findByText(/Ingen af dine ture har et sted på endnu/)).toBeInTheDocument();
    expect(screen.getByText('Favoritter du kommer tilbage til')).toBeInTheDocument();
    expect(screen.getByText(/Ingen gemt endnu/)).toBeInTheDocument();
  });

  it('gemmer stedet og kobler turene til det, når man trykker Gem', async () => {
    const turId = await db.ture.add(lavTur({ sted: 'Fovslet Skov', startdato: `${AAR}-08-27` }));

    vis('steder');

    await userEvent.click(await screen.findByRole('button', { name: 'Gem' }));

    // Favoritten er den post, Mere-rækken tæller.
    expect(await screen.findByText('Gemt')).toBeInTheDocument();
    const gemt = await db.steder.toArray();
    expect(gemt.map((s) => s.navn)).toEqual(['Fovslet Skov']);

    // Uden koblingen ville stedets detalje sige, at man aldrig havde været der.
    const tur = await db.ture.get(turId);
    expect(tur?.sted_uid).toBe(gemt[0].uid);
    expect(tur?.sted).toBe('Fovslet Skov');
  });

  it('viser favoritterne med, hvor mange gange man har været der', async () => {
    const sted = lavSted({ uid: 's-1', navn: 'Øhaven' });
    await db.steder.add(sted);
    await db.ture.add(lavTur({ sted_uid: 's-1', startdato: `${AAR}-08-01` }));

    vis('steder');

    // Favoritkortet afløser det stiplede, så snart der er en favorit.
    const besoeg = await screen.findByText('Været her 1 gang');
    const kort = besoeg.closest<HTMLElement>('.hist-kort')!;
    expect(within(kort).getByText('Favoritter du kommer tilbage til')).toBeInTheDocument();
    expect(within(kort).getByText('Øhaven')).toBeInTheDocument();
    expect(screen.queryByText(/Ingen gemt endnu/)).not.toBeInTheDocument();
  });
});

describe('tallene øverst i statistikken', () => {
  // "Ture" står også i sidebaren, så opslaget holder sig inde i tal-rækken.
  const kpi = (label: string) => {
    const raekke = document.querySelector<HTMLElement>('.hist-kpi')!;
    return within(raekke).getByText(label).parentElement!.querySelector('.hist-kpi-tal')!.textContent;
  };

  it('tæller ture, nætter og det grej, man ejer', async () => {
    await db.ture.bulkAdd([
      lavTur({ startdato: iAar(8), naetter: 10 }),
      lavTur({ startdato: iAar(9), naetter: 2 })
    ]);
    await db.items.bulkAdd([
      lavItem({ navn: 'Sovepose', vaegt_g: 1200 }),
      lavItem({ navn: 'Underlag', vaegt_g: 400 })
    ]);

    vis();

    expect(await screen.findByText('Grej i bog')).toBeInTheDocument();
    expect(kpi('Ture')).toBe('2');
    expect(kpi('Nætter')).toBe('12');
    expect(kpi('Grej i bog')).toBe('2');
    expect(kpi('Kg grej')).toBe('1,6');
  });

  // To af de fire tal følger året, to gør ikke. Det skal stå på skærmen.
  it('siger, hvilke af tallene der følger året', async () => {
    await db.ture.add(lavTur({ startdato: iAar(8) }));

    vis();

    expect(await screen.findByText(/Grej i bog og kg grej er det, du ejer nu/)).toBeInTheDocument();
  });

  it('skifter år uden at røre ved grejet i bogen', async () => {
    await db.ture.bulkAdd([
      lavTur({ startdato: iAar(8), naetter: 2, status: 'afsluttet' }),
      lavTur({ startdato: `${AAR - 1}-05-10`, naetter: 7, status: 'afsluttet' })
    ]);
    await db.items.add(lavItem({ navn: 'Økse' }));

    vis();

    expect(await screen.findByText('Grej i bog')).toBeInTheDocument();
    expect(kpi('Nætter')).toBe('2');

    await userEvent.click(screen.getByRole('button', { name: 'Alle år' }));

    expect(kpi('Nætter')).toBe('9');
    expect(kpi('Grej i bog')).toBe('1');
  });
});

describe('nætter pr. måned', () => {
  it('viser kun de måneder, man var ude i', async () => {
    await db.ture.bulkAdd([
      lavTur({ startdato: `${AAR}-08-01`, naetter: 10 }),
      lavTur({ startdato: `${AAR}-09-05`, naetter: 2 })
    ]);

    vis();

    const kort = (await screen.findByText('Nætter pr. måned')).closest<HTMLElement>('.hist-kort')!;
    expect(within(kort).getByText('Aug')).toBeInTheDocument();
    expect(within(kort).getByText('10 nætter')).toBeInTheDocument();
    expect(within(kort).getByText('Sep')).toBeInTheDocument();
    expect(within(kort).queryByText('Jan')).not.toBeInTheDocument();
  });

  it('siger fra, når ingen tur har en dato', async () => {
    await db.items.add(lavItem({ navn: 'Økse' }));
    await db.ture.add(lavTur({ startdato: '' }));

    vis();

    expect(await screen.findByText(/Ingen ture med en dato/)).toBeInTheDocument();
  });
});

describe('mest brugte grej', () => {
  it('tæller turene bag hvert stykke grej og siger, hvad resten er', async () => {
    await db.items.bulkAdd([
      lavItem({ uid: 'u-1', navn: 'test sovepose' }),
      lavItem({ uid: 'u-2', navn: 'aldrig med' })
    ]);
    await db.ture.add(lavTur({ startdato: iAar(8), loese_item_ids: ['u-1'] }));

    vis();

    const kort = (await screen.findByText('Mest brugte grej')).closest<HTMLElement>('.hist-kort')!;
    expect(within(kort).getByText('test sovepose')).toBeInTheDocument();
    expect(within(kort).getByText('1 tur')).toBeInTheDocument();
    expect(within(kort).getByText('Resten')).toBeInTheDocument();
    expect(within(kort).getByText('1 stykke · aldrig brugt endnu')).toBeInTheDocument();
  });

  it('påstår ikke en rest, når alt har været med', async () => {
    await db.items.add(lavItem({ uid: 'u-1', navn: 'Økse' }));
    await db.ture.add(lavTur({ startdato: iAar(8), loese_item_ids: ['u-1'] }));

    vis();

    const kort = (await screen.findByText('Mest brugte grej')).closest<HTMLElement>('.hist-kort')!;
    expect(within(kort).queryByText('Resten')).not.toBeInTheDocument();
  });

  it('siger ærligt, at intet grej har været med endnu', async () => {
    await db.ture.add(lavTur({ startdato: iAar(8) }));

    vis();

    expect(await screen.findByText(/Intet grej har været med på en tur/)).toBeInTheDocument();
  });
});

// ─────────────────────────────────────────────
// Under folden
//
// Læringen og de gamle widgets er ikke væk — de ligger i «Mere fra tallene».
// Regnestykkerne er testet i laering.test.ts; det her er, at skærmen stadig
// siger fra, når grundlaget er for tyndt.
// ─────────────────────────────────────────────

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
    expect(await screen.findByText(`Nætter i ${AAR}`)).toBeInTheDocument();
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

    expect(await screen.findByText(`Nætter i ${AAR}`)).toBeInTheDocument();
    expect(screen.queryByText('Bedst bedømt')).not.toBeInTheDocument();
  });
});

describe('tallene om året under folden', () => {
  it('lægger nætterne sammen og siger snittet', async () => {
    await db.ture.bulkAdd([
      lavTur({ startdato: iAar(5), naetter: 2 }),
      lavTur({ startdato: iAar(6), naetter: 1 })
    ]);
    await db.items.add(lavItem({ navn: 'Økse' }));

    vis();

    expect(await screen.findByText(`Nætter i ${AAR}`)).toBeInTheDocument();
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
});
