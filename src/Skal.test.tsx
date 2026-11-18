// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import { act, screen } from '@testing-library/react';
import { useState } from 'react';
import userEvent from '@testing-library/user-event';

import { Skal } from './Skal';
import type { Fane } from './Skal';
import { tegn, MOBIL, DESKTOP } from './test/skaerm';
import { NyTurArk } from './Ark';

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

  // Loftet på hovedspalten er et valg, der er flyttet sig tre gange — 1100,
  // 1360, nu designets 1024. Testen holder ikke tallet, men reglen: det skal
  // bo ét sted. Skrives et tal direkte i skærmen igen, har vi to sandheder at
  // holde i sync, og næste ændring rammer kun den ene.
  it('tager spaltens loft fra tokenet og ikke fra et tal i skærmen', () => {
    tegnSkal('dashboard', DESKTOP);

    const hoved = document.querySelector('.desktop-main') as HTMLElement;
    expect(hoved.style.maxWidth).toBe('var(--hovedspalte)');
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

// ─────────────────────────────────────────────
// Bundnavigationen og tastaturet
//
// Skallen er lige så høj som det synlige felt. Kommer tastaturet frem, ligger
// navigationen ellers lige over det og dækker feltet, man skriver i — fundet
// på iPhone i Tur-detaljens titel.
// ─────────────────────────────────────────────

describe('bundnavigationen, mens man skriver', () => {
  const beroering = (punkter: number) =>
    Object.defineProperty(navigator, 'maxTouchPoints', { value: punkter, configurable: true });

  const tegnMedFelt = (bredde = MOBIL) => tegn(
    <Skal fane="ture" skift={vi.fn()} titel="Tur" fab={vi.fn()}>
      <input aria-label="Titel" />
      <input aria-label="Sted" />
      <input type="checkbox" aria-label="Pakket" />
    </Skal>,
    bredde
  );

  it('forsvinder, når et felt får fokus, og kommer igen bagefter', async () => {
    beroering(5);
    tegnMedFelt();
    expect(screen.getByRole('navigation')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Tilføj' })).toBeInTheDocument();

    await userEvent.click(screen.getByLabelText('Titel'));
    expect(screen.queryByRole('navigation')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Tilføj' })).not.toBeInTheDocument();

    // Fra ét felt til det næste: navigationen bliver væk.
    await userEvent.click(screen.getByLabelText('Sted'));
    expect(screen.queryByRole('navigation')).not.toBeInTheDocument();

    await userEvent.click(document.body);
    expect(await screen.findByRole('navigation')).toBeInTheDocument();
    beroering(0);
  });

  it('fjerner FAB-luften og ruller siden tilbage, mens man skriver', async () => {
    beroering(5);
    const rul = vi.spyOn(window, 'scrollTo').mockImplementation(() => {});
    tegnMedFelt();
    const ramme = screen.getByLabelText('Titel').parentElement!;
    expect(ramme.style.paddingBottom).toBe('140px');

    await userEvent.click(screen.getByLabelText('Titel'));
    expect(ramme.style.paddingBottom).toBe('24px');

    Object.defineProperty(window, 'scrollY', { value: 300, configurable: true });
    window.dispatchEvent(new Event('scroll'));
    expect(rul).toHaveBeenCalledWith(0, 0);

    Object.defineProperty(window, 'scrollY', { value: 0, configurable: true });
    rul.mockRestore();
    beroering(0);
  });

  it('bliver stående ved en afkrydsning', async () => {
    beroering(5);
    tegnMedFelt();
    await userEvent.click(screen.getByLabelText('Pakket'));
    expect(screen.getByRole('navigation')).toBeInTheDocument();
    beroering(0);
  });

  it('bliver stående på en smal skærm uden berøring', async () => {
    beroering(0);
    tegnMedFelt();
    await userEvent.click(screen.getByLabelText('Titel'));
    expect(screen.getByRole('navigation')).toBeInTheDocument();
  });

  it('rører ikke sidebaren på PC', async () => {
    beroering(5);
    tegnMedFelt(DESKTOP);
    await userEvent.click(screen.getByLabelText('Titel'));
    expect(screen.getByRole('navigation')).toBeInTheDocument();
    beroering(0);
  });
});

// Fundet headless: titel → datofeltet «Fra» → Annuller i Ny tur. Datofeltet er
// ikke et skrivefelt, og arket tager feltet med sig, når det lukker — så kom der
// aldrig et tjek, og navigationen blev væk på Ture-listen bagved.
describe('bundnavigationen, når et ark lukker', () => {
  const beroering = (punkter: number) =>
    Object.defineProperty(navigator, 'maxTouchPoints', { value: punkter, configurable: true });

  function TureMedArk() {
    const [aaben, setAaben] = useState(true);
    return (
      <>
        <Skal fane="ture" skift={vi.fn()} titel="Ture" fab={() => setAaben(true)}>liste</Skal>
        {aaben && <NyTurArk idag="2026-09-19" opret={vi.fn()} annuller={() => setAaben(false)} />}
      </>
    );
  }

  it('kommer igen efter titel → dato → Annuller', async () => {
    beroering(5);
    tegn(<TureMedArk />, MOBIL);

    await userEvent.click(await screen.findByLabelText('Titel'));
    expect(screen.queryByRole('navigation')).not.toBeInTheDocument();

    await userEvent.click(screen.getByLabelText('Fra'));
    await userEvent.click(screen.getByRole('button', { name: 'Annuller' }));

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(await screen.findByRole('navigation')).toBeInTheDocument();
    beroering(0);
  });

  it('kommer igen, når arket lukker med fokus i titlen', async () => {
    beroering(5);
    tegn(<TureMedArk />, MOBIL);

    await userEvent.click(await screen.findByLabelText('Titel'));
    await userEvent.keyboard('{Escape}');

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(await screen.findByRole('navigation')).toBeInTheDocument();
    beroering(0);
  });
});

// Ved blur er tastaturet stadig på vej ned. Kommer navigationen frem med det
// samme, står den et øjeblik over tastaturet på iPhone.
describe('bundnavigationen venter på, at tastaturet er væk', () => {
  class FalskViewport extends EventTarget {
    height = 844;
    offsetTop = 0;
    saet(h: number) { this.height = h; this.dispatchEvent(new Event('resize')); }
  }

  it('kommer først igen, når det synlige felt er tilbage i fuld højde', async () => {
    Object.defineProperty(navigator, 'maxTouchPoints', { value: 5, configurable: true });
    const vv = new FalskViewport();
    Object.defineProperty(window, 'visualViewport', { value: vv, configurable: true });
    window.innerHeight = 844;

    tegn(<Skal fane="ture" skift={vi.fn()} titel="Tur"><input aria-label="Titel" /></Skal>, MOBIL);
    await userEvent.click(screen.getByLabelText('Titel'));
    act(() => vv.saet(500));
    expect(screen.queryByRole('navigation')).not.toBeInTheDocument();

    // Feltet slipper fokus, men tastaturet står der endnu.
    await userEvent.click(document.body);
    await act(() => new Promise((r) => setTimeout(r, 50)));
    expect(screen.queryByRole('navigation')).not.toBeInTheDocument();

    act(() => vv.saet(844));
    expect(screen.getByRole('navigation')).toBeInTheDocument();

    Object.defineProperty(window, 'visualViewport', { value: undefined, configurable: true });
    Object.defineProperty(navigator, 'maxTouchPoints', { value: 0, configurable: true });
  });
});
