// @vitest-environment jsdom
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

vi.mock('./pb', () => import('./test/pbMock'));

import { db } from './db';
import IndstillingerSide from './IndstillingerSide';
import { saetTestNavn, testNavn, logUd } from './test/pbMock';
import { tegn, DESKTOP, MOBIL } from './test/skaerm';

// ─────────────────────────────────────────────
// Indstillinger · desktop
//
// Fra handoff'en "Ejer Indstillinger · desktop" og den visuelle reference i
// `docs/design/desktop/10-indstillinger.html`. Testene her er
// acceptkriterierne skrevet ud.
//
// Skærmens ene fyldte accent er "Gem navn" — og kun når navnet er ændret og
// ikke tomt. Ellers er der ingen fyldt accent på skærmen.
// ─────────────────────────────────────────────

const skift = vi.fn();
const tilLogin = vi.fn();
const seRundvisning = vi.fn();

beforeEach(async () => {
  await Promise.all([db.items.clear(), db.ture.clear(), db.indstillinger.clear()]);
  saetTestNavn('Emil');
  skift.mockClear();
  logUd.mockClear();
  vi.spyOn(console, 'error').mockImplementation(() => {});
});

const vis = (bredde = DESKTOP) => tegn(
  <IndstillingerSide fane="indstillinger" skift={skift} tilLogin={tilLogin} seRundvisning={seRundvisning} />,
  bredde
);

const fyldteAccenter = () => Array.from(document.querySelectorAll<HTMLElement>('*'))
  .filter((el) => el.classList.contains('ui-button--primaer') || el.style.background === 'var(--accent)');

const navnefelt = () => screen.findByLabelText('Visningsnavn');

describe('titel og navigation', () => {
  it('hedder Indstillinger og forklarer hvad der ligger her', async () => {
    vis();

    expect(await screen.findByRole('heading', { level: 1, name: 'Indstillinger' })).toBeInTheDocument();
    expect(screen.getByText('Konto, din krop og det der gælder hele appen')).toBeInTheDocument();
  });

  it('har en vej tilbage til Mere', async () => {
    vis();

    await userEvent.click(await screen.findByRole('button', { name: '‹ Mere' }));
    expect(skift).toHaveBeenCalledWith('mere');
  });
});

describe('konto', () => {
  it('viser e-mailen med mærket Logget ind', async () => {
    vis();

    expect(await screen.findByText('test@eksempel.dk')).toBeInTheDocument();
    expect(screen.getByText('Logget ind')).toBeInTheDocument();
  });

  it('forklarer hvad navnet bruges til', async () => {
    vis();

    await navnefelt();
    expect(screen.getByText(/Vises på forsiden og for de andre på ture, du deler/)).toBeInTheDocument();
  });

  it('logger ud fra en række, ikke en rød knap', async () => {
    vis();

    const knap = await screen.findByRole('button', { name: /Log ud/ });
    expect(knap).not.toHaveClass('ui-button--fare');
    await userEvent.click(knap);
    expect(logUd).toHaveBeenCalled();
  });
});

describe('Gem navn', () => {
  it('er der ikke, når navnet er uændret', async () => {
    vis();

    expect(await navnefelt()).toHaveValue('Emil');
    expect(screen.queryByRole('button', { name: 'Gem navn' })).not.toBeInTheDocument();
  });

  it('er fyldt accent med creme tekst, når navnet er ændret og gyldigt', async () => {
    vis();

    const felt = await navnefelt();
    await userEvent.clear(felt);
    await userEvent.type(felt, 'Emilie');

    const knap = screen.getByRole('button', { name: 'Gem navn' });
    expect(knap).toHaveClass('ui-button--primaer');
    expect(knap).toBeEnabled();
    expect(knap.style.color).toBe('var(--accent-tekst)');
  });

  it('gemmer det trimmede navn og forsvinder bagefter', async () => {
    vis();

    const felt = await navnefelt();
    await userEvent.clear(felt);
    await userEvent.type(felt, '  Emilie ');
    await userEvent.click(screen.getByRole('button', { name: 'Gem navn' }));

    expect(await screen.findByText('Navnet er gemt.')).toBeInTheDocument();
    expect(testNavn).toBe('Emilie');
    expect(screen.queryByRole('button', { name: 'Gem navn' })).not.toBeInTheDocument();
  });

  it('gemmer med Enter', async () => {
    vis();

    const felt = await navnefelt();
    await userEvent.clear(felt);
    await userEvent.type(felt, 'Noor{Enter}');

    expect(await screen.findByText('Navnet er gemt.')).toBeInTheDocument();
    expect(testNavn).toBe('Noor');
  });
});

