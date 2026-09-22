// @vitest-environment jsdom
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

vi.mock('./pb', () => import('./test/pbMock'));

import { db } from './db';
import { NyTurArk, NytGrejArk } from './Ark';
import { tegn, DESKTOP } from './test/skaerm';

// ─────────────────────────────────────────────
// Opret-arkene
//
// Fra handoff'en "Sheet Ny tur · desktop" og
// docs/design/desktop/11-sheet-ny-tur.html. Den hårde regel:
//
//   "Production havde create-before-confirm — det er forbudt."
//
// Arket rører ikke basen. Det samler felter ind og rækker dem videre, og
// først kalderen skriver. Testene her holder den grænse — går den i stykker,
// er vi tilbage ved tomme ture, der lander på serveren, fordi nogen lukkede
// fanen.
// ─────────────────────────────────────────────

beforeEach(async () => {
  await Promise.all([db.ture.clear(), db.items.clear()]);
});

const turArk = (opret = vi.fn(), annuller = vi.fn()) => {
  tegn(<NyTurArk idag="2026-09-19" opret={opret} annuller={annuller} />, DESKTOP);
  return { opret, annuller };
};

const grejArk = (opret = vi.fn(), annuller = vi.fn()) => {
  tegn(<NytGrejArk opret={opret} annuller={annuller} />, DESKTOP);
  return { opret, annuller };
};

const opretKnap = () => screen.getByRole('button', { name: /Opret tur/ });

describe('der oprettes ingenting, før man trykker Opret', () => {
  it('skriver ikke i basen, når arket åbner', async () => {
    turArk();

    expect(await screen.findByText('Ny tur')).toBeInTheDocument();
    expect(await db.ture.count()).toBe(0);
  });

  it('skriver ikke i basen, mens man taster', async () => {
    turArk();

    await userEvent.type(screen.getByLabelText('Titel'), 'Fovslet Skov');
    expect(await db.ture.count()).toBe(0);
  });

  it('skriver ikke i basen, når man annullerer', async () => {
    const { annuller } = turArk();

    await userEvent.type(screen.getByLabelText('Titel'), 'Fovslet Skov');
    await userEvent.click(screen.getByRole('button', { name: 'Annuller' }));

    expect(annuller).toHaveBeenCalled();
    expect(await db.ture.count()).toBe(0);
  });

  it('gælder også grej-arket', async () => {
    grejArk();

    await userEvent.type(screen.getByLabelText('Navn'), 'Telt');
    expect(await db.items.count()).toBe(0);
  });
});

describe('Opret er slået fra, indtil navnet er gyldigt', () => {
  it('er slået fra på et tomt ark', async () => {
    turArk();
    expect(await screen.findByRole('button', { name: /Opret tur/ })).toBeDisabled();
  });

  it('bliver aktiv, når der står noget i titlen', async () => {
    turArk();

    await userEvent.type(screen.getByLabelText('Titel'), 'Fovslet');
    expect(opretKnap()).toBeEnabled();
  });

  it('lader sig ikke narre af mellemrum', async () => {
    turArk();

    await userEvent.type(screen.getByLabelText('Titel'), '   ');
    expect(opretKnap()).toBeDisabled();
  });

  it('bliver slået fra igen, hvis man sletter titlen', async () => {
    turArk();

    const titel = screen.getByLabelText('Titel');
    await userEvent.type(titel, 'Fovslet');
    await userEvent.clear(titel);

    expect(opretKnap()).toBeDisabled();
  });

  it('siger hvorfor knappen er grå', async () => {
    turArk();
    expect(await screen.findByRole('button', { name: /skriv en titel for at oprette/ })).toBeInTheDocument();
  });

  it('kræver kun navnet på grej — vægt og pris må være tomme', async () => {
    grejArk();

    expect(screen.getByRole('button', { name: /Opret grej/ })).toBeDisabled();
    await userEvent.type(screen.getByLabelText('Navn'), 'Telt');
    expect(screen.getByRole('button', { name: /Opret grej/ })).toBeEnabled();
  });
});

describe('felterne rækkes videre, som de blev skrevet', () => {
  it('giver titlen og datoerne med', async () => {
    const { opret } = turArk();

    await userEvent.type(screen.getByLabelText('Titel'), 'Fovslet Skov');
    await userEvent.click(opretKnap());

    expect(opret).toHaveBeenCalledWith(expect.objectContaining({
      titel: 'Fovslet Skov', fra: '2026-09-19', til: '2026-09-19'
    }));
  });

  it('giver deltagerne med, som man skrev dem', async () => {
    const { opret } = turArk();

    await userEvent.type(screen.getByLabelText('Titel'), 'Fovslet');
    await userEvent.type(screen.getByLabelText(/Deltagere/), 'Zindy, Noor');
    await userEvent.click(opretKnap());

    expect(opret).toHaveBeenCalledWith(expect.objectContaining({ deltagere: 'Zindy, Noor' }));
  });

  it('åbner med stedet udfyldt, når man kom fra et sted', async () => {
    tegn(<NyTurArk idag="2026-09-19" sted="Fovslet Skov" opret={vi.fn()} annuller={vi.fn()} />, DESKTOP);
    expect(await screen.findByLabelText('Sted')).toHaveValue('Fovslet Skov');
  });
});

