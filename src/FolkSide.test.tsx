// @vitest-environment jsdom
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

vi.mock('./pb', () => import('./test/pbMock'));

import { db } from './db';
import FolkSide from './FolkSide';
import { lavPerson, lavTur } from './test/data';
import { tegn, DESKTOP, MOBIL } from './test/skaerm';

// ─────────────────────────────────────────────
// Folk · desktop
//
// Fra handoff'en "Ejer Folk · desktop" og den visuelle reference i
// `docs/design/desktop/07-folk.html`. Testene her er acceptkriterierne
// skrevet ud.
//
// Skærmen er et kartotek, ikke en arbejdsflade. Referencen tegner ikke én
// eneste fyldt knap: feltet står med en slået fra "+ Tilføj" og en
// hjælpetekst under sig. Den fyldte accent findes først, når der er et navn
// at tilføje — og der er kun den ene.
// ─────────────────────────────────────────────

beforeEach(async () => {
  await Promise.all([db.personer.clear(), db.ture.clear(), db.items.clear()]);
  vi.spyOn(console, 'error').mockImplementation(() => {});
});

const vis = () => tegn(<FolkSide fane="folk" skift={vi.fn()} />, DESKTOP);

// Alt på skærmen, der er en fyldt accent-flade: knapper med den primære
// variant, og alt andet, der har malet accenten på som baggrund. Den anden
// halvdel er der, fordi et segment kan bryde reglen uden at være en `Knap`.
const fyldteAccenter = () => Array.from(document.querySelectorAll<HTMLElement>('*'))
  .filter((el) => el.classList.contains('ui-button--primaer') || el.style.background === 'var(--accent)');

// Feltet øverst, og ikke det "Navn" der står inde i en åben persondetalje.
// Pladsholderen er kun på det ene af dem.
const navnefelt = () => screen.getByPlaceholderText('Navn');
const tilfoej = () => screen.getByRole('button', { name: '+ Tilføj' });

describe('titel og undertitel', () => {
  it('siger Folk og hvor mange personer der er', async () => {
    await db.personer.bulkAdd([lavPerson({ navn: 'Emil' }), lavPerson({ navn: 'Jakob' })]);
    vis();

    expect(await screen.findByRole('heading', { level: 1, name: 'Folk' })).toBeInTheDocument();
    expect(await screen.findByText('2 personer')).toBeInTheDocument();
  });

  it('bøjer i ental ved én person', async () => {
    await db.personer.add(lavPerson({ navn: 'Emil' }));
    vis();

    expect(await screen.findByText('1 person')).toBeInTheDocument();
  });

  it('siger 0 personer på den tomme skærm', async () => {
    vis();

    expect(await screen.findByText('0 personer')).toBeInTheDocument();
  });
});

describe('introkortet', () => {
  it('står som et roligt kort med ikon og forklaring', async () => {
    vis();

    const kort = document.querySelector('.people-intro') as HTMLElement;
    expect(kort).toBeInTheDocument();
    expect(within(kort).getByRole('heading', { name: 'Dit turhold' })).toBeInTheDocument();
    expect(kort.querySelector('.people-intro-icon')).toBeInTheDocument();
    // Sætningen om fritekst på turene hører til her og ikke i en fodnote
    // nederst på siden.
    expect(within(kort).getByText(/Navne kan også skrives direkte på en tur/)).toBeInTheDocument();
  });

  it('er ikke en fyldt accent', async () => {
    vis();

    await screen.findByText('0 personer');
    expect(fyldteAccenter()).toHaveLength(0);
  });
});

describe('kun én fyldt accent', () => {
  it('er der ingen af på den tomme skærm', async () => {
    vis();

    await screen.findByText('0 personer');
    expect(tilfoej()).toBeDisabled();
    expect(tilfoej()).not.toHaveClass('ui-button--primaer');
    expect(fyldteAccenter()).toHaveLength(0);
  });

  it('er + Tilføj, så snart der står et gyldigt navn', async () => {
    vis();

    await screen.findByText('0 personer');
    await userEvent.type(navnefelt(), 'Emil');

    expect(tilfoej()).toBeEnabled();
    expect(fyldteAccenter()).toHaveLength(1);
    expect(fyldteAccenter()[0]).toHaveTextContent('+ Tilføj');
  });

  it('er den stadig, når der er personer på listen', async () => {
    await db.personer.add(lavPerson({ navn: 'Emil' }));
    vis();

    await screen.findByText('Emil');
    await userEvent.type(navnefelt(), 'Jakob');

    expect(fyldteAccenter()).toHaveLength(1);
    expect(fyldteAccenter()[0]).toHaveTextContent('+ Tilføj');
  });

  it('er den stadig, når en persons detalje er åben', async () => {
    await db.personer.add(lavPerson({ navn: 'Emil', standard_overnatning: 'telt' }));
    vis();

    await userEvent.click(await screen.findByRole('button', { name: /Emil/ }));
    // "Sover typisk i" er en oplysning om personen, ikke skærmens handling.
    // Det valgte segment skal derfor være tonet og ikke fyldt.
    expect(await screen.findByText('Sover typisk i')).toBeInTheDocument();
    await userEvent.type(navnefelt(), 'Jakob');

    expect(fyldteAccenter()).toHaveLength(1);
    expect(fyldteAccenter()[0]).toHaveTextContent('+ Tilføj');
  });
});