describe('validering', () => {
  it('siger fra over for et tomt navn og slukker knappen', async () => {
    vis();

    const felt = await navnefelt();
    await userEvent.clear(felt);

    expect(screen.getByRole('alert')).toHaveTextContent('Navnet må ikke være tomt');
    expect(felt).toHaveAttribute('aria-invalid', 'true');
    const knap = screen.getByRole('button', { name: 'Gem navn' });
    expect(knap).toBeDisabled();
    expect(knap).not.toHaveClass('ui-button--primaer');
  });

  it('gemmer ikke kun mellemrum', async () => {
    vis();

    const felt = await navnefelt();
    await userEvent.clear(felt);
    await userEvent.type(felt, '   {Enter}');

    expect(testNavn).toBe('Emil');
    expect(screen.queryByText('Navnet er gemt.')).not.toBeInTheDocument();
  });

  it('viser en slukket knap, når kontoen ikke har et navn', async () => {
    saetTestNavn('');
    vis();

    await navnefelt();
    expect(screen.getByRole('button', { name: 'Gem navn' })).toBeDisabled();
    expect(screen.getByRole('alert')).toHaveTextContent('Navnet må ikke være tomt');
  });
});

describe('én fyldt accent', () => {
  it('har ingen fyldt accent, når der ikke er noget at gemme', async () => {
    vis();

    await navnefelt();
    expect(fyldteAccenter()).toHaveLength(0);
  });

  it('har præcis én, når navnet er ændret', async () => {
    vis();

    const felt = await navnefelt();
    await userEvent.type(felt, 'x');
    expect(fyldteAccenter()).toHaveLength(1);
    expect(fyldteAccenter()[0]).toHaveTextContent('Gem navn');
  });

  it('har heller ikke mere end én på mobil', async () => {
    vis(MOBIL);

    const felt = await navnefelt();
    await userEvent.type(felt, 'x');
    expect(fyldteAccenter()).toHaveLength(1);
  });

  it('tegner Synkronisér nu som outline', async () => {
    vis();

    expect(await screen.findByRole('button', { name: 'Synkronisér nu' })).toHaveClass('ui-button--sekundaer');
  });

  it('tegner de valgte segmenter stille', async () => {
    vis();

    await navnefelt();
    const valgte = screen.getAllByRole('button', { pressed: true });
    expect(valgte.length).toBeGreaterThanOrEqual(2);
    for (const v of valgte) expect(v.style.background).toBe('var(--accent-bg)');
  });
});

describe('din krop', () => {
  it('forklarer hvad tallene bruges til, og at de ikke deles', async () => {
    vis();

    const titel = await screen.findByText('Din krop');
    const sektion = titel.closest('section') as HTMLElement;
    expect(within(sektion).getByText(/vand- og madforslag/)).toBeInTheDocument();
    expect(within(sektion).getByText(/deles\s+aldrig med gæster/)).toBeInTheDocument();
    expect(within(sektion).getByLabelText(/Vægt/)).toBeInTheDocument();
  });
});

describe('om', () => {
  it('beholder versionslinjen med semver og build-sha', async () => {
    vis();

    expect(await screen.findByText(new RegExp(`^version ${__APP_VERSION__} · ${__APP_COMMIT__}$`))).toBeInTheDocument();
  });
});
