// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

vi.mock('./pb', () => import('./test/pbMock'));

import { db } from './db';
import MereSide from './MereSide';
import { saet } from './indstillinger';
import { SYNCFEJL_NOEGLE } from './syncfejl';
import { lavItem, lavSted, lavTur } from './test/data';
import { tegn, DESKTOP } from './test/skaerm';

// ─────────────────────────────────────────────
// Mere · desktop
//
// Fra handoff'en "Ejer Mere · desktop" og den visuelle reference i
// `docs/design/desktop/08-mere.html`. Testene her er acceptkriterierne
// skrevet ud.
//
// Skærmen er en hub: to sektioner, hver samlet i ét kort med rækker, og ikke
// én knap. Det, der kan gå galt, er ikke en farve — det er sync-rækken, der
// står og siger "Alt er sendt op" om en kø, der aldrig kom op.
// ─────────────────────────────────────────────

const aabnIndstillinger = vi.fn();
const skift = vi.fn();
const aabnAar = vi.fn();

beforeEach(async () => {
  await Promise.all([
    db.steder.clear(), db.items.clear(), db.ture.clear(),
    db.indstillinger.clear(), db.slettede.clear()
  ]);
  aabnIndstillinger.mockClear();
  skift.mockClear();
  aabnAar.mockClear();
  vi.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => {
  vi.useRealTimers();
});

const vis = () => tegn(
  <MereSide fane="mere" skift={skift} aabnAar={aabnAar} aabnIndstillinger={aabnIndstillinger} />,
  DESKTOP
);

const kort = () => Array.from(document.querySelectorAll<HTMLElement>('.hub-kort'));
const raekker = (k: HTMLElement) => Array.from(k.querySelectorAll<HTMLElement>('.list-row'));
const raekke = (navn: string) => screen.getByText(navn).closest('.list-row') as HTMLElement;

// Alt på skærmen, der er en fyldt accent-flade: knapper med den primære
// variant, og alt andet, der har malet accenten på som baggrund.
const fyldteAccenter = () => Array.from(document.querySelectorAll<HTMLElement>('*'))
  .filter((el) => el.classList.contains('ui-button--primaer') || el.style.background === 'var(--accent)');

// Prikken foran sync-teksten. Den er der kun, når der er noget udestående.
const syncprik = () => raekke('Synkronisering').querySelector<HTMLElement>('.hub-sync-prik');

// Fejlen, appen har noteret om det seneste forsøg. Se syncfejl.ts — den ligger
// på enheden, fordi den handler om denne enheds forbindelse og ikke om turene.
const noterFejl = (art = 'afvist') =>
  saet(SYNCFEJL_NOEGLE, JSON.stringify({ art, detalje: '', hvornaar: '2026-09-22T10:00:00Z' }));

describe('titel og navigation', () => {
  it('hedder Mere', async () => {
    vis();

    expect(await screen.findByRole('heading', { level: 1, name: 'Mere' })).toBeInTheDocument();
  });

  it('markerer Mere i sidebaren', async () => {
    vis();

    await screen.findByRole('heading', { level: 1, name: 'Mere' });
    const nav = screen.getByRole('navigation', { name: 'Hovednavigation' });
    const aktiv = within(nav).getByRole('button', { name: 'Mere' });
    expect(aktiv).toHaveAttribute('aria-current', 'page');
  });

  it('sender Steder og Statistik videre med skift', async () => {
    vis();

    await userEvent.click(await screen.findByText('Steder'));
    expect(skift).toHaveBeenCalledWith('steder');

    await userEvent.click(screen.getByText('Statistik'));
    expect(skift).toHaveBeenCalledWith('statistik');
  });

  it('åbner hver app-række i sit eget afsnit af indstillingerne', async () => {
    vis();

    await userEvent.click(await screen.findByText('Synkronisering'));
    expect(aabnIndstillinger).toHaveBeenCalledWith('synkronisering');

    await userEvent.click(screen.getByText('Skabeloner'));
    expect(aabnIndstillinger).toHaveBeenCalledWith('skabeloner');

    await userEvent.click(screen.getByText('Backup, eksport og import'));
    expect(aabnIndstillinger).toHaveBeenCalledWith('data');

    await userEvent.click(screen.getByText('Hjælp og om Feltbogen'));
    expect(aabnIndstillinger).toHaveBeenCalledWith('om');
  });

  it('åbner toppen af indstillingerne fra rækken, der hedder Indstillinger', async () => {
    vis();

    await userEvent.click(await screen.findByText('Indstillinger'));
    expect(aabnIndstillinger).toHaveBeenCalledWith();
  });
});

describe('sektionen Din friluftshistorik', () => {
  it('samler Steder og Statistik i ét kort', async () => {
    await db.steder.add(lavSted({ navn: 'Rold Skov' }));
    await db.items.bulkAdd([lavItem({ navn: 'Tarp' }), lavItem({ navn: 'Kogegrej' })]);
    vis();

    expect(await screen.findByText('Din friluftshistorik')).toBeInTheDocument();
    const historik = kort()[0];
    expect(within(historik).getByText('Steder')).toBeInTheDocument();
    expect(within(historik).getByText('Statistik')).toBeInTheDocument();
  });

  // Rækkerne skal sige det samme som skærmen bag dem. Steder-rækken talte før
  // kun favoritterne og stod med "0", mens skærmen havde tre steder fra
  // turene; Statistik-rækken talte inventaret og ikke turene. Se
  // FriluftshistorikSide.tsx.
  it('tæller både stederne fra turene og favoritterne', async () => {
    await db.steder.add(lavSted({ navn: 'Rold Skov' }));
    await db.items.bulkAdd([lavItem({ navn: 'Tarp' }), lavItem({ navn: 'Kogegrej' })]);
    await db.ture.add(lavTur({ navn: 'Sensommer', sted: 'Fovslet Skov', naetter: 2 }));
    vis();

    expect(await screen.findByText('1 fra ture · 1 favorit')).toBeInTheDocument();
    expect(await screen.findByText('1 tur · 2 nætter')).toBeInTheDocument();
  });

  it('bøjer i flertal', async () => {
    await db.steder.bulkAdd([lavSted({ navn: 'Rold' }), lavSted({ navn: 'Hald' })]);
    vis();

    expect(await screen.findByText('0 fra ture · 2 favoritter')).toBeInTheDocument();
    expect(await screen.findByText('0 ture · 0 nætter')).toBeInTheDocument();
  });
});

describe('sektionen Appen', () => {
  it('samler de fem rækker i ét kort, i referencens rækkefølge', async () => {
    vis();

    expect(await screen.findByText('Appen')).toBeInTheDocument();
    const appen = kort()[1];
    expect(raekker(appen)).toHaveLength(5);
    expect(within(appen).getByText('Synkronisering')).toBeInTheDocument();
    expect(within(appen).getByText('Skabeloner')).toBeInTheDocument();
    expect(within(appen).getByText('Backup, eksport og import')).toBeInTheDocument();
    expect(within(appen).getByText('Indstillinger')).toBeInTheDocument();
    expect(within(appen).getByText('Hjælp og om Feltbogen')).toBeInTheDocument();
  });

  it('skriver undertitlerne kort', async () => {
    vis();

    expect(await screen.findByText('Afgangs-tjek og pak-af-tjek')).toBeInTheDocument();
    expect(screen.getByText('Gem en kopi, eller læs en ind')).toBeInTheDocument();
    expect(screen.getByText('Konto, din krop og resten af appen')).toBeInTheDocument();
    expect(screen.getByText('Rundvisning, version og data')).toBeInTheDocument();
  });
});

describe('rækkerne', () => {
  it('står alle sammen i et kort og har en chevron', async () => {
    vis();

    await screen.findByText('Steder');
    expect(kort()).toHaveLength(2);
    const alle = kort().flatMap(raekker);
    expect(alle).toHaveLength(7);
    for (const r of alle) {
      expect(r).toHaveAttribute('role', 'button');
      expect(r.textContent).toContain('›');
    }
  });
});

// Det egentlige i denne omgang. Rækken læser af den samme kilde som linjen på
// startskærmen — `syncstatus` i dashboard.ts — og den kilde skal have fejlen
// med. Uden den kunne rækken stå og sige "Alt er sendt op" om en sync, der
// lige var blevet afvist.
describe('sync-rækken er ærlig', () => {
  it('siger "Alt er sendt op", når der ikke er noget udestående — og uden prik', async () => {
    vis();

    expect(await screen.findByText('Alt er sendt op')).toBeInTheDocument();
    expect(syncprik()).toBeNull();
  });

  it('siger ikke "Alt er sendt op", når det seneste forsøg fejlede', async () => {
    await noterFejl();
    vis();

    expect(await screen.findByText('Sync fejlede')).toBeInTheDocument();
    expect(screen.queryByText('Alt er sendt op')).not.toBeInTheDocument();
  });

  it('tegner fejlen i advarselsfarven med en prik', async () => {
    await noterFejl();
    vis();

    const tekst = await screen.findByText('Sync fejlede');
    expect(tekst).toHaveStyle({ color: 'var(--advarsel)' });
    expect(syncprik()).toHaveStyle({ background: 'var(--advarsel)' });
  });

  it('tæller med, når noget ligger og venter', async () => {
    await db.ture.add(lavTur({ navn: 'Sensommer' }));
    vis();

    expect(await screen.findByText('1 ændring på vej op')).toBeInTheDocument();
    expect(syncprik()).toHaveStyle({ background: 'var(--accent)' });
  });

  it('siger "kom ikke op" om det, der ligger i køen, når forsøget fejlede', async () => {
    await db.ture.add(lavTur({ navn: 'Sensommer' }));
    await noterFejl();
    vis();

    expect(await screen.findByText('1 ændring kom ikke op')).toBeInTheDocument();
  });

  it('kalder det ikke en fejl, når der bare ikke er dækning', async () => {
    const oprindelig = Object.getOwnPropertyDescriptor(Navigator.prototype, 'onLine');
    Object.defineProperty(navigator, 'onLine', { configurable: true, get: () => false });
    try {
      await db.ture.add(lavTur({ navn: 'Sensommer' }));
      vis();

      const tekst = await screen.findByText('1 ændring venter på dækning');
      expect(tekst).not.toHaveStyle({ color: 'var(--advarsel)' });
    } finally {
      if (oprindelig) Object.defineProperty(Navigator.prototype, 'onLine', oprindelig);
      else Reflect.deleteProperty(navigator, 'onLine');
    }
  });

  it('fortæller under kortene, hvad rækken lover', async () => {
    vis();

    const fod = document.querySelector('.hub-fodnote') as HTMLElement;
    expect(fod).toBeInTheDocument();
    expect(fod.textContent).toContain('Alt er sendt op');
  });
});

// Rækken står ikke i referencen, fordi den kun findes, når der er et år at
// gøre op — se aarsopgoerelse.ts. Den skal blive, og den skal se ud som de
// andre rækker i historik-kortet.
describe('årsopgørelsen', () => {
  const iJanuar = () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2027-01-08T12:00:00Z'));
  };

  it('står i historik-kortet, når der er et år at se på', async () => {
    iJanuar();
    await db.ture.add(lavTur({
      navn: 'Sensommer', status: 'afsluttet',
      startdato: '2026-08-10', slutdato: '2026-08-12'
    }));
    vis();

    const raek = await screen.findByText('Sådan gik 2026');
    expect(raek.closest('.hub-kort')).toBe(kort()[0]);
    expect(raek.closest('.list-row')).toHaveAttribute('role', 'button');
    expect(screen.getByText('Årsopgørelsen er klar')).toBeInTheDocument();
  });

  it('åbner året, når man trykker på den', async () => {
    iJanuar();
    await db.ture.add(lavTur({
      navn: 'Sensommer', status: 'afsluttet',
      startdato: '2026-08-10', slutdato: '2026-08-12'
    }));
    vis();

    await userEvent.click(await screen.findByText('Sådan gik 2026'));
    expect(aabnAar).toHaveBeenCalledWith(2026);
  });

  it('er der ikke, når der ikke er noget at gøre op', async () => {
    vis();

    await screen.findByText('Steder');
    expect(screen.queryByText(/Sådan gik/)).not.toBeInTheDocument();
  });
});

// Handoff'ens hårdeste krav: hub'en er navigation, og en fyldt accent her
// ville konkurrere med de døre, skærmen består af.
describe('ingen fyldt primær handling', () => {
  it('er der ingen af — heller ikke med en sync-fejl og en årsopgørelse', async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2027-01-08T12:00:00Z'));
    await db.ture.add(lavTur({
      navn: 'Sensommer', status: 'afsluttet',
      startdato: '2026-08-10', slutdato: '2026-08-12'
    }));
    await noterFejl();
    vis();

    await screen.findByText('Sådan gik 2026');
    expect(fyldteAccenter()).toHaveLength(0);
  });
});
