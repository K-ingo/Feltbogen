// @vitest-environment jsdom
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { screen, within } from '@testing-library/react';

vi.mock('./pb', () => import('./test/pbMock'));

import { db } from './db';
import DashboardSide from './DashboardSide';
import { lavItem, lavTur, lavBillede } from './test/data';
import { tegn, DESKTOP } from './test/skaerm';

// ─────────────────────────────────────────────
// Hjem · desktop · CTA-hierarkiet
//
// Fra handoff'en "Ejer · Hjem · Desktop" (16. sep 2026). Den hårde regel er
// **højst én fyldt accent-knap i det første skærmbillede**, og den hører til
// på Næste Eventyr. Testene her er acceptkriterierne skrevet ud.
//
// En fyldt knap kendes på klassen `ui-button--primaer`; outline er
// `--sekundaer` og ghost er `--tekst`.
// ─────────────────────────────────────────────

// `lavTur` har faste datoer i sommeren 2026, og `naesteTur` filtrerer på, at
// turen ikke er overstået. Begge datoer skal derfor sættes frem i tiden.
const omDage = (n: number) => {
  const d = new Date();
  d.setDate(d.getDate() + n);
  return d.toISOString().slice(0, 10);
};
const kommende = { startdato: omDage(7), slutdato: omDage(9) };

beforeEach(async () => {
  await Promise.all([
    db.items.clear(), db.ture.clear(), db.grupper.clear(),
    db.steder.clear(), db.billeder.clear(), db.indstillinger.clear()
  ]);
  vi.spyOn(console, 'error').mockImplementation(() => {});
});

const vis = () => tegn(
  <DashboardSide
    fane="dashboard" skift={vi.fn()} aabnItem={vi.fn()} aabnTur={vi.fn()}
    aabnAar={vi.fn()} nytItem={vi.fn()} nyTur={vi.fn()} foersteTur={vi.fn()}
    tilLogin={vi.fn()}
  />,
  DESKTOP
);

const fyldte = () => Array.from(document.querySelectorAll('.ui-button--primaer'));

// En tur om en uge med grej på, men ikke pakket færdig.
const turMedGrej = async () => {
  await db.items.add(lavItem({ uid: 'u-telt', navn: 'Telt', vaegt_g: 2000 }));
  await db.ture.add(lavTur({
    navn: 'Møn', status: 'klar', ...kommende,
    loese_item_ids: ['u-telt'], pakkede_item_uids: []
  }));
};

describe('kun én fyldt primary above the fold', () => {
  it('med en tur i gang er den fyldte knap Næste Eventyrs', async () => {
    await turMedGrej();
    vis();

    expect(await screen.findByRole('button', { name: 'Fortsæt pakning' })).toBeInTheDocument();
    expect(fyldte()).toHaveLength(1);
    expect(fyldte()[0]).toHaveTextContent('Fortsæt pakning');
  });

  it('uden nogen tur er den fyldte knap den tomme tilstands', async () => {
    await db.items.add(lavItem({ navn: 'Økse' }));
    vis();

    expect(await screen.findByText(/Hvor går din næste tur hen/)).toBeInTheDocument();
    expect(fyldte()).toHaveLength(1);
  });

  // Motorens forslag kommer, når den kommende tur er tom og en tidligere tur
  // ligner. "Kopiér grejet" må ikke være den anden fyldte knap.
  it('holder reglen, også når motoren har et forslag', async () => {
    await db.items.add(lavItem({ uid: 'u-telt', navn: 'Telt', vaegt_g: 2000 }));
    await db.ture.add(lavTur({
      uid: 'tur-tom', navn: 'Ny tur', status: 'klar', ...kommende, loese_item_ids: []
    }));
    await db.ture.add(lavTur({
      uid: 'tur-gammel', navn: 'Sidste sommer', status: 'afsluttet',
      startdato: omDage(-60), slutdato: omDage(-58), loese_item_ids: ['u-telt']
    }));

    vis();

    // Forslaget skal faktisk være der — ellers påstår testen noget, den ikke
    // måler.
    const kopier = await screen.findByRole('button', { name: 'Kopiér grejet' });
    expect(kopier).toHaveClass('ui-button--sekundaer');
    expect(kopier).not.toHaveClass('ui-button--primaer');

    expect(fyldte()).toHaveLength(1);
    expect(fyldte()[0]).toHaveTextContent('Vælg grej');
  });
});