describe('navnefeltet', () => {
  it('er slået fra med hjælpetekst, indtil der står et navn', async () => {
    vis();

    await screen.findByText('0 personer');
    expect(tilfoej()).toBeDisabled();
    expect(screen.getByText('Skriv et navn for at tilføje')).toBeInTheDocument();
  });

  it('tæller mellemrum som ingenting', async () => {
    vis();

    await screen.findByText('0 personer');
    await userEvent.type(navnefelt(), '   ');

    expect(tilfoej()).toBeDisabled();
    expect(screen.getByText('Skriv et navn for at tilføje')).toBeInTheDocument();
  });

  it('opretter personen og tømmer feltet', async () => {
    vis();

    await screen.findByText('0 personer');
    await userEvent.type(navnefelt(), 'Emil');
    await userEvent.click(tilfoej());

    expect(await screen.findByText('1 person')).toBeInTheDocument();
    expect(await db.personer.count()).toBe(1);
    expect((await db.personer.toArray())[0].navn).toBe('Emil');
    expect(navnefelt()).toHaveValue('');
  });

  it('er mærket for skærmlæseren, selv om etiketten ikke ses', async () => {
    vis();

    await screen.findByText('0 personer');
    // Pladsholderen forsvinder, så snart man skriver i feltet, og er derfor
    // ikke en etiket.
    expect(navnefelt()).toHaveAccessibleName('Navn');
  });

  it('skifter hjælpetekst, når navnet er gyldigt', async () => {
    vis();

    await screen.findByText('0 personer');
    await userEvent.type(navnefelt(), 'Emil');

    expect(screen.queryByText('Skriv et navn for at tilføje')).not.toBeInTheDocument();
    expect(screen.getByText('Tryk Enter eller + Tilføj')).toBeInTheDocument();
  });

  it('opretter også på Enter', async () => {
    vis();

    await screen.findByText('0 personer');
    await userEvent.type(navnefelt(), 'Emil{Enter}');

    expect(await screen.findByText('1 person')).toBeInTheDocument();
  });
});

describe('foreslået fra dine ture', () => {
  it('er skjult, når turene ikke har ukendte navne', async () => {
    vis();

    await screen.findByText('0 personer');
    expect(screen.queryByText('Foreslået fra dine ture')).not.toBeInTheDocument();
  });

  it('tilbyder navne fra turene som outline-chips', async () => {
    await db.ture.add(lavTur({
      navn: 'Rold Skov',
      deltagere: [{
        id: 'd1', navn: 'Mikkel', overnatning: null,
        personligt_gear_ids: [], baerer_delt_ids: [], person_uid: ''
      }]
    }));
    vis();

    expect(await screen.findByText('Foreslået fra dine ture')).toBeInTheDocument();
    const chip = screen.getByRole('button', { name: '+ Mikkel' });
    expect(chip).toHaveClass('people-chip');
    // Outline og ikke fyldt: det er en genvej, ikke skærmens handling.
    expect(fyldteAccenter()).toHaveLength(0);
  });

  it('opretter personen, når man trykker på chippen', async () => {
    await db.ture.add(lavTur({
      deltagere: [{
        id: 'd1', navn: 'Mikkel', overnatning: null,
        personligt_gear_ids: [], baerer_delt_ids: [], person_uid: ''
      }]
    }));
    vis();

    await userEvent.click(await screen.findByRole('button', { name: '+ Mikkel' }));

    expect(await screen.findByText('1 person')).toBeInTheDocument();
    expect((await db.personer.toArray())[0].navn).toBe('Mikkel');
    // Navnet er ikke længere ukendt, så forslaget forsvinder af sig selv.
    expect(screen.queryByRole('button', { name: '+ Mikkel' })).not.toBeInTheDocument();
  });
});

describe('den tomme skærm', () => {
  it('siger hvad listen er til, uden at kræve noget', async () => {
    vis();

    expect(await screen.findByText(/Ingen endnu/)).toBeInTheDocument();
    expect(fyldteAccenter()).toHaveLength(0);
  });
});

