// @vitest-environment jsdom
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

vi.mock('./pb', () => import('./test/pbMock'));

import { db } from './db';
import type { Tur } from './db';
import { Dagsplan } from './Dagsplan';
import { dageFor } from './turdag';
import { lavTur, lavTurDag } from './test/data';
import { tegn, DESKTOP } from './test/skaerm';

// ─────────────────────────────────────────────
// Dagene på turen
//
// Domænelogikken er testet for sig i turdag.test.ts. Det her er skærmen: at
// den kan oprette, rette, flytte og slette — og at den siger til, når noget
// ikke passer, uden at spærre.
// ─────────────────────────────────────────────

let tur: Tur;

beforeEach(async () => {
  await Promise.all([db.ture.clear(), db.tur_dage.clear(), db.slettede.clear(), db.indstillinger.clear()]);
  vi.spyOn(console, 'error').mockImplementation(() => {});

  tur = lavTur({ uid: 'tur-1', startdato: '2026-07-10', naetter: 2, aktivitet: 'vandretur', overnatning: 'shelter' });
  await db.ture.add(tur);
});

const laegInd = (dag_nr: number, felter = {}) =>
  db.tur_dage.add(lavTurDag({ tur_uid: 'tur-1', dag_nr, ...felter }));

const dageIBasen = async () => dageFor(await db.tur_dage.toArray(), 'tur-1');

describe('når turen ingen dage har', () => {
  it('inviterer frem for at vise en tom liste', async () => {
    tegn(<Dagsplan tur={tur} />, DESKTOP);

    expect(await screen.findByRole('button', { name: /læg 3 dage ind/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /tilføj én dag/i })).toBeInTheDocument();
  });

  it('lægger hele turen ind på én gang', async () => {
    tegn(<Dagsplan tur={tur} />, DESKTOP);

    await userEvent.click(await screen.findByRole('button', { name: /læg 3 dage ind/i }));

    await waitFor(async () => expect(await db.tur_dage.count()).toBe(3));
    expect((await dageIBasen()).map((d) => d.dag_nr)).toEqual([1, 2, 3]);
  });

  it('arver turens aktivitet og overnatning', async () => {
    tegn(<Dagsplan tur={tur} />, DESKTOP);

    await userEvent.click(await screen.findByRole('button', { name: /tilføj én dag/i }));

    await waitFor(async () => expect(await db.tur_dage.count()).toBe(1));
    const [dag] = await dageIBasen();
    expect(dag.aktivitet).toBe('vandretur');
    expect(dag.overnatning).toBe('shelter');
  });
});

describe('dagene på listen', () => {
  beforeEach(async () => {
    await laegInd(1, { aktivitet: 'vandretur', destination: 'Rold Skov' });
    await laegInd(2, { aktivitet: 'kano', destination: 'Sortesø' });
  });

  it('står i rækkefølge med deres dato', async () => {
    tegn(<Dagsplan tur={tur} />, DESKTOP);

    expect(await screen.findByText('Dag 1')).toBeInTheDocument();
    expect(screen.getByText('Dag 2')).toBeInTheDocument();
    // Datoen er udledt af turens start, ikke gemt på dagen.
    expect(screen.getByText('fre 10/7')).toBeInTheDocument();
    expect(screen.getByText('lør 11/7')).toBeInTheDocument();
  });

  it('viser ingen dato, når turen ikke har en startdato', async () => {
    tegn(<Dagsplan tur={{ ...tur, startdato: '' }} />, DESKTOP);

    expect(await screen.findByText('Dag 1')).toBeInTheDocument();
    expect(screen.queryByText(/\d+\/\d+/)).not.toBeInTheDocument();
  });

  // Regressionen: hvert tastetryk skrev direkte til basen, og useLiveQuery
  // tegnede om med den forrige værdi. "Møns Klint" blev til "MnKt".
  it('taber ikke bogstaver, når man skriver', async () => {
    tegn(<Dagsplan tur={tur} />, DESKTOP);

    const felter = await screen.findAllByLabelText('Hvorhen');
    await userEvent.clear(felter[0]);
    await userEvent.type(felter[0], 'Møns Klint');

    await waitFor(async () => {
      expect((await dageIBasen())[0].destination).toBe('Møns Klint');
    });
  });
});

describe('flyt en dag', () => {
  beforeEach(async () => {
    await laegInd(1, { destination: 'først' });
    await laegInd(2, { destination: 'sidst' });
  });

  it('bytter to dage om', async () => {
    tegn(<Dagsplan tur={tur} />, DESKTOP);

    await userEvent.click(await screen.findByRole('button', { name: /flyt dag 2 op/i }));

    await waitFor(async () => {
      const dage = await dageIBasen();
      expect(dage[0].destination).toBe('sidst');
      expect(dage[1].destination).toBe('først');
    });
  });

  // Den første dag kan ikke flyttes op, og den sidste ikke ned. Knapperne
  // fjernes ikke — så ville rækken hoppe — de slås fra.
  it('slår pilen fra i enderne', async () => {
    tegn(<Dagsplan tur={tur} />, DESKTOP);

    expect(await screen.findByRole('button', { name: /flyt dag 1 op/i })).toBeDisabled();
    expect(screen.getByRole('button', { name: /flyt dag 2 ned/i })).toBeDisabled();
    expect(screen.getByRole('button', { name: /flyt dag 1 ned/i })).toBeEnabled();
  });
});

describe('slet en dag', () => {
  it('lukker hullet i nummereringen', async () => {
    await laegInd(1, { destination: 'a' });
    await laegInd(2, { destination: 'b' });
    await laegInd(3, { destination: 'c' });

    tegn(<Dagsplan tur={tur} />, DESKTOP);

    const slet = await screen.findAllByRole('button', { name: 'Slet' });
    await userEvent.click(slet[1]);

    await waitFor(async () => {
      const dage = await dageIBasen();
      expect(dage.map((d) => d.dag_nr)).toEqual([1, 2]);
      expect(dage.map((d) => d.destination)).toEqual(['a', 'c']);
    });
  });
});

// Advarslerne blokerer aldrig. Man skal kunne planlægge en dag mere, før man
// har rettet nætterne — appen skal bare have sagt det.
describe('flere dage end turen er lang', () => {
  beforeEach(async () => {
    await laegInd(1);
    await laegInd(2);
    await laegInd(3);
  });

  it('siger til uden at spærre', async () => {
    const kort = { ...tur, naetter: 1 };
    tegn(<Dagsplan tur={kort} />, DESKTOP);

    expect(await screen.findByText(/turen er 2 dage, men der er planlagt 3/i)).toBeInTheDocument();
    expect(screen.getByText('uden for turen')).toBeInTheDocument();
    // Dagen står der stadig, og kan stadig rettes.
    expect(screen.getByText('Dag 3')).toBeInTheDocument();
  });

  it('siger ingenting, når dagene passer', async () => {
    tegn(<Dagsplan tur={tur} />, DESKTOP);

    expect(await screen.findByText('Dag 1')).toBeInTheDocument();
    expect(screen.queryByText(/uden for turen/i)).not.toBeInTheDocument();
  });
});
