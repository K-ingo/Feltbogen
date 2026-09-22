// @vitest-environment jsdom
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

vi.mock('./pb', () => import('./test/pbMock'));

import { db } from './db';
import TureListe from './TureListe';
import { lavTur } from './test/data';
import { tegn, DESKTOP } from './test/skaerm';

// ─────────────────────────────────────────────
// Ture · desktop
//
// Fra handoff'en "Ejer Ture · desktop" (16. sep 2026) og den visuelle
// reference i `docs/design/desktop/02-ture.html`. Testene her er
// acceptkriterierne skrevet ud.
//
// En fyldt knap kendes på klassen `ui-button--primaer`. Skærmen har kun én,
// og det er `+ Ny tur` — der er ingen hero at konkurrere med, så den fyldte
// knap hører til i headeren. Det er også sådan referencen viser den.
// ─────────────────────────────────────────────

beforeEach(async () => {
  await Promise.all([db.ture.clear(), db.delte_ture.clear(), db.billeder.clear()]);
  vi.spyOn(console, 'error').mockImplementation(() => {});
});

const vis = () => tegn(
  <TureListe
    fane="ture" skift={vi.fn()} aabnTur={vi.fn()} aabnDeltTur={vi.fn()} nyTur={vi.fn()}
  />,
  DESKTOP
);

const fyldte = () => Array.from(document.querySelectorAll('.ui-button--primaer'));

// Kortet som helhed er en knap; mærkerne ligger inde i den. At finde kortet
// via titlen frem for via en indeks gør testen uafhængig af rækkefølgen.
const kort = (navn: string) => screen.getByText(navn).closest('.trip-card') as HTMLElement;

describe('kun én fyldt primary', () => {
  it('er + Ny tur, når der er ture på listen', async () => {
    await db.ture.add(lavTur({ navn: 'Fovslet Skov', sted: 'Fovslet' }));
    vis();

    expect(await screen.findByText('Fovslet Skov')).toBeInTheDocument();
    expect(fyldte()).toHaveLength(1);
    expect(fyldte()[0]).toHaveTextContent('Ny tur');
  });

  it('er den tomme tilstands knap, når der ingen ture er', async () => {
    vis();

    // Den tomme tilstand skal have en tydelig vej til den første tur — men
    // den må ikke lægge endnu en fyldt knap oven i headerens. Se
    // KomIGang.test.tsx.
    expect(await screen.findByRole('button', { name: 'Opret første tur' })).toBeInTheDocument();
    expect(fyldte()).toHaveLength(1);
  });
});

describe('visningsvælgeren', () => {
  it('er ikke en fyldt accent ved siden af + Ny tur', async () => {
    await db.ture.add(lavTur({ navn: 'Fovslet Skov', sted: 'Fovslet' }));
    vis();

    const gitter = await screen.findByRole('button', { name: 'Gitter' });
    // Referencen tegner "Gitter" fyldt, men så var der to grønne flader i
    // skærmbilledet. Valget står stadig som valgt — bare stille.
    expect(gitter).toHaveAttribute('aria-pressed', 'true');
    expect(gitter.style.background).not.toBe('var(--accent)');
  });
});

describe('Ture er den aktive fane', () => {
  it('er markeret i sidebaren', async () => {
    await db.ture.add(lavTur({ navn: 'Fovslet Skov', sted: 'Fovslet' }));
    vis();

    await screen.findByText('Fovslet Skov');
    const sidebar = Array.from(document.querySelectorAll('nav'))
      .find((n) => n.classList.contains('sidebar')) as HTMLElement;
    expect(within(sidebar).getByRole('button', { name: 'Ture' })).toHaveAttribute('aria-current', 'page');
  });
});

describe('mærker på turkortet', () => {
  it('siger Mangler sted, når stedet ikke er valgt', async () => {
    await db.ture.add(lavTur({ navn: 'Reed testtur', sted: '' }));
    vis();

    await screen.findByText('Reed testtur');
    expect(within(kort('Reed testtur')).getByText('Mangler sted')).toBeInTheDocument();
  });

  it('tier om stedet, når det er valgt', async () => {
    await db.ture.add(lavTur({ navn: 'Fovslet Skov', sted: 'Fovslet Skov' }));
    vis();

    await screen.findByText('Fovslet Skov');
    expect(within(kort('Fovslet Skov')).queryByText('Mangler sted')).not.toBeInTheDocument();
  });

  it('viser fasen ved siden af — de to udelukker ikke hinanden', async () => {
    await db.ture.add(lavTur({ navn: 'Reed testtur', sted: '', status: 'kladde' }));
    vis();

    await screen.findByText('Reed testtur');
    const maerker = kort('Reed testtur');
    expect(within(maerker).getByText('Kladde')).toBeInTheDocument();
    expect(within(maerker).getByText('Mangler sted')).toBeInTheDocument();
  });
});

describe('navngivning', () => {
  it('hedder det Afsluttet og aldrig arkiveret', async () => {
    // En overstået tur uden opgør. `faseAf` læser status, ikke datoerne.
    await db.ture.add(lavTur({ navn: 'Øhaven', sted: 'Øhaven', status: 'afsluttet' }));
    vis();

    await screen.findByText('Øhaven');
    expect(within(kort('Øhaven')).getByText('Afsluttet')).toBeInTheDocument();
    expect(document.body.textContent).not.toMatch(/arkiver/i);
  });
});

describe('visningen kan skiftes', () => {
  it('hedder valgene Gitter og Liste, og Gitter er det man lander i', async () => {
    await db.ture.add(lavTur({ navn: 'Fovslet Skov', sted: 'Fovslet' }));
    vis();

    await screen.findByText('Fovslet Skov');
    expect(screen.getByRole('button', { name: 'Gitter' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: 'Liste' })).toHaveAttribute('aria-pressed', 'false');

    // "Kort" er tvetydigt på dansk — det betyder både kartotekskort og
    // landkort. Ordet skal være ledigt til det andet.
    expect(screen.queryByRole('button', { name: 'Kort' })).not.toBeInTheDocument();
  });

  it('skifter gitteret til den kompakte liste', async () => {
    await db.ture.add(lavTur({ navn: 'Fovslet Skov', sted: 'Fovslet' }));
    vis();

    await screen.findByText('Fovslet Skov');
    const gitter = document.querySelector('.trip-grid') as HTMLElement;
    expect(gitter).not.toHaveClass('is-compact');

    await userEvent.click(screen.getByRole('button', { name: 'Liste' }));
    expect(document.querySelector('.trip-grid')).toHaveClass('is-compact');
  });
});
