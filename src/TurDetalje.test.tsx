// @vitest-environment jsdom
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

vi.mock('./pb', () => import('./test/pbMock'));

import { db } from './db';
import TurDetalje from './TurDetalje';
import { lavItem, lavTur } from './test/data';
import { tegn, DESKTOP } from './test/skaerm';

// ─────────────────────────────────────────────
// Tur-detalje · desktop
//
// Fra handoff'en "Ejer Tur-detalje · desktop" (16. sep 2026) og
// docs/design/desktop/03-tur-detalje.html.
//
// Den hårde regel er den samme som på de andre skærme: **højst én fyldt
// accent-knap i det første skærmbillede**. Den hører til turens næste skridt.
//
// Skærmen havde to. Statusvælgeren stod fremme hele tiden, og dens valgte
// felt er en fyldt accent-flade. I referencen er status en stille pille med
// "Skift status" ved siden af — vælgeren findes stadig, den ligger bare bag
// et tryk.
// ─────────────────────────────────────────────

beforeEach(async () => {
  await Promise.all([db.ture.clear(), db.items.clear(), db.grupper.clear(), db.billeder.clear()]);
  vi.spyOn(console, 'error').mockImplementation(() => {});
});

const visTur = async (felter = {}) => {
  const id = await db.ture.add(lavTur({ navn: 'Fovslet Skov', sted: 'Fovslet', ...felter }));
  tegn(<TurDetalje turId={id as number} tilbage={vi.fn()} />, DESKTOP);
  return id as number;
};

// Fyldte knapper i hele dokumentet. Skærmen tegner kun det første
// skærmbillede i jsdom — der er ingen rulning, så alt der findes, tæller.
const fyldte = () => Array.from(document.querySelectorAll('.ui-button--primaer'));

describe('kun én fyldt primary', () => {
  it('er turens næste skridt på en kladde', async () => {
    await visTur({ status: 'kladde' });

    expect(await screen.findByRole('button', { name: 'Markér som klar' })).toBeInTheDocument();
    expect(fyldte()).toHaveLength(1);
    expect(fyldte()[0]).toHaveTextContent('Markér som klar');
  });

  it('er det også på en klar tur', async () => {
    await visTur({ status: 'klar' });

    expect(await screen.findByRole('button', { name: 'Start tur' })).toBeInTheDocument();
    expect(fyldte()).toHaveLength(1);
  });

  it('er det også på en afsluttet tur', async () => {
    await visTur({ status: 'afsluttet' });

    // Pak-af-tjekket er turens næste skridt, når den er ovre. Det er også
    // den knap, referencen viser på en afsluttet tur.
    expect(await screen.findByRole('button', { name: /pak-af-tjek/i })).toBeInTheDocument();
    expect(fyldte()).toHaveLength(1);
  });

  it('holder også, når turen er i gang og har to knapper', async () => {
    await visTur({ status: 'aktiv' });

    // "På tur" står ved siden af som outline. To knapper, én fyldt.
    expect(await screen.findByRole('button', { name: 'På tur' })).toBeInTheDocument();
    expect(fyldte()).toHaveLength(1);
    expect(fyldte()[0]).toHaveTextContent('Afslut tur');
  });
});

describe('status aflæses, før den ændres', () => {
  it('står som en stille pille og ikke som en fyldt vælger', async () => {
    await visTur({ status: 'kladde' });

    await screen.findByText('Kladde');
    expect(document.querySelector('.trip-status-pille')).toBeInTheDocument();
    // Vælgerens knapper må ikke være fremme, før man beder om dem.
    expect(screen.queryByRole('button', { name: 'klar' })).not.toBeInTheDocument();
  });

  it('viser fasen og ikke bare statussen', async () => {
    // De fire statusser kender ikke forskel på en afsluttet tur og en, der
    // er gjort op. Det er netop den forskel, man står og vil vide.
    await visTur({ status: 'afsluttet' });
    expect(await screen.findByText('Afsluttet')).toBeInTheDocument();
  });

  it('henter vælgeren frem på Skift status', async () => {
    await visTur({ status: 'kladde' });

    await userEvent.click(await screen.findByRole('button', { name: 'Skift status' }));

    expect(screen.getByRole('button', { name: 'klar' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'aktiv' })).toBeInTheDocument();
  });

  it('lægger vælgeren væk igen, når der er valgt', async () => {
    const id = await visTur({ status: 'kladde' });

    await userEvent.click(await screen.findByRole('button', { name: 'Skift status' }));
    await userEvent.click(screen.getByRole('button', { name: 'klar' }));

    expect(await db.ture.get(id)).toMatchObject({ status: 'klar' });
    expect(await screen.findByRole('button', { name: 'Skift status' })).toBeInTheDocument();
  });
});

describe('den primære knap følger turens forløb', () => {
  it('siger aldrig Pak færdig', async () => {
    // Acceptkriteriet fra handoff'en. Knappen følger fasen, ikke pakningen,
    // så den kan ikke komme til at bede om at gøre noget færdigt, man ikke
    // er begyndt på.
    await visTur({ status: 'kladde' });

    await screen.findByRole('button', { name: 'Markér som klar' });
    expect(document.body.textContent).not.toMatch(/Pak færdig/i);
  });

  it('beder om et pak-af-tjek frem for at afslutte en tur, der er ovre', async () => {
    await db.items.add(lavItem({ uid: 'u-telt', navn: 'Telt' }));
    await visTur({ status: 'afsluttet', loese_item_ids: ['u-telt'] });

    expect(await screen.findByRole('button', { name: /pak-af-tjek/i })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Afslut tur' })).not.toBeInTheDocument();
  });
});
