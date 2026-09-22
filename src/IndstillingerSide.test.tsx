// @vitest-environment jsdom
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

vi.mock('./pb', () => import('./test/pbMock'));

// Kontoen styres fra testen frem for fra authStore: skærmen ser forskellig ud
// med og uden en konto, og begge tilstande skal kunne tegnes. `vi.hoisted`,
// fordi mock-fabrikken læses før de almindelige imports.
const konto = vi.hoisted(() => ({
  bruger: null as { id: string; email: string; name?: string } | null
}));

vi.mock('./useAuth', () => ({
  useAuth: () => ({ bruger: konto.bruger, erLoggetInd: konto.bruger !== null })
}));

import { db } from './db';
import IndstillingerSide from './IndstillingerSide';
import * as pb from './test/pbMock';
import { tegn, DESKTOP } from './test/skaerm';

// ─────────────────────────────────────────────
// Indstillinger · desktop
//
// Fra handoff'en "Ejer Indstillinger · desktop" og den visuelle reference i
// `docs/design/desktop/10-indstillinger.html`. Testene her er
// acceptkriterierne skrevet ud.
//
// Skærmen er en indstillingsflade: næsten alt gemmes løbende, og der er
// derfor ikke noget at trykke på. Den ene undtagelse er navnet, som koster et
// kald til serveren — og det er også skærmens eneste fyldte accent, og kun
// når der står et rettet, gyldigt navn i feltet.
// ─────────────────────────────────────────────

beforeEach(async () => {
  await db.indstillinger.clear();
  konto.bruger = { id: 'bruger1', email: 'test@eksempel.dk', name: 'Emil' };
  pb.saetTestNavn('Emil');
  pb.logUd.mockClear();
});

const vis = () => tegn(
  <IndstillingerSide
    fane="indstillinger"
    skift={vi.fn()}
    tilLogin={vi.fn()}
    seRundvisning={vi.fn()}
  />,
  DESKTOP
);

// Alt på skærmen, der er en fyldt accent-flade: knapper med den primære
// variant, og alt andet, der har malet accenten på som baggrund. Den anden
// halvdel er der, fordi et segment kan bryde reglen uden at være en `Knap`.
const fyldteAccenter = () => Array.from(document.querySelectorAll<HTMLElement>('*'))
  .filter((el) => el.classList.contains('ui-button--primaer') || el.style.background === 'var(--accent)');

const navnefelt = () => screen.getByLabelText(/Dit navn/);
const gemNavn = () => screen.getByRole('button', { name: /Gem navn|Gemmer/ });

// Venter på, at skærmen står færdig. Felterne kommer af live-forespørgsler mod
// Dexie, så en synkron getBy lige efter render kan ramme en halv skærm.
const klar = () => screen.findByRole('heading', { level: 1, name: 'Indstillinger' });

describe('titel og undertitel', () => {
  it('siger Indstillinger', async () => {
    vis();

    expect(await klar()).toBeInTheDocument();
  });

  it('siger under titlen, hvad skærmen rummer', async () => {
    vis();

    expect(await screen.findByText('Konto, din krop og det der gælder hele appen')).toBeInTheDocument();
  });
});

describe('kun én fyldt accent', () => {
  it('er der ingen af, når der ikke er noget at gemme', async () => {
    vis();
    await klar();

    expect(gemNavn()).toBeDisabled();
    expect(gemNavn()).not.toHaveClass('ui-button--primaer');
    expect(fyldteAccenter()).toHaveLength(0);
  });

  it('er "Gem navn", så snart navnet er rettet', async () => {
    vis();
    await klar();

    await userEvent.type(navnefelt(), 'a');

    expect(gemNavn()).toBeEnabled();
    expect(fyldteAccenter()).toHaveLength(1);
    expect(fyldteAccenter()[0]).toHaveTextContent('Gem navn');
  });

  it('er ikke "Synkronisér nu" — den er outline', async () => {
    vis();
    await klar();

    const sync = screen.getByRole('button', { name: 'Synkronisér nu' });
    expect(sync).toBeEnabled();
    expect(sync).not.toHaveClass('ui-button--primaer');
  });

  it('er ikke segmenterne: det valgte står stille', async () => {
    vis();
    await klar();

    // Begge segmenter har et valgt punkt fra begyndelsen — standarden.
    expect(screen.getByRole('button', { name: 'middel' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: 'let' })).toHaveAttribute('aria-pressed', 'true');
    expect(fyldteAccenter()).toHaveLength(0);
  });

  it('er "Log ind eller opret konto", når der ikke er nogen konto', async () => {
    konto.bruger = null;
    vis();
    await klar();

    expect(fyldteAccenter()).toHaveLength(1);
    expect(fyldteAccenter()[0]).toHaveTextContent('Log ind eller opret konto');
  });
});

