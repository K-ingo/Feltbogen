// @vitest-environment jsdom
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

vi.mock('./pb', () => import('./test/pbMock'));

import { db } from './db';
import InventarSide from './InventarSide';
import { NytGrejArk } from './Ark';
import { lavItem, lavGruppe } from './test/data';
import { tegn, DESKTOP, MOBIL } from './test/skaerm';

// ─────────────────────────────────────────────
// Grej · desktop
//
// Fra handoff'en "Ejer Grej · desktop" (16. sep 2026) og den visuelle
// reference i `docs/design/desktop/05-grej.html`. Testene her er
// acceptkriterierne skrevet ud.
//
// Det kriterium, der bar resten: **højst én fyldt accent pr. skærmbillede**.
// Fanebladene over listen tegnede den valgte fane som en fyldt accent-pille,
// og sammen med "+ Tilføj grej" var det to. Referencen tegner faneblade med
// en streg under det valgte i stedet.
//
// Dertil: Grejsæt skal være en tydelig anden vej end den fyldte knap, og
// vedligeholdet skal kunne ses på selve rækken — ikke kun på en fane, man
// skal huske at åbne.
// ─────────────────────────────────────────────

beforeEach(async () => {
  await Promise.all([db.items.clear(), db.grupper.clear(), db.ture.clear()]);
  vi.spyOn(console, 'error').mockImplementation(() => {});
});

// Vedligehold, der for længst skulle have været gjort. Datoen ligger så langt
// tilbage, at testen svarer det samme, uanset hvornår den køres.
const FORFALDENT = [{
  id: 'h-impraegnering',
  navn: 'Imprægnering',
  sidst_udfoert: '01/2000',
  interval_maaneder: 12,
  noter: ''
}];

const vis = () => tegn(
  <InventarSide fane="inventar" skift={vi.fn()} aabnItem={vi.fn()} nytItem={vi.fn()} />,
  DESKTOP
);

// Alt på skærmen, der er en fyldt accent-flade: knapper med den primære
// variant, og alt andet, der har malet accenten på som baggrund. Den anden
// halvdel er der, fordi fanebladene brød reglen uden at være en `Knap` —
// en optælling af `.ui-button--primaer` alene ville ikke have fanget dem.
const fyldteAccenter = () => Array.from(document.querySelectorAll<HTMLElement>('*'))
  .filter((el) => el.classList.contains('ui-button--primaer') || el.style.background === 'var(--accent)');

const fane = (navn: RegExp) => screen.getByRole('button', { name: navn });

describe('kun én fyldt accent', () => {
  it('er + Tilføj grej, når der er grej på listen', async () => {
    await db.items.add(lavItem({ navn: 'Sovepose' }));
    vis();

    expect(await screen.findByText('Sovepose')).toBeInTheDocument();
    expect(fyldteAccenter()).toHaveLength(1);
    expect(fyldteAccenter()[0]).toHaveTextContent('Tilføj grej');
  });

  it('er den stadig, når en fane er valgt', async () => {
    await db.items.add(lavItem({ navn: 'Sovepose' }));
    vis();

    await screen.findByText('Sovepose');
    await userEvent.click(fane(/^Indkøb/));

    expect(fane(/^Indkøb/)).toHaveAttribute('aria-pressed', 'true');
    expect(fyldteAccenter()).toHaveLength(1);
    expect(fyldteAccenter()[0]).toHaveTextContent('Tilføj grej');
  });

  it('er den stadig, når listen er tom', async () => {
    vis();

    // Den tomme tilstand skal have en tydelig vej til at tilføje grej — men
    // den må ikke lægge endnu en fyldt knap oven i headerens.
    expect(await screen.findByRole('button', { name: 'Tilføj 5 grej' })).toBeInTheDocument();
    expect(fyldteAccenter()).toHaveLength(1);
    expect(fyldteAccenter()[0]).toHaveTextContent('+ Tilføj grej');
  });

  it('markerer den valgte fane med aria-pressed og ikke med en fyldt flade', async () => {
    await db.items.add(lavItem({ navn: 'Sovepose' }));
    vis();

    await screen.findByText('Sovepose');
    const valgt = fane(/^Ejer/);
    expect(valgt).toHaveAttribute('aria-pressed', 'true');
    // Fanebladenes udseende ligger i stilarket. Står der farver i `style`,
    // er pillen på vej tilbage.
    expect(valgt.getAttribute('style')).toBeNull();
    expect(valgt).not.toHaveClass('ui-button--primaer');
  });
});

describe('Grej er den aktive fane', () => {
  it('er markeret i sidebaren', async () => {
    await db.items.add(lavItem({ navn: 'Sovepose' }));
    vis();

    await screen.findByText('Sovepose');
    const sidebar = document.querySelector('nav.sidebar') as HTMLElement;
    expect(within(sidebar).getByRole('button', { name: 'Grej' })).toHaveAttribute('aria-current', 'page');
  });
});

