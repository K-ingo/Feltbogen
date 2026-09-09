// @vitest-environment jsdom
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

vi.mock('./pb', () => import('./test/pbMock'));

import { db } from './db';
import DeltTurVisning from './DeltTurVisning';
import { lavSnapshot } from './gaest';
import { lavTur, lavTurDag } from './test/data';
import { tegn, DESKTOP } from './test/skaerm';

// ─────────────────────────────────────────────
// Dagsplanen, som en deltager ser den
//
// Gæsten skal have den samme mentale model som ejeren: dagene står som en
// sektion på Overblik, ikke i en fane for sig. Men hun kan ikke rette noget —
// dagene er ejerens plan, og et snapshot er frosset.
// ─────────────────────────────────────────────

beforeEach(async () => {
  await Promise.all([db.delte_ture.clear(), db.ture.clear(), db.tur_dage.clear()]);
  vi.spyOn(console, 'error').mockImplementation(() => {});
});

const tur = lavTur({ uid: 'tur-1', navn: 'Møn', startdato: '2026-07-10', naetter: 2 });

const medDage = (...dage: Parameters<typeof lavTurDag>[0][]) =>
  lavSnapshot(tur, [], [], new Date(), [], dage.map((d) => lavTurDag({ tur_uid: 'tur-1', ...d })));

const visning = (snapshot: ReturnType<typeof lavSnapshot>) =>
  tegn(<DeltTurVisning snapshot={snapshot} token={'a'.repeat(32)} />, DESKTOP);

describe('dagsplanen på gæstens overblik', () => {
  it('viser dagene med dato, slags og sted', () => {
    visning(medDage(
      { dag_nr: 1, aktivitet: 'vandretur', overnatning: 'shelter', destination: 'Rold Skov' },
      { dag_nr: 2, aktivitet: 'kano', overnatning: 'telt', destination: 'Sortesø' }
    ));

    expect(screen.getByText('Dag for dag')).toBeInTheDocument();
    expect(screen.getByText('Dag 1')).toBeInTheDocument();
    expect(screen.getByText('fre 10/7')).toBeInTheDocument();
    expect(screen.getByText('vandretur · shelter')).toBeInTheDocument();
    expect(screen.getByText('Rold Skov')).toBeInTheDocument();
    expect(screen.getByText('Sortesø')).toBeInTheDocument();
  });

  it('viser dagens noter', () => {
    visning(medDage({ dag_nr: 1, noter: 'Vi mødes ved p-pladsen kl. 9' }));

    expect(screen.getByText('Vi mødes ved p-pladsen kl. 9')).toBeInTheDocument();
  });

  // Etiketterne er de danske. Gæsten har ikke tabellen og skal ikke sidde med
  // "haengekoeje".
  it('skriver overnatningen ud på dansk', () => {
    visning(medDage({ dag_nr: 1, overnatning: 'haengekoeje', aktivitet: 'bushcraft' }));

    expect(screen.getByText('bushcraft · hængekøje')).toBeInTheDocument();
  });

  // De fleste ture har ingen dage. Så skal der ikke stå et tomt kort.
  it('viser ingenting, når turen ingen dage har', () => {
    visning(lavSnapshot(tur, [], []));

    expect(screen.queryByText('Dag for dag')).not.toBeInTheDocument();
  });

  it('viser ingenting på et gammelt snapshot uden feltet', () => {
    const gammelt = lavSnapshot(tur, [], []);
    // Version 5 kendte ikke dagene.
    delete (gammelt as { dage?: unknown }).dage;

    visning(gammelt);

    expect(screen.queryByText('Dag for dag')).not.toBeInTheDocument();
  });

  it('har ingenting at rette i', async () => {
    visning(medDage({ dag_nr: 1, destination: 'Rold Skov' }));

    // Ingen felter, ingen slet, ingen pile — dagene er ejerens plan.
    expect(screen.queryByLabelText('Hvorhen')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Slet' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /flyt dag/i })).not.toBeInTheDocument();
  });

  it('står på Overblik og ikke i en fane for sig', async () => {
    visning(medDage({ dag_nr: 1, destination: 'Rold Skov' }));

    // Ingen fane hedder noget med dagsplan — sektionen ligger på Overblik.
    expect(screen.queryByRole('tab', { name: /dag/i })).not.toBeInTheDocument();

    // Går man til en anden fane, følger dagene ikke med.
    await userEvent.click(screen.getByRole('tab', { name: 'Journal' }));
    expect(screen.queryByText('Dag for dag')).not.toBeInTheDocument();
  });
});