describe('navnet må ikke være tomt', () => {
  it('slår Gem fra, når feltet tømmes', async () => {
    vis();
    await klar();

    await userEvent.clear(navnefelt());

    expect(gemNavn()).toBeDisabled();
    expect(fyldteAccenter()).toHaveLength(0);
  });

  it('siger hvorfor, i stedet for bare at være slukket', async () => {
    vis();
    await klar();

    await userEvent.clear(navnefelt());

    expect(screen.getByText(/må ikke være tomt/)).toBeInTheDocument();
    expect(screen.getByText('Skriv et navn for at gemme.')).toBeInTheDocument();
  });

  it('gemmer ikke det tomme navn', async () => {
    vis();
    await klar();

    await userEvent.clear(navnefelt());
    await userEvent.click(gemNavn());

    expect(pb.testNavn).toBe('Emil');
  });

  it('gemmer et rettet navn og kvitterer', async () => {
    vis();
    await klar();

    await userEvent.clear(navnefelt());
    await userEvent.type(navnefelt(), 'Emil K');
    await userEvent.click(gemNavn());

    expect(pb.testNavn).toBe('Emil K');
    expect(await screen.findByText('Navnet er gemt.')).toBeInTheDocument();
  });

  it('slukker knappen igen, når navnet er sendt op', async () => {
    vis();
    await klar();

    await userEvent.type(navnefelt(), 'sen');
    await userEvent.click(gemNavn());

    await screen.findByText('Navnet er gemt.');
    expect(gemNavn()).toBeDisabled();
    expect(fyldteAccenter()).toHaveLength(0);
  });
});

describe('en konto uden navn', () => {
  beforeEach(() => {
    konto.bruger = { id: 'bruger1', email: 'test@eksempel.dk', name: '' };
    pb.saetTestNavn('');
  });

  it('siger hvad det betyder på de delte ture', async () => {
    vis();
    await klar();

    expect(screen.getByText(/står du som «Uden navn»/)).toBeInTheDocument();
  });

  it('holder op med at sige det, når navnet er gemt', async () => {
    vis();
    await klar();

    await userEvent.type(navnefelt(), 'Emil');
    await userEvent.click(gemNavn());

    await screen.findByText('Navnet er gemt.');
    expect(screen.queryByText(/står du som «Uden navn»/)).not.toBeInTheDocument();
  });
});

describe('etiketterne forklarer, hvad tingene bruges til', () => {
  it('siger hvor navnet står', async () => {
    vis();
    await klar();

    expect(screen.getByText(/står på dine ture og hos dem du deler med/)).toBeInTheDocument();
  });

  it('mærker e-mailen med at man er logget ind', async () => {
    vis();
    await klar();

    expect(screen.getByText('test@eksempel.dk')).toBeInTheDocument();
    expect(screen.getByText('Logget ind')).toBeInTheDocument();
  });

  it('siger hvad kroppens tal bruges til, og at de ikke deles', async () => {
    vis();
    await klar();

    expect(screen.getByText(/Bruges til at foreslå vægt og forbrug/)).toBeInTheDocument();
    expect(screen.getByText(/deles aldrig med gæster/)).toBeInTheDocument();
  });
});

describe('versionslinjen', () => {
  // Den kom med den foregående ændring: semver fra package.json og syv tegn
  // af sha'en, bagt ind ved build. Den står her, så en omlægning af skærmen
  // ikke kan tabe den igen.
  it('står stadig under Om med både semver og sha', async () => {
    vis();
    await klar();

    expect(screen.getByText(/^version \d+\.\d+\.\d+ · (?:[0-9a-f]{7}|ukendt)$/)).toBeInTheDocument();
  });
});