describe('Grejsæt er en tydelig anden vej', () => {
  it('står som et kort med Åbn og ikke som en fyldt knap', async () => {
    vis();

    const indgang = await screen.findByRole('button', { name: /Grejsæt/ });
    expect(indgang).toHaveClass('gear-sets-card');
    expect(within(indgang).getByText('Åbn')).toBeInTheDocument();
    expect(indgang).not.toHaveClass('ui-button--primaer');
  });

  it('fører til grejsættene', async () => {
    const skift = vi.fn();
    tegn(
      <InventarSide fane="inventar" skift={skift} aabnItem={vi.fn()} nytItem={vi.fn()} />,
      DESKTOP
    );

    await userEvent.click(await screen.findByRole('button', { name: /Grejsæt/ }));
    expect(skift).toHaveBeenCalledWith('grupper');
  });

  it('siger hvor mange sæt der er, når der er nogen', async () => {
    await db.grupper.bulkAdd([lavGruppe({ navn: 'Sommertur' }), lavGruppe({ navn: 'Vintertur' })]);
    vis();

    const indgang = await screen.findByRole('button', { name: /Grejsæt/ });
    expect(within(indgang).getByText('2 sæt · Sommertur, Vintertur')).toBeInTheDocument();
  });
});

describe('Tilføj grej åbner arket', () => {
  it('opretter ingenting ved at trykke — den åbner kun arket', async () => {
    const nytItem = vi.fn();
    tegn(
      <InventarSide fane="inventar" skift={vi.fn()} aabnItem={vi.fn()} nytItem={nytItem} />,
      DESKTOP
    );

    await userEvent.click(await screen.findByRole('button', { name: '+ Tilføj grej' }));

    // Statussen er den fane, man står på, så det nye grej ikke forsvinder ud
    // af syne i samme øjeblik, det bliver til.
    expect(nytItem).toHaveBeenCalledWith('ejer');
    expect(await db.items.count()).toBe(0);
  });

  it('åbner arket i den fane man står på', async () => {
    const nytItem = vi.fn();
    tegn(
      <InventarSide fane="inventar" skift={vi.fn()} aabnItem={vi.fn()} nytItem={nytItem} />,
      DESKTOP
    );

    await userEvent.click(await screen.findByRole('button', { name: /^Indkøb/ }));
    await userEvent.click(screen.getByRole('button', { name: '+ Tilføj grej' }));
    expect(nytItem).toHaveBeenCalledWith('overvejer');
  });
});

