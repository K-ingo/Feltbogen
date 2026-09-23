// @vitest-environment jsdom
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { screen } from '@testing-library/react';

vi.mock('./pb', () => import('./test/pbMock'));

import { db } from './db';
import StedDetalje from './StedDetalje';
import TurDetalje from './TurDetalje';
import { lavSted, lavTur } from './test/data';
import { tegn, DESKTOP } from './test/skaerm';

// ─────────────────────────────────────────────
// Noter fra sidst og genbesøg (research §3 #4)
//
// Et sted man kommer tilbage til, skal huske det man skrev sidst. Kun det
// forrige besøg — aldrig turen, man står i — og første gang siges det roligt,
// at der ikke er noget endnu.
// ─────────────────────────────────────────────

const note = (tid: string, tekst: string) => ({ id: tid, tid, tekst });

beforeEach(async () => {
  await Promise.all([
    db.steder.clear(), db.ture.clear(), db.items.clear(), db.grupper.clear(), db.billeder.clear()
  ]);
  vi.spyOn(console, 'error').mockImplementation(() => {});
});

const visTur = async (felter = {}) => {
  const id = await db.ture.add(lavTur({ navn: 'Weekend', sted: 'Rold Skov', ...felter }));
  tegn(<TurDetalje turId={id as number} tilbage={vi.fn()} />, DESKTOP);
};

const visSted = async (uid = 's-rold') => {
  const id = await db.steder.add(lavSted({ uid, navn: 'Rold Skov' }));
  tegn(
    <StedDetalje stedId={id as number} tilbage={vi.fn()} aabnTur={vi.fn()} opretTurHer={vi.fn()} />,
    DESKTOP
  );
};

describe('tur-detalje', () => {
  it('viser noten fra forrige besøg og ikke kladdens egen', async () => {
    await db.steder.add(lavSted({ uid: 's-rold', navn: 'Rold Skov' }));
    await db.ture.add(lavTur({
      navn: 'Maj', sted_uid: 's-rold', status: 'afsluttet', startdato: '2026-05-01', slutdato: '2026-05-03',
      feltnoter: [note('2026-05-02T09:00', 'Shelter 2 er tørrest')]
    }));

    await visTur({
      sted_uid: 's-rold', status: 'kladde', startdato: '2026-07-10',
      feltnoter: [note('2026-07-01T09:00', 'Kladdens egen note')]
    });

    expect(await screen.findByText('Været her 1 gang før')).toBeInTheDocument();
    expect(screen.getByText('Shelter 2 er tørrest')).toBeInTheDocument();
    expect(screen.getByText(/^Fra sidst/)).toBeInTheDocument();
    expect(screen.queryByText('Kladdens egen note')).not.toBeInTheDocument();
  });

  it('siger første gang og viser ingen opdigtet note', async () => {
    await db.steder.add(lavSted({ uid: 's-rold', navn: 'Rold Skov' }));
    await visTur({ sted_uid: 's-rold', status: 'kladde' });

    expect(await screen.findByText('Første gang her')).toBeInTheDocument();
    expect(screen.queryByText(/^Fra sidst/)).not.toBeInTheDocument();
    expect(screen.queryByText('Ingen note fra sidste besøg.')).not.toBeInTheDocument();
  });

  it('siger roligt, når der ikke blev skrevet noget sidst', async () => {
    await db.steder.add(lavSted({ uid: 's-rold', navn: 'Rold Skov' }));
    await db.ture.add(lavTur({ sted_uid: 's-rold', status: 'afsluttet', startdato: '2026-05-01' }));
    await visTur({ sted_uid: 's-rold', status: 'kladde', startdato: '2026-07-10' });

    expect(await screen.findByText('Ingen note fra sidste besøg.')).toBeInTheDocument();
  });

  it('har stadig kun én fyldt accent', async () => {
    await db.steder.add(lavSted({ uid: 's-rold', navn: 'Rold Skov' }));
    await db.ture.add(lavTur({ sted_uid: 's-rold', status: 'afsluttet', startdato: '2026-05-01', noter: 'Myg' }));
    await visTur({ sted_uid: 's-rold', status: 'kladde', startdato: '2026-07-10' });

    await screen.findByText('Myg');
    expect(document.querySelectorAll('.ui-button--primaer')).toHaveLength(1);
  });
});

describe('sted-kort', () => {
  it('tæller besøg, ikke planer, og viser noten fra seneste besøg', async () => {
    await db.ture.bulkAdd([
      lavTur({ sted_uid: 's-rold', status: 'afsluttet', startdato: '2025-05-01', noter: 'Gammel note' }),
      lavTur({ sted_uid: 's-rold', status: 'afsluttet', startdato: '2026-05-01', noter: 'Kildevand mod øst' }),
      lavTur({ sted_uid: 's-rold', status: 'kladde', startdato: '2026-10-01', noter: 'Planen' })
    ]);
    await visSted();

    expect(await screen.findByText('Været her 2 gange')).toBeInTheDocument();
    expect(screen.getByText('Note fra sidst')).toBeInTheDocument();
    expect(screen.getByText('Kildevand mod øst')).toBeInTheDocument();
    expect(screen.queryByText('Gammel note')).not.toBeInTheDocument();
    expect(screen.queryByText('Planen')).not.toBeInTheDocument();
  });

  it('er ærlig om et sted, man ikke har været', async () => {
    await db.ture.add(lavTur({ sted_uid: 's-rold', status: 'kladde' }));
    await visSted();

    expect(await screen.findByText('Aldrig været her')).toBeInTheDocument();
    expect(screen.getByText('Når du har været her, står noten fra turen her.')).toBeInTheDocument();
    expect(screen.queryByText('Note fra sidst')).not.toBeInTheDocument();
  });

  it('siger det, når seneste besøg ikke har en note', async () => {
    await db.ture.bulkAdd([
      lavTur({ sted_uid: 's-rold', status: 'afsluttet', startdato: '2025-05-01', noter: 'Gammel note' }),
      lavTur({ sted_uid: 's-rold', status: 'afsluttet', startdato: '2026-05-01' })
    ]);
    await visSted();

    expect(await screen.findByText('Ingen note fra sidste besøg.')).toBeInTheDocument();
    expect(screen.queryByText('Gammel note')).not.toBeInTheDocument();
  });
});
