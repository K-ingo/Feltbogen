// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { Skal } from './Skal';
import type { Fane } from './Skal';
import { tegn, MOBIL, DESKTOP } from './test/skaerm';

// ─────────────────────────────────────────────
// Navigationen
//
// Skallen udleder to ting af den fane, den får: hvilken hovedfane der skal
// markeres, og om der skal stå en vej tilbage over titlen. Begge dele kommer
// fra én tabel — `HOERER_TIL` — netop for at de ikke kan komme ud af trit.
//
// Det er den regel, testene her holder fast i. En ny underskærm, der bliver
// glemt i tabellen, står uden markering og uden vej tilbage, og det er ikke
// noget, en typefejl eller en domænetest kan fange.
// ─────────────────────────────────────────────

const tegnSkal = (fane: Fane, bredde = MOBIL, skift = vi.fn()) => {
  const r = tegn(<Skal fane={fane} skift={skift} titel="En titel">indhold</Skal>, bredde);
  return { ...r, skift };
};

describe('bundnavigationen på mobil', () => {
  it('viser de fem faner', () => {
    tegnSkal('dashboard');

    const nav = screen.getByRole('navigation');
    const navne = Array.from(nav.querySelectorAll('button')).map((b) => b.textContent?.trim());
    expect(navne).toEqual(['Hjem', 'Ture', 'Grej', 'Folk', 'Mere']);
  });

  it('markerer den fane man står på', () => {
    tegnSkal('ture');

    expect(screen.getByRole('button', { name: 'Ture' })).toHaveAttribute('aria-current', 'page');
    expect(screen.getByRole('button', { name: 'Hjem' })).not.toHaveAttribute('aria-current');
  });

  it('skifter fane, når man trykker', async () => {
    const { skift } = tegnSkal('dashboard');

    await userEvent.click(screen.getByRole('button', { name: 'Grej' }));

    expect(skift).toHaveBeenCalledWith('inventar');
  });
});

// Kernen i det hele: står man inde på en underskærm, skal navigationen stadig
// vise hvor i appen man er.
describe('underskærme peger tilbage på deres hovedfane', () => {
  const hoerer: [Fane, string][] = [
    ['grupper', 'Grej'],
    ['steder', 'Mere'],
    ['statistik', 'Mere'],
    ['indstillinger', 'Mere']
  ];

  it.each(hoerer)('%s markerer %s i navigationen', (fane, hovedfane) => {
    tegnSkal(fane);

    expect(screen.getByRole('button', { name: hovedfane })).toHaveAttribute('aria-current', 'page');
  });

  it.each(hoerer)('%s får en "‹ %s"-linje over titlen', (fane, hovedfane) => {
    tegnSkal(fane);

    expect(screen.getByRole('button', { name: `‹ ${hovedfane}` })).toBeInTheDocument();
  });

  it('fører tilbage til hovedfanen, når man trykker på linjen', async () => {
    const { skift } = tegnSkal('grupper');

    await userEvent.click(screen.getByRole('button', { name: '‹ Grej' }));

    expect(skift).toHaveBeenCalledWith('inventar');
  });

  it('viser ingen tilbagelinje på en hovedfane', () => {
    tegnSkal('inventar');

    expect(screen.queryByText(/^‹/)).not.toBeInTheDocument();
  });
});

describe('sidebaren på PC', () => {
  it('viser de fire arbejdsfaner og Mere for sig', () => {
    tegnSkal('dashboard', DESKTOP);

    for (const navn of ['Hjem', 'Ture', 'Grej', 'Folk', 'Mere']) {
      expect(screen.getByRole('button', { name: navn })).toBeInTheDocument();
    }
  });

  it('markerer hovedfanen, også fra en underskærm', () => {
    tegnSkal('steder', DESKTOP);

    expect(screen.getByRole('button', { name: 'Mere' })).toHaveAttribute('aria-current', 'page');
  });

  // Begge navigationer har samme rolle og samme tilgængelige navn — der er
  // kun én af dem ad gangen, så det er ikke en fejl. Til gengæld kan de ikke
  // skelnes på rollen alene, og testen må se på hvilken af de to der står der.
  it('lægger navigationen i siden og ikke i bunden', () => {
    tegnSkal('dashboard', DESKTOP);

    const nav = screen.getByRole('navigation');
    expect(nav).toHaveClass('sidebar');
    expect(nav).not.toHaveClass('bottom-nav');
  });
});

describe('plus-knappen', () => {
  it('vises kun når skærmen har en primær handling', () => {
    const { unmount } = tegnSkal('ture');
    expect(screen.queryByRole('button', { name: /ny|tilføj|\+/i })).not.toBeInTheDocument();
    unmount();

    const fab = vi.fn();
    tegn(<Skal fane="ture" skift={vi.fn()} titel="Ture" fab={fab}>indhold</Skal>, MOBIL);
    expect(screen.getByRole('button', { name: /ny|tilføj|\+/i })).toBeInTheDocument();
  });
});