describe('listen', () => {
  it('står roligt med navn og antal ture sammen', async () => {
    const emil = lavPerson({ navn: 'Emil' });
    await db.personer.add(emil);
    await db.ture.add(lavTur({
      deltagere: [{
        id: 'd1', navn: 'Emil', overnatning: null,
        personligt_gear_ids: [], baerer_delt_ids: [], person_uid: emil.uid
      }]
    }));
    vis();

    const raekke = await screen.findByRole('button', { name: /Emil/ });
    expect(within(raekke).getByText('1 tur sammen')).toBeInTheDocument();
    expect(raekke).not.toHaveClass('ui-button--primaer');
  });

  it('sorterer efter hvem man er mest afsted med', async () => {
    const emil = lavPerson({ navn: 'Emil' });
    const jakob = lavPerson({ navn: 'Jakob' });
    await db.personer.bulkAdd([emil, jakob]);
    await db.ture.add(lavTur({
      deltagere: [{
        id: 'd1', navn: 'Jakob', overnatning: null,
        personligt_gear_ids: [], baerer_delt_ids: [], person_uid: jakob.uid
      }]
    }));
    vis();

    await screen.findByText('2 personer');
    const navne = Array.from(document.querySelectorAll('.person-card'))
      .map((k) => k.textContent ?? '');
    expect(navne[0]).toContain('Jakob');
    expect(navne[1]).toContain('Emil');
  });
});

describe('Folk er den aktive fane', () => {
  it('er markeret i sidebaren', async () => {
    vis();

    await screen.findByText('0 personer');
    const sidebar = document.querySelector('nav.sidebar') as HTMLElement;
    expect(within(sidebar).getByRole('button', { name: 'Folk' })).toHaveAttribute('aria-current', 'page');
  });
});

// ─────────────────────────────────────────────
// Folk · telefon
//
// Efter `docs/design/mobile/04-folk.html`: "Folk" og antal i indholdet (ingen
// topbar), turhold-kortet, navnefeltet med en stille "+ Tilføj", og
// "Foreslået fra dine ture" som outline-chips. Ingen FAB, og højst én fyldt
// accent — og ingen, før der står et navn.
// ─────────────────────────────────────────────

const visMobil = () => tegn(<FolkSide fane="folk" skift={vi.fn()} />, MOBIL);

describe('Folk på telefonen', () => {
  it('har titel og antal i sin egen header og ingen topbar', async () => {
    await db.personer.bulkAdd([lavPerson({ navn: 'Emil' }), lavPerson({ navn: 'Jakob' })]);
    visMobil();

    await screen.findByText('2 personer');
    const hoved = document.querySelector('.folk-mobil-hoved') as HTMLElement;
    expect(within(hoved).getByRole('heading', { level: 1, name: 'Folk' })).toBeInTheDocument();
    expect(within(hoved).getByText('2 personer')).toBeInTheDocument();
    expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1);
  });

  it('har turhold-kortet', async () => {
    visMobil();

    await screen.findByText('0 personer');
    const kort = document.querySelector('.people-intro') as HTMLElement;
    expect(within(kort).getByRole('heading', { name: 'Dit turhold' })).toBeInTheDocument();
  });

  it('har ingen fyldt accent og ingen FAB på den tomme skærm', async () => {
    visMobil();

    await screen.findByText('0 personer');
    expect(tilfoej()).toBeDisabled();
    expect(tilfoej()).toHaveClass('ui-button--sekundaer');
    expect(screen.getByText('Skriv et navn for at tilføje')).toBeInTheDocument();
    expect(fyldteAccenter()).toHaveLength(0);
    expect(screen.queryByRole('button', { name: 'Tilføj' })).not.toBeInTheDocument();
  });

  it('tænder + Tilføj som den eneste fyldte, når der står et navn', async () => {
    visMobil();

    await userEvent.type(navnefelt(), 'Mikkel');
    expect(tilfoej()).toBeEnabled();
    expect(fyldteAccenter()).toEqual([tilfoej()]);
  });

  it('viser forslag fra turene som outline-chips, der opretter personen', async () => {
    await db.ture.add(lavTur({
      deltagere: [{
        id: 'd1', navn: 'Jakob', overnatning: null,
        personligt_gear_ids: [], baerer_delt_ids: [], person_uid: ''
      }]
    }));
    visMobil();

    expect(await screen.findByText('Foreslået fra dine ture')).toBeInTheDocument();
    const chip = screen.getByRole('button', { name: '+ Jakob' });
    expect(chip).toHaveClass('people-chip');
    expect(fyldteAccenter()).toHaveLength(0);

    await userEvent.click(chip);
    expect(await screen.findByText('1 person')).toBeInTheDocument();
  });

  it('beholder den tomme tekst uden at kræve noget', async () => {
    visMobil();

    expect(await screen.findByText(/Ingen endnu/)).toBeInTheDocument();
  });
});
