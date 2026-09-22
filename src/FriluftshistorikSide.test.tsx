// @vitest-environment jsdom
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

vi.mock('./pb', () => import('./test/pbMock'));

import { db } from './db';
import FriluftshistorikSide from './FriluftshistorikSide';
import { lavSted, lavTur } from './test/data';
import { tegn, DESKTOP, MOBIL } from './test/skaerm';

// ─────────────────────────────────────────────
// Friluftshistorik · desktop
//
// Fra handoff'en "Ejer Steder & Statistik · desktop" og den visuelle
// reference i `docs/design/desktop/09-steder-statistik.html`. Testene her er
// acceptkriterierne skrevet ud.
//
// Skærmen er to faner om det samme: hvor man har været, og hvad det blev til.
// Det, der kan gå galt, er ikke en farve — det er en liste, der påstår, at man
// ikke har været nogen steder, fordi man aldrig har oprettet et sted i hånden.
// ─────────────────────────────────────────────

const skift = vi.fn();
const aabnSted = vi.fn();
const nytSted = vi.fn();
const aabnItem = vi.fn();
const aabnAar = vi.fn();

const AAR = new Date().getFullYear();

beforeEach(async () => {
  await Promise.all([db.steder.clear(), db.ture.clear(), db.items.clear(), db.grupper.clear()]);
  [skift, aabnSted, nytSted, aabnItem, aabnAar].forEach((f) => f.mockClear());
  vi.spyOn(console, 'error').mockImplementation(() => {});
});

const vis = (fane: 'steder' | 'statistik' = 'steder', bredde = DESKTOP) => tegn(
  <FriluftshistorikSide
    fane={fane}
    skift={skift}
    aabnSted={aabnSted}
    nytSted={nytSted}
    aabnItem={aabnItem}
    aabnAar={aabnAar}
  />,
  bredde
);

// Alt på skærmen, der er en fyldt accent-flade: knapper med den primære
// variant, og alt andet, der har malet accenten på som baggrund.
const fyldteAccenter = () => Array.from(document.querySelectorAll<HTMLElement>('*'))
  .filter((el) => el.classList.contains('ui-button--primaer') || el.style.background === 'var(--accent)');

const fane = (navn: string) =>
  within(screen.getByRole('group', { name: 'Friluftshistorik' })).getByRole('button', { name: navn });

describe('skærmen', () => {
  it('hedder Friluftshistorik og siger hvad den er', async () => {
    vis();

    expect(await screen.findByRole('heading', { level: 1, name: 'Friluftshistorik' })).toBeInTheDocument();
    expect(screen.getByText(/rolige tal fra dine ture/i)).toBeInTheDocument();
  });

  it('har en vej tilbage til Mere', async () => {
    vis();

    await userEvent.click(await screen.findByRole('button', { name: '‹ Mere' }));
    expect(skift).toHaveBeenCalledWith('mere');
  });

  it('markerer Mere i sidebaren, for det er dér man kom fra', async () => {
    vis();

    const nav = await screen.findByRole('navigation', { name: 'Hovednavigation' });
    expect(within(nav).getByRole('button', { name: 'Mere' })).toHaveAttribute('aria-current', 'page');
  });
});

describe('fanerne', () => {
  it('viser hvilken fane man står på', async () => {
    vis('steder');

    expect(fane('Steder')).toHaveAttribute('aria-pressed', 'true');
    expect(fane('Statistik')).toHaveAttribute('aria-pressed', 'false');
  });

  // Fanen ligger i appens navigation og ikke i skærmens egen tilstand:
  // Mere-rækkerne peger hver sin vej ind, og tilbage skal lande rigtigt.
  it('skifter fane gennem navigationen', async () => {
    vis('steder');

    await userEvent.click(fane('Statistik'));
    expect(skift).toHaveBeenCalledWith('statistik');
  });

  it('viser statistikken, når man står på den fane', async () => {
    await db.ture.add(lavTur({ startdato: `${AAR}-08-01`, naetter: 2 }));

    vis('statistik');

    expect(await screen.findByText('Kg grej')).toBeInTheDocument();
    expect(screen.queryByText('Fra dine ture')).not.toBeInTheDocument();
  });
});

describe('årsopgørelsen', () => {
  it('står som en outline-knap i headeren, når der er et år at gøre op', async () => {
    await db.ture.add(lavTur({ startdato: `${AAR}-08-01`, status: 'afsluttet' }));

    vis();

    const knap = await screen.findByRole('button', { name: `Årsopgørelse ${AAR}` });
    await userEvent.click(knap);

    expect(aabnAar).toHaveBeenCalledWith(AAR);
    expect(knap.className).not.toContain('ui-button--primaer');
  });

  // En knap, der lover en opgørelse, der ikke er der, er værre end ingen knap.
  it('findes ikke, når der ikke er nogen ture', async () => {
    vis();

    await screen.findByRole('heading', { level: 1, name: 'Friluftshistorik' });
    expect(screen.queryByRole('button', { name: /Årsopgørelse/ })).not.toBeInTheDocument();
  });
});