describe('vejene ud', () => {
  it('lukker på Escape', async () => {
    const { annuller } = turArk();

    await screen.findByText('Ny tur');
    await userEvent.keyboard('{Escape}');
    expect(annuller).toHaveBeenCalled();
  });

  it('lukker på et klik ved siden af arket', async () => {
    const { annuller } = turArk();

    await userEvent.click(document.querySelector('.ark-baggrund') as HTMLElement);
    expect(annuller).toHaveBeenCalled();
  });

  it('lukker ikke på et klik inde i arket', async () => {
    const { annuller } = turArk();

    await userEvent.click(await screen.findByLabelText('Titel'));
    expect(annuller).not.toHaveBeenCalled();
  });
});

// ─────────────────────────────────────────────
// Designet: docs/design/desktop/11-sheet-ny-tur.html og 12-sheet-tilfoej-grej.html
// ─────────────────────────────────────────────

// Knapper og alt andet, man kan trykke på, der har malet accenten på.
const fyldteAccenter = () => Array.from(document.querySelectorAll<HTMLElement>('button, a, [role="button"]'))
  .filter((el) => el.classList.contains('ui-button--primaer') || el.style.background === 'var(--accent)');

describe('kun én fyldt accent', () => {
  it('er Opret tur på Ny tur', async () => {
    turArk();

    await userEvent.type(await screen.findByLabelText('Titel'), 'Fovslet');
    expect(fyldteAccenter()).toHaveLength(1);
    expect(fyldteAccenter()[0]).toHaveTextContent('Opret tur');
  });

  it('er Opret grej på Tilføj grej — statusvælgeren er stille', async () => {
    grejArk();

    await userEvent.type(await screen.findByLabelText('Navn'), 'Telt');
    expect(fyldteAccenter()).toHaveLength(1);
    expect(fyldteAccenter()[0]).toHaveTextContent('Opret grej');
    // Det valgte er stadig til at se — bare ikke som en fyldt flade.
    expect(screen.getByRole('button', { name: 'Ejer' })).toHaveAttribute('aria-pressed', 'true');
  });

  it('har creme og ikke hvid tekst på den fyldte knap', async () => {
    turArk();
    expect(await screen.findByRole('button', { name: /Opret tur/ })).toHaveStyle({ color: 'var(--accent-tekst)' });
  });
});

describe('arket siger, hvad der mangler', () => {
  it('skriver under knapperne, hvorfor Opret er slået fra', async () => {
    turArk();
    expect(await screen.findByText('Skriv en titel for at oprette.')).toBeInTheDocument();
  });

  it('fjerner linjen, når titlen er skrevet', async () => {
    turArk();

    await userEvent.type(await screen.findByLabelText('Titel'), 'Fovslet');
    expect(screen.queryByText('Skriv en titel for at oprette.')).not.toBeInTheDocument();
  });

  it('siger på begge ark, at der først oprettes ved Opret', async () => {
    turArk();
    expect(await screen.findByText(/ingen kladde, før du trykker Opret/)).toBeInTheDocument();
  });

  it('siger på grej-arket, at der først gemmes ved Opret', async () => {
    grejArk();
    expect(await screen.findByText(/Gemmes først, når du trykker Opret/)).toBeInTheDocument();
  });
});

describe('grej-arkets felter', () => {
  it('rækker vægt, pris og antal videre med navnet', async () => {
    const { opret } = grejArk();

    await userEvent.type(await screen.findByLabelText('Navn'), 'Telt');
    await userEvent.type(screen.getByLabelText('Vægt'), '1200');
    await userEvent.type(screen.getByLabelText('Pris'), '1500');
    await userEvent.click(screen.getByRole('button', { name: 'Overvejer' }));
    await userEvent.click(screen.getByRole('button', { name: /Opret grej/ }));

    expect(opret).toHaveBeenCalledWith(expect.objectContaining({
      navn: 'Telt', vaegt: '1200', pris: '1500', antal: '1', status: 'overvejer'
    }));
  });

  it('er det smalle ark, som referencen tegner det', async () => {
    grejArk();
    expect(await screen.findByRole('dialog')).toHaveClass('ark--smal');
  });
});

describe('tilgængelighed', () => {
  it('er en dialog med en titel', async () => {
    turArk();

    const dialog = await screen.findByRole('dialog');
    expect(dialog).toHaveAttribute('aria-modal', 'true');
    expect(dialog).toHaveAccessibleName('Ny tur');
  });

  it('sætter markøren i det første felt', async () => {
    turArk();

    // Uden det bliver fokus stående bag laget, og den der bruger tastatur
    // skal tabbe sig gennem hele skærmen for at nå et felt, der er synligt.
    expect(await screen.findByLabelText('Titel')).toHaveFocus();
  });
});
