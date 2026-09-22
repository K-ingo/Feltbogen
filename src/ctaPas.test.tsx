// @vitest-environment jsdom
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

vi.mock('./pb', () => import('./test/pbMock'));

import { db } from './db';
import AarsopgoerelseSide from './AarsopgoerelseSide';
import StedDetalje from './StedDetalje';
import PakAfTjekSide from './PakAfTjekSide';
import FoersteTur from './FoersteTur';
import { nytPakAfTjek } from './pakAfTjek';
import { lavItem, lavSted, lavTur } from './test/data';
import { tegn, DESKTOP } from './test/skaerm';

// ─────────────────────────────────────────────
// CTA-passet på de øvrige PC-skærme
//
// STATUS.md pkt. 10: skærmene uden egen handoff var aldrig holdt op mod
// reglen om én fyldt accent pr. skærmbillede. Her er de, der brød den, og
// hvad der blev tilbage som den ene.
//
// En fyldt accent er en `Knap` med den primære variant *eller* alt andet,
// der har malet accenten på som baggrund — det var segmentvælgerne og
// valgknapperne, der brød reglen, og de er ikke knapper af den primære slags.
//
// Kun ting, man kan trykke på, tæller. En søjle i Årsopgørelsens diagram og
// Første turs trinstreg på 3 px er malet i accenten, men de er ikke en flade,
// der konkurrerer om at være skærmens næste skridt.
// ─────────────────────────────────────────────

const erStreg = (el: HTMLElement) => parseFloat(el.style.height) <= 4;

const fyldteAccenter = () => Array.from(document.querySelectorAll<HTMLElement>('button, a, [role="button"]'))
  .filter((el) => !erStreg(el))
  .filter((el) => el.classList.contains('ui-button--primaer') || el.style.background === 'var(--accent)');

beforeEach(async () => {
  await Promise.all([db.ture.clear(), db.items.clear(), db.steder.clear(), db.grupper.clear()]);
  vi.spyOn(console, 'error').mockImplementation(() => {});
});

describe('Årsopgørelse', () => {
  it('har årets feltbog som eneste fyldte accent, også med flere år at vælge imellem', async () => {
    await db.ture.bulkAdd([
      lavTur({ navn: 'Fovslet Skov', status: 'afsluttet', startdato: '2025-06-01', slutdato: '2025-06-02' }),
      lavTur({ navn: 'Rold Skov', status: 'afsluttet', startdato: '2026-06-01', slutdato: '2026-06-02' })
    ]);
    tegn(
      <AarsopgoerelseSide
        aar={2026} vaelgAar={vi.fn()} aabnFeltbog={vi.fn()} tilbage={vi.fn()}
        aabnTur={vi.fn()} aabnItem={vi.fn()}
      />,
      DESKTOP
    );

    expect(await screen.findByRole('button', { name: /Årets feltbog/ })).toBeInTheDocument();
    expect(fyldteAccenter()).toHaveLength(1);
    expect(fyldteAccenter()[0]).toHaveTextContent('Årets feltbog');
  });

  it('viser stadig, hvilket år der er valgt, og lader en vælge et andet', async () => {
    await db.ture.bulkAdd([
      lavTur({ status: 'afsluttet', startdato: '2025-06-01', slutdato: '2025-06-02' }),
      lavTur({ status: 'afsluttet', startdato: '2026-06-01', slutdato: '2026-06-02' })
    ]);
    const vaelgAar = vi.fn();
    tegn(
      <AarsopgoerelseSide
        aar={2026} vaelgAar={vaelgAar} aabnFeltbog={vi.fn()} tilbage={vi.fn()}
        aabnTur={vi.fn()} aabnItem={vi.fn()}
      />,
      DESKTOP
    );

    expect(await screen.findByRole('button', { name: '2026' })).toHaveAttribute('aria-pressed', 'true');
    await userEvent.click(screen.getByRole('button', { name: '2025' }));
    expect(vaelgAar).toHaveBeenCalledWith(2025);
  });
});

describe('Sted-detalje', () => {
  it('har Opret tur her som eneste fyldte accent — Find er et opslag', async () => {
    const id = await db.steder.add(lavSted({ navn: 'Fovslet Skov', adresse: 'Fovslet' }));
    tegn(<StedDetalje stedId={id} tilbage={vi.fn()} aabnTur={vi.fn()} opretTurHer={vi.fn()} />, DESKTOP);

    expect(await screen.findByRole('button', { name: 'Find' })).not.toHaveClass('ui-button--primaer');
    expect(fyldteAccenter()).toHaveLength(1);
    expect(fyldteAccenter()[0]).toHaveTextContent('Opret tur her');
  });
});

describe('Pak-af-tjek', () => {
  it('har Færdig som eneste fyldte accent, selv med en vælger på hver række', async () => {
    const items = [lavItem({ navn: 'Telt' }), lavItem({ navn: 'Sovepose' }), lavItem({ navn: 'Kogegrej' })];
    const tur = lavTur({ status: 'afsluttet' });
    tegn(
      <PakAfTjekSide
        tur={tur} tjek={nytPakAfTjek(items, 'grundig')} pakItems={items} grupper={[]}
        gem={vi.fn()} tilbage={vi.fn()}
      />,
      DESKTOP
    );

    expect(await screen.findByText('Sovepose')).toBeInTheDocument();
    expect(fyldteAccenter()).toHaveLength(1);
    expect(fyldteAccenter()[0]).toHaveTextContent('Færdig');
  });
});

describe('Første tur', () => {
  it('maler ikke et valgt svar i fyldt accent ved siden af trinnets knap', async () => {
    await db.steder.add(lavSted({ navn: 'Rold Skov' }));
    tegn(<FoersteTur fortryd={vi.fn()} faerdig={vi.fn()} />, DESKTOP);

    await userEvent.click(await screen.findByRole('button', { name: 'Rold Skov' }));

    expect(fyldteAccenter()).toHaveLength(1);
    expect(fyldteAccenter()[0]).toHaveTextContent('Videre');
  });
});