describe('headerens knapper', () => {
  it('"+ Ny tur" er outline, ikke fyldt', async () => {
    await turMedGrej();
    vis();

    const knap = await screen.findByRole('button', { name: '+ Ny tur' });
    expect(knap).toHaveClass('ui-button--sekundaer');
    expect(knap).not.toHaveClass('ui-button--primaer');
  });

  it('"+ Tilføj grej" er ghost', async () => {
    await turMedGrej();
    vis();

    expect(await screen.findByRole('button', { name: '+ Tilføj grej' }))
      .toHaveClass('ui-button--tekst');
  });
});

// "Pak færdig" beder om at få gjort noget færdigt, man ikke er begyndt på.
describe('CTA\'en følger pakningen', () => {
  it('siger "Vælg grej", når intet grej er valgt', async () => {
    await db.ture.add(lavTur({ navn: 'Tom', status: 'klar', ...kommende, loese_item_ids: [] }));
    vis();

    expect(await screen.findByRole('button', { name: 'Vælg grej' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Pak færdig' })).not.toBeInTheDocument();
  });

  it('siger "Fortsæt pakning", når pakningen er i gang', async () => {
    await turMedGrej();
    vis();

    expect(await screen.findByRole('button', { name: 'Fortsæt pakning' })).toBeInTheDocument();
  });

  // Er alt pakket, er der ikke en handling at haste med.
  it('bliver stille, når turen er pakket færdig', async () => {
    await db.items.add(lavItem({ uid: 'u-telt', navn: 'Telt' }));
    await db.ture.add(lavTur({
      navn: 'Klar', status: 'klar', ...kommende,
      loese_item_ids: ['u-telt'], pakkede_item_uids: ['u-telt']
    }));

    vis();

    const knap = await screen.findByRole('button', { name: 'Se turen' });
    expect(knap).toHaveClass('ui-button--sekundaer');
    expect(fyldte()).toHaveLength(0);
  });
});

describe('tallene står ikke i det første skærmbillede', () => {
  it('ligger foldet under "Se mere"', async () => {
    await turMedGrej();
    vis();

    const toggle = await screen.findByText('Se mere (Stats & Sidst tilføjet)');
    const fold = toggle.closest('details')!;

    expect(fold).not.toHaveAttribute('open');
    expect(within(fold).getByText('Dit friluftsliv')).toBeInTheDocument();
    expect(within(fold).getByText('Sidst tilføjet')).toBeInTheDocument();
    expect(within(fold).getByText('Dit grej')).toBeInTheDocument();
  });

  // Eventyret først: minderne er ikke tal, og de bliver stående.
  //
  // Et minde kræver en tur, der er *begyndt* — et billede på en tur, man har
  // planlagt, er ikke et minde endnu. Se senesteMinder i billeder.ts.
  it('men minderne bliver stående', async () => {
    await turMedGrej();
    await db.ture.add(lavTur({
      uid: 'tur-gammel', navn: 'Sidste sommer',
      status: 'afsluttet', startdato: omDage(-60), slutdato: omDage(-58)
    }));
    await db.billeder.add(lavBillede({
      tur_uid: 'tur-gammel', url: 'https://test.pb/x.jpg', tid: '2026-07-01T10:00:00Z'
    }));

    vis();

    const minder = await screen.findByText('Seneste minder');
    expect(minder.closest('details')).toBeNull();
  });
});

// Kriterium 7: footeren må ikke være falsk grøn. Med alt sendt op er "Alt er
// sendt op" den sande besked — og det er den, der skal stå.
describe('sync-footeren', () => {
  it('siger "Alt er sendt op", når alt er sendt op', async () => {
    await turMedGrej();
    vis();

    expect(await screen.findByText('Alt er sendt op')).toBeInTheDocument();
  });
});