describe('stederne', () => {
  it('kommer af turene og ikke af stedbogen', async () => {
    await db.ture.add(lavTur({
      sted: 'Fovslet Skov',
      sted_uid: '',
      startdato: `${AAR}-08-27`,
      slutdato: `${AAR}-08-29`,
      naetter: 2
    }));

    vis();

    expect(await screen.findByText('Fovslet Skov')).toBeInTheDocument();
    expect(screen.getByText(/1 tur · 2 nætter/)).toBeInTheDocument();
    expect(screen.getByText(/sidst 27\.–29\. august/)).toBeInTheDocument();
  });

  it('tæller dem, man er kommet tilbage til, for sig', async () => {
    await db.ture.bulkAdd([
      lavTur({ sted: 'Øhaven', sted_uid: '', startdato: `${AAR}-07-01` }),
      lavTur({ sted: 'Øhaven', sted_uid: '', startdato: `${AAR}-08-01` }),
      lavTur({ sted: 'Fovslet Skov', sted_uid: '', startdato: `${AAR}-06-01` })
    ]);

    vis();

    expect(await screen.findByText('Fra dine ture')).toBeInTheDocument();
    expect(screen.getByText('2 steder fra dine ture · 1 du er kommet tilbage til')).toBeInTheDocument();
  });

  it('åbner et gemt sted', async () => {
    const id = await db.steder.add(lavSted({ uid: 's-rold', navn: 'Rold Skov' }));
    await db.ture.add(lavTur({ sted_uid: 's-rold', startdato: `${AAR}-08-01` }));

    vis();

    await userEvent.click(await screen.findByRole('button', { name: /Rold Skov/ }));
    expect(aabnSted).toHaveBeenCalledWith(id);
  });

  // Et sted, der kun står som fritekst på en tur, kan ikke åbnes. Så siger
  // kortet dét frem for at se ud som en knap, der ikke virker.
  it('siger det, når stedet kun står skrevet på turen', async () => {
    await db.ture.add(lavTur({ sted: 'Øhaven', sted_uid: '', startdato: `${AAR}-08-01` }));

    vis();

    expect(await screen.findByText(/kun skrevet på turen/)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Øhaven/ })).not.toBeInTheDocument();
  });

  it('markerer en kladde, så tallet kan læses med det forbehold', async () => {
    await db.ture.add(lavTur({
      sted: 'Palnatokesvej 22',
      sted_uid: '',
      startdato: `${AAR}-08-09`,
      naetter: 6,
      status: 'kladde'
    }));

    vis();

    expect(await screen.findByText(/kladde/)).toBeInTheDocument();
  });

  it('er ærlig, når der ikke er nogen steder endnu', async () => {
    vis();

    expect(await screen.findByText(/Ingen steder endnu/)).toBeInTheDocument();
  });

  it('kan stadig oprette et sted, men foreslår det ikke', async () => {
    vis();

    const knap = await screen.findByRole('button', { name: '+ Nyt sted' });
    await userEvent.click(knap);

    expect(nytSted).toHaveBeenCalled();
    expect(knap.className).toContain('ui-button--tekst');
  });
});

describe('den ene fyldte accent', () => {
  // Fanebladets grønne flade males i CSS (.historik-faner), og testene kører
  // uden stilark. Det, der kan tælles her, er derfor alt det *andet*, der
  // kunne male accenten på — og det skal der ikke være noget af.
  it('er ingen anden end fanebladet på Steder', async () => {
    await db.ture.add(lavTur({ sted: 'Øhaven', sted_uid: '', startdato: `${AAR}-08-01`, status: 'afsluttet' }));

    vis('steder');

    await screen.findByText('Øhaven');
    expect(fyldteAccenter()).toHaveLength(0);
    expect(fane('Steder')).toHaveAttribute('aria-pressed', 'true');
  });

  // Periodevælgeren er stille (accent-bg) og ikke fyldt, netop for ikke at
  // blive den anden grønne flade ved siden af fanebladet.
  it('er ingen anden end fanebladet på Statistik', async () => {
    await db.ture.add(lavTur({ startdato: `${AAR}-08-01`, naetter: 2, status: 'afsluttet' }));

    vis('statistik');

    expect(await screen.findByText('Kg grej')).toBeInTheDocument();
    expect(fyldteAccenter()).toHaveLength(0);
    expect(screen.getByRole('button', { name: `${AAR}` })).toHaveAttribute('aria-pressed', 'true');
  });

  // Skærmen havde en FAB på Steder, dengang den var en liste, man selv fyldte.
  // Listen kommer af turene nu, og en flydende grøn plusknap ville være
  // skærmens forslag til, hvad man skal — oven i fanebladet.
  it('har ingen FAB på telefonen', async () => {
    await db.ture.add(lavTur({ sted: 'Øhaven', sted_uid: '', startdato: `${AAR}-08-01` }));

    vis('steder', MOBIL);

    await screen.findByText('Øhaven');
    expect(screen.queryByRole('button', { name: 'Tilføj' })).not.toBeInTheDocument();
    expect(fyldteAccenter()).toHaveLength(0);
  });
});
