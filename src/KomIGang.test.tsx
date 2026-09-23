// @vitest-environment jsdom
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { screen, within, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

vi.mock('./pb', () => import('./test/pbMock'));

import { db } from './db';
import DashboardSide from './DashboardSide';
import TureListe from './TureListe';
import InventarSide from './InventarSide';
import { startskridt, knapvariant, GREJ_START } from './komIGang';
import { lavItem, lavTur } from './test/data';
import { tegn, DESKTOP, MOBIL } from './test/skaerm';

// ─────────────────────────────────────────────
// Kom i gang — den tomme tilstand på Hjem, Ture og Grej
//
// Notion: "Empty sheets/CTA (Hjem·Ture·Grej)". En tom skærm skal give værdi
// før inventaret: konkrete skridt, ikke en rundvisning, ingen eksempeldata,
// og stadig kun én fyldt accent pr. skærmbillede.
// ─────────────────────────────────────────────

// Samme definition som ctaPas.test.tsx: en primær `Knap` eller alt, der kan
// trykkes på og har accenten malet på som baggrund (FAB'en).
const fyldteAccenter = () => Array.from(document.querySelectorAll<HTMLElement>('button, a, [role="button"]'))
  .filter((el) => el.classList.contains('ui-button--primaer') || el.style.background === 'var(--accent)');

const komIGang = () => screen.findByRole('region', { name: 'Kom i gang' });

beforeEach(async () => {
  await Promise.all([
    db.items.clear(), db.ture.clear(), db.delte_ture.clear(), db.grupper.clear(),
    db.steder.clear(), db.billeder.clear(), db.indstillinger.clear()
  ]);
  vi.spyOn(console, 'error').mockImplementation(() => {});
});

describe('startskridt', () => {
  it('er to skridt på en tom konto — gæstelink-demoen er udeladt', () => {
    const s = startskridt(0, 0);
    expect(s.map((x) => x.id)).toEqual(['tur', 'grej']);
    expect(s.every((x) => !x.gjort)).toBe(true);
    expect(s[1].knap).toBe(`Tilføj ${GREJ_START} grej`);
  });

  it('tæller det rigtige grej op og kalder først skridtet gjort ved fem', () => {
    expect(startskridt(0, 3)[1]).toMatchObject({ gjort: false, detalje: '3 af 5 skrevet ind.', knap: 'Tilføj mere grej' });
    expect(startskridt(0, 5)[1]).toMatchObject({ gjort: true, detalje: '5 ting skrevet ind.' });
  });

  it('kalder turen gjort, så snart der findes én', () => {
    expect(startskridt(1, 0)[0].gjort).toBe(true);
  });

  it('giver outline til skærmens eget skridt, og tekst til resten', () => {
    const s = startskridt(0, 0);
    expect(knapvariant(s, 'tur', 'tur')).toBe('sekundaer');
    expect(knapvariant(s, 'grej', 'tur')).toBe('tekst');
    expect(knapvariant(s, 'grej', 'grej')).toBe('sekundaer');
    expect(knapvariant(s, 'tur', 'grej')).toBe('tekst');
    // Er skærmens eget skridt gjort, går outline videre til det næste.
    expect(knapvariant(startskridt(0, 5), 'tur', 'grej')).toBe('sekundaer');
    expect(knapvariant(s, 'grej', 'tur', ['tur'])).toBe('sekundaer');
  });
});

describe.each([['PC', DESKTOP], ['telefon', MOBIL]] as const)('Hjem · tom konto · %s', (_navn, bredde) => {
  const vis = (nytItem = vi.fn(), foersteTur = vi.fn()) => tegn(
    <DashboardSide
      fane="dashboard" skift={vi.fn()} aabnItem={vi.fn()} aabnTur={vi.fn()}
      aabnAar={vi.fn()} nytItem={nytItem} nyTur={vi.fn()} foersteTur={foersteTur}
      tilLogin={vi.fn()}
    />,
    bredde
  );

  it('viser Kom i gang med kun én fyldt accent — kortets tur', async () => {
    vis();
    const sektion = await komIGang();

    expect(within(sektion).getByText('Opret første tur')).toBeInTheDocument();
    // Kortet ovenover ejer turknappen; skridtet står uden en knap nummer to.
    expect(within(sektion).queryByRole('button', { name: 'Opret første tur' })).not.toBeInTheDocument();
    expect(within(sektion).getByRole('button', { name: 'Tilføj 5 grej' })).toHaveClass('ui-button--sekundaer');
    expect(fyldteAccenter()).toHaveLength(1);
    expect(fyldteAccenter()[0]).toHaveTextContent('Planlæg en tur');
  });

  it('åbner opret-arket fra grejskridtet', async () => {
    const nytItem = vi.fn();
    vis(nytItem);
    await userEvent.click(within(await komIGang()).getByRole('button', { name: 'Tilføj 5 grej' }));
    expect(nytItem).toHaveBeenCalled();
  });

  it('tæller det grej, der faktisk er skrevet ind', async () => {
    await db.items.bulkAdd([lavItem({ navn: 'Telt' }), lavItem({ navn: 'Sovepose' })]);
    vis();
    expect(await within(await komIGang()).findByText('2 af 5 skrevet ind.')).toBeInTheDocument();
  });

  it('forsvinder, når der findes en tur', async () => {
    await db.ture.add(lavTur({ navn: 'Møn' }));
    vis();
    // Hjem tegner først med en tom liste og skifter, når turen er læst.
    await waitFor(() => expect(screen.queryByRole('region', { name: 'Kom i gang' })).not.toBeInTheDocument());
    // Heller ikke med en tur er der en FAB på telefonens Hjem: kortets knap er
    // den fyldte accent, og FAB'en ville være nummer to. Se mobile/01-hjem.html.
    if (bredde === MOBIL) {
      expect(await screen.findByText('Møn')).toBeInTheDocument();
      expect(screen.queryByRole('button', { name: 'Tilføj' })).not.toBeInTheDocument();
    }
  });
});

describe.each([['PC', DESKTOP], ['telefon', MOBIL]] as const)('Ture · tom liste · %s', (_navn, bredde) => {
  const vis = (foersteTur = vi.fn(), nytItem = vi.fn()) => tegn(
    <TureListe
      fane="ture" skift={vi.fn()} aabnTur={vi.fn()} aabnDeltTur={vi.fn()} nyTur={vi.fn()}
      foersteTur={foersteTur} nytItem={nytItem}
    />,
    bredde
  );

  it('har skridtene som outline og tekst — "+ Ny tur" er den ene fyldte', async () => {
    vis();
    const sektion = await komIGang();

    expect(within(sektion).getByRole('button', { name: 'Opret første tur' })).toHaveClass('ui-button--sekundaer');
    expect(within(sektion).getByRole('button', { name: 'Tilføj 5 grej' })).toHaveClass('ui-button--tekst');
    expect(fyldteAccenter()).toHaveLength(1);
    // Også på telefonen: headeren har "+ Ny tur" som i
    // docs/design/mobile/02-ture.html, og FAB'en er væk.
    expect(fyldteAccenter()[0]).toHaveTextContent('+ Ny tur');
  });

  it('fører første tur til det guidede flow og grejet til opret-arket', async () => {
    const foersteTur = vi.fn();
    const nytItem = vi.fn();
    vis(foersteTur, nytItem);
    const sektion = await komIGang();

    await userEvent.click(within(sektion).getByRole('button', { name: 'Opret første tur' }));
    await userEvent.click(within(sektion).getByRole('button', { name: 'Tilføj 5 grej' }));
    expect(foersteTur).toHaveBeenCalled();
    expect(nytItem).toHaveBeenCalled();
  });
});

describe.each([['PC', DESKTOP], ['telefon', MOBIL]] as const)('Grej · tom konto · %s', (_navn, bredde) => {
  const vis = (nytItem = vi.fn()) => tegn(
    <InventarSide fane="inventar" skift={vi.fn()} aabnItem={vi.fn()} nytItem={nytItem} foersteTur={vi.fn()} />,
    bredde
  );

  it('har "Tilføj 5 grej" som outline — "+ Tilføj grej" er den ene fyldte', async () => {
    vis();
    const sektion = await komIGang();

    expect(within(sektion).getByRole('button', { name: 'Tilføj 5 grej' })).toHaveClass('ui-button--sekundaer');
    expect(within(sektion).getByRole('button', { name: 'Opret første tur' })).toHaveClass('ui-button--tekst');
    expect(fyldteAccenter()).toHaveLength(1);
    // På telefonen står "+ Tilføj" i headeren som i
    // docs/design/mobile/03-grej.html, og FAB'en er væk.
    expect(fyldteAccenter()[0]).toHaveTextContent(bredde === DESKTOP ? '+ Tilføj grej' : '+ Tilføj');
  });

  it('markerer turen gjort, når der findes en — uden at opfinde noget', async () => {
    await db.ture.add(lavTur({ navn: 'Møn' }));
    vis();
    const sektion = await komIGang();

    expect(await within(sektion).findByText('Du har en tur at pakke til.')).toBeInTheDocument();
    expect(within(sektion).queryByRole('button', { name: 'Opret første tur' })).not.toBeInTheDocument();
    expect(within(sektion).getByRole('button', { name: 'Tilføj 5 grej' })).toHaveClass('ui-button--sekundaer');
  });

  it('åbner opret-arket som ejet grej', async () => {
    const nytItem = vi.fn();
    vis(nytItem);
    await userEvent.click(within(await komIGang()).getByRole('button', { name: 'Tilføj 5 grej' }));
    expect(nytItem).toHaveBeenCalledWith('ejer');
  });

  it('viser den almindelige liste, så snart der er grej', async () => {
    await db.items.add(lavItem({ navn: 'Telt' }));
    vis();
    expect(await screen.findAllByText('Telt')).not.toHaveLength(0);
    expect(screen.queryByRole('region', { name: 'Kom i gang' })).not.toBeInTheDocument();
  });
});
