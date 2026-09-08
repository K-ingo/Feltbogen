// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

vi.mock('./pb', () => import('./test/pbMock'));

import { db } from './db';
import KontoskiftSide from './KontoskiftSide';
import { logUd } from './pb';
import { adopterBase, kontostatus } from './konto';
import { lavItem, lavTur } from './test/data';
import { tegn } from './test/skaerm';

// ─────────────────────────────────────────────
// Skærmen ved et kontoskift
//
// Den står i vejen med vilje: ét sync-kald under den forkerte konto kopierer
// den forrige ejers grej derover, og det kan ikke fortrydes. Spærren i sync er
// testet for sig — det her handler om, at skærmen giver de rigtige valg, og at
// ingen af dem sker af sig selv.
// ─────────────────────────────────────────────

const ryd = () => Promise.all([
  db.items.clear(), db.grupper.clear(), db.ture.clear(),
  db.steder.clear(), db.personer.clear(), db.billeder.clear(),
  db.slettede.clear(), db.indstillinger.clear()
]);

beforeEach(async () => {
  await ryd();
  vi.restoreAllMocks();
  vi.mocked(logUd).mockClear();
  // jsdom har slet ikke createObjectURL — den kan ikke spies på, den skal
  // tildeles. Og en test skal ikke forsøge at hente en fil ned, så klikket på
  // det skjulte link stubbes med.
  URL.createObjectURL = vi.fn(() => 'blob:test');
  URL.revokeObjectURL = vi.fn();
  vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
});

// Emil ejer basen; Maja er logget ind.
const somMaja = async () => {
  await adopterBase('emil');
  return tegn(<KontoskiftSide brugerId="maja" />);
};

describe('hvad skærmen siger', () => {
  it('fortæller hvorfor synkroniseringen står stille', async () => {
    await somMaja();

    expect(screen.getByRole('heading', { name: /anden konto/i })).toBeInTheDocument();
    expect(screen.getByText(/pause/i)).toBeInTheDocument();
  });

  it('nævner ikke den forrige ejer', async () => {
    await adopterBase('emil@eksempel.dk');
    tegn(<KontoskiftSide brugerId="maja" />);

    expect(document.body.textContent).not.toContain('emil@eksempel.dk');
  });

  it('siger hvor meget der ligger lokalt', async () => {
    await db.items.bulkAdd([lavItem({ navn: 'Økse' }), lavItem({ navn: 'Tarp' })]);
    await db.ture.add(lavTur({ navn: 'Møn' }));

    await somMaja();

    expect(await screen.findByText('3')).toBeInTheDocument();
  });

  it('advarer, når noget ikke er nået op på serveren', async () => {
    await db.items.add(lavItem({ navn: 'Aldrig sendt' }));

    await somMaja();

    expect(await screen.findByText(/ikke nået op/i)).toBeInTheDocument();
  });

  it('siger at billeder ikke er med i kopien', async () => {
    await somMaja();

    expect(screen.getByText(/billeder er ikke med/i)).toBeInTheDocument();
  });
});

describe('de tre valg', () => {
  it('rører ingenting, før man trykker', async () => {
    await db.items.add(lavItem({ navn: 'Står der endnu' }));

    await somMaja();

    expect(await db.items.count()).toBe(1);
    expect(await kontostatus('emil')).toBe('egen');
  });

  it('logger ud uden at slette noget', async () => {
    await db.items.add(lavItem({ navn: 'Overlever' }));
    await somMaja();

    await userEvent.click(screen.getByRole('button', { name: /log ud igen/i }));

    expect(logUd).toHaveBeenCalled();
    expect(await db.items.count()).toBe(1);
    expect(await kontostatus('emil')).toBe('egen');
  });

  it('gemmer en kopi uden at røre basen', async () => {
    await db.items.add(lavItem({ navn: 'Med i kopien' }));
    await somMaja();

    await userEvent.click(await screen.findByRole('button', { name: /gem en kopi/i }));

    expect(URL.createObjectURL).toHaveBeenCalled();
    expect(await db.items.count()).toBe(1);
  });

  it('rydder enheden og giver den til den nye konto', async () => {
    await db.items.add(lavItem({ navn: 'Emils økse' }));
    await db.ture.add(lavTur({ navn: 'Emils tur' }));
    await somMaja();

    await userEvent.click(screen.getByRole('button', { name: /ryd enheden/i }));

    expect(await db.items.count()).toBe(0);
    expect(await db.ture.count()).toBe(0);
    expect(await kontostatus('maja')).toBe('egen');
  });
});

// Den farlige knap må ikke kunne forveksles med de to andre, og den må ikke
// stå først. Rækkefølgen er en del af sikkerheden.
describe('den farlige knap', () => {
  it('står sidst af de tre', async () => {
    await somMaja();

    const knapper = screen.getAllByRole('button').map((k) => k.textContent ?? '');
    const ryd = knapper.findIndex((t) => /ryd enheden/i.test(t));
    const udlog = knapper.findIndex((t) => /log ud igen/i.test(t));
    const kopi = knapper.findIndex((t) => /gem en kopi/i.test(t));

    expect(udlog).toBeLessThan(ryd);
    expect(kopi).toBeLessThan(ryd);
  });

  it('siger at det ikke kan fortrydes', async () => {
    await somMaja();

    expect(screen.getByText(/kan ikke fortrydes/i)).toBeInTheDocument();
  });
});