describe('arket opretter først, når man trykker Opret', () => {
  it('åbner med Opret slået fra og en vej ud', async () => {
    const opret = vi.fn();
    tegn(<NytGrejArk opret={opret} annuller={vi.fn()} />, DESKTOP);

    expect(screen.getByRole('button', { name: /Opret grej/ })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Annuller' })).toBeEnabled();
    expect(opret).not.toHaveBeenCalled();
  });

  it('slår Opret til, når navnet er skrevet', async () => {
    const opret = vi.fn();
    tegn(<NytGrejArk opret={opret} annuller={vi.fn()} />, DESKTOP);

    await userEvent.type(screen.getByLabelText('Navn'), 'Sovepose');
    const knap = screen.getByRole('button', { name: 'Opret grej' });
    expect(knap).toBeEnabled();

    await userEvent.click(knap);
    expect(opret).toHaveBeenCalledWith(expect.objectContaining({ navn: 'Sovepose' }));
  });

  it('holder Opret slået fra, når navnet kun er mellemrum', async () => {
    tegn(<NytGrejArk opret={vi.fn()} annuller={vi.fn()} />, DESKTOP);

    await userEvent.type(screen.getByLabelText('Navn'), '   ');
    expect(screen.getByRole('button', { name: /Opret grej/ })).toBeDisabled();
  });
});

describe('vedligehold kan ses på skærmen', () => {
  it('varsler på fanen, når noget er forfaldent', async () => {
    await db.items.add(lavItem({ navn: 'Tarp', vedligehold: FORFALDENT }));
    vis();

    await screen.findByText('Tarp');
    const tal = within(fane(/^Vedligehold/)).getByText('(1)');
    expect(tal).toHaveClass('gear-tab-tal--advarsel');
  });

  it('varsler ikke, når der ikke er noget', async () => {
    await db.items.add(lavItem({ navn: 'Tarp' }));
    vis();

    await screen.findByText('Tarp');
    const tal = within(fane(/^Vedligehold/)).getByText('(0)');
    expect(tal).not.toHaveClass('gear-tab-tal--advarsel');
  });

  it('mærker rækken med Pas på', async () => {
    await db.items.bulkAdd([
      lavItem({ navn: 'Tarp', vedligehold: FORFALDENT }),
      lavItem({ navn: 'Sovepose' })
    ]);
    vis();

    await screen.findByText('Tarp');
    const raekke = (navn: string) => screen.getByText(navn).closest('tr') as HTMLElement;
    expect(within(raekke('Tarp')).getByText('Pas på')).toBeInTheDocument();
    expect(within(raekke('Sovepose')).queryByText('Pas på')).not.toBeInTheDocument();
  });

  it('binder mærket, fanen og Hjem sammen i én linje', async () => {
    await db.items.add(lavItem({ navn: 'Tarp', vedligehold: FORFALDENT }));
    vis();

    await screen.findByText('Tarp');
    expect(screen.getByText(/Vedligehold \(1\) er de samme opmærksomhedspunkter som på Hjem/)).toBeInTheDocument();
  });
});

describe('linjen under overskriften', () => {
  it('siger antal og vægt', async () => {
    await db.items.bulkAdd([
      lavItem({ navn: 'Tarp', vaegt_g: 500 }),
      lavItem({ navn: 'Sovepose', vaegt_g: 1000 })
    ]);
    vis();

    await screen.findByText('Tarp');
    expect(screen.getByText('2 ting · 1,5 kg')).toBeInTheDocument();
  });

  it('regner antallet af stykker med i vægten', async () => {
    await db.items.add(lavItem({ navn: 'Teltpløk', vaegt_g: 500, antal: 4 }));
    vis();

    await screen.findByText('Teltpløk');
    expect(screen.getByText('1 ting · 2 kg')).toBeInTheDocument();
  });
});

// ─────────────────────────────────────────────
// Grej · mobil
//
// Efter `docs/design/mobile/03-grej.html`: titel, antal og vægt og "+ Tilføj"
// på én linje, Grejsæt-kortet, søgefeltet, og hver ting som sit eget kort med
// "Pas på" på det grej, der venter på vedligehold. "+ Tilføj" er skærmens ene
// fyldte accent — derfor ingen FAB.
// ─────────────────────────────────────────────

const visMobil = (aabnItem = vi.fn()) => tegn(
  <InventarSide fane="inventar" skift={vi.fn()} aabnItem={aabnItem} nytItem={vi.fn()} />,
  MOBIL
);

const mobilKort = (navn: string) => screen.getByText(navn).closest('.grej-mobil-kort') as HTMLElement;

describe('Grej på telefonen', () => {
  it('har titel, antal og vægt og + Tilføj i headeren — og ingen FAB', async () => {
    await db.items.bulkAdd([
      lavItem({ navn: 'Tarp', vaegt_g: 500 }),
      lavItem({ navn: 'Sovepose', vaegt_g: 1000 })
    ]);
    visMobil();

    await screen.findByText('Tarp');
    const hoved = document.querySelector('.grej-mobil-hoved') as HTMLElement;
    expect(within(hoved).getByRole('heading', { name: 'Grej' })).toBeInTheDocument();
    expect(within(hoved).getByText('2 ting · 1,5 kg')).toBeInTheDocument();
    expect(within(hoved).getByRole('button', { name: '+ Tilføj' })).toHaveClass('ui-button--primaer');

    expect(fyldteAccenter()).toHaveLength(1);
    expect(screen.queryByRole('button', { name: 'Tilføj' })).not.toBeInTheDocument();
  });

  it('har Grejsæt-kortet og søgefeltet', async () => {
    await db.items.add(lavItem({ navn: 'Tarp' }));
    visMobil();

    await screen.findByText('Tarp');
    expect(screen.getByRole('button', { name: /^Grejsæt/ })).toHaveClass('gear-sets-card');
    expect(screen.getByPlaceholderText('Søg grej eller tags…')).toBeInTheDocument();
  });

  it('mærker kortet med Pas på, når noget er forfaldent', async () => {
    await db.items.bulkAdd([
      lavItem({ navn: 'Tarp', vedligehold: FORFALDENT }),
      lavItem({ navn: 'Sovepose' })
    ]);
    visMobil();

    await screen.findByText('Tarp');
    expect(within(mobilKort('Tarp')).getByText('Pas på')).toBeInTheDocument();
    expect(within(mobilKort('Sovepose')).queryByText('Pas på')).not.toBeInTheDocument();
  });

  it('viser vægt og pris på kortet', async () => {
    await db.items.add(lavItem({ navn: 'Sovepose', vaegt_g: 1500, pris_kr: 1000 }));
    visMobil();

    await screen.findByText('Sovepose');
    expect(within(mobilKort('Sovepose')).getByText(/1\.500 g · 1\.000 kr/)).toBeInTheDocument();
  });

  it('åbner grejet ved tryk og med Enter', async () => {
    const aabnItem = vi.fn();
    const id = await db.items.add(lavItem({ navn: 'Tarp' }));
    visMobil(aabnItem);

    await screen.findByText('Tarp');
    await userEvent.click(mobilKort('Tarp'));
    expect(aabnItem).toHaveBeenCalledWith(id);

    mobilKort('Tarp').focus();
    await userEvent.keyboard('{Enter}');
    expect(aabnItem).toHaveBeenCalledTimes(2);
  });
});
