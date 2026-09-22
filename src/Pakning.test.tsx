// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { screen, waitFor, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

vi.mock('./pb', () => import('./test/pbMock'));

import { db } from './db';
import type { Item, Tur } from './db';
import TurDetalje from './TurDetalje';
import { lavItem, lavGruppe, lavTur } from './test/data';
import { tegn, DESKTOP, MOBIL } from './test/skaerm';

// ─────────────────────────────────────────────
// Pakning · desktop
//
// Fra handoff'en "Ejer Pakning · desktop" (16. sep 2026) og
// docs/design/desktop/04-pakning.html.
//
// Acceptkriteriet der bærer resten: **én Pakning-flade**. Skærmen havde to
// faner — "Pakning", hvor grejet blev valgt, og "Pakkeliste", hvor det blev
// krydset af. Det er den samme liste to steder: man stod med tasken på den
// ene fane, mens tallet, man pakkede efter, stod på den anden.
//
// Dertil de to, der gælder hele designsystemet: højst én fyldt accent-knap i
// skærmbilledet, og et fremdriftstal der er ærligt — 100 % først når alt er
// i tasken.
// ─────────────────────────────────────────────

beforeEach(async () => {
  await Promise.all([db.ture.clear(), db.items.clear(), db.grupper.clear(), db.billeder.clear()]);
  vi.spyOn(console, 'error').mockImplementation(() => {});
});

// Tre stykker grej på en tur, 4 kg i alt. `pakket` er antallet, der er
// krydset af — talt fra begyndelsen af listen.
//
// Teltet er delt. Det bæres af én, men vises fair fordelt over deltagerne, og
// det er dét, der gør vægten pr. person til et andet tal end totalen.
const GREJ = [
  { uid: 'u-telt', navn: 'Telt', vaegt_g: 2000, delt: true },
  { uid: 'u-sovepose', navn: 'Sovepose', vaegt_g: 1400 },
  { uid: 'u-trangia', navn: 'Trangia', vaegt_g: 600 }
];

const visPakning = async (
  { pakket = 0, grej = GREJ, bredde = DESKTOP, ...felter }: Partial<Tur> & { pakket?: number; grej?: Partial<Item>[]; bredde?: number } = {}
) => {
  await db.items.bulkAdd(grej.map((g) => lavItem(g)));
  const uids = grej.map((g) => g.uid as string);
  const id = await db.ture.add(lavTur({
    navn: 'Fovslet Skov',
    status: 'klar',
    loese_item_ids: uids,
    pakkede_item_uids: uids.slice(0, pakket),
    ...felter
  }));

  tegn(<TurDetalje turId={id as number} tilbage={vi.fn()} />, bredde);

  // Fanerækken tegnes først, når turen er hentet.
  await userEvent.click(await screen.findByRole('tab', { name: /^Pakning/ }));
  return id as number;
};

const faner = () => screen.getAllByRole('tab').map((t) => t.textContent ?? '');

// Vægtlinjen i fremdriftskortet. Teksten er sat sammen af flere noder, så den
// læses af elementet frem for med en tekstforespørgsel.
const vaegtlinjen = () => document.querySelector('.packing-progress-vaegt')?.textContent;

// Fyldte accent-flader i hele dokumentet: de primære knapper og et valgt
// segmentfelt. Skærmen tegner kun det første skærmbillede i jsdom — der er
// ingen rulning, så alt der findes, tæller.
const fyldteAccenter = (): HTMLElement[] => [
  ...Array.from(document.querySelectorAll<HTMLElement>('.ui-button--primaer')),
  ...Array.from(document.querySelectorAll<HTMLElement>('.ui-segment'))
    .filter((el) => el.style.background === 'var(--accent)')
];

describe('én Pakning-flade', () => {
  it('har ingen Pakkeliste-fane ved siden af Pakning', async () => {
    await visPakning();

    expect(faner().some((f) => f.startsWith('Pakning'))).toBe(true);
    expect(faner().some((f) => f.startsWith('Pakkeliste'))).toBe(false);
  });

  it('har både valget af grej og tjeklisten på den samme flade', async () => {
    await visPakning({ pakket: 1 });

    // Planen: hvilket grej der er med.
    expect(await screen.findByRole('button', { name: /Vælg grej/ })).toBeInTheDocument();
    // Tjeklisten: det man krydser af, mens man pakker.
    expect(screen.getByText('Pakkeliste (3)')).toBeInTheDocument();
    expect(screen.getByRole('checkbox', { name: /Sovepose/ })).toBeInTheDocument();
  });

  it('tæller grejet i fanerækken, så man kan aflæse turen uden at åbne fanen', async () => {
    await visPakning();

    expect(screen.getByRole('tab', { name: /^Pakning/ })).toHaveTextContent('Pakning 3');
  });

  it('lander på Pakning, når noget henviser til pakkelisten', async () => {
    await db.items.bulkAdd(GREJ.map((g) => lavItem(g)));
    const id = await db.ture.add(lavTur({
      status: 'klar',
      loese_item_ids: GREJ.map((g) => g.uid)
    }));

    tegn(
      <TurDetalje turId={id as number} tilbage={vi.fn()} maal="pakkeliste" />,
      DESKTOP
    );

    expect(await screen.findByRole('tab', { name: /^Pakning/ })).toHaveAttribute('aria-selected', 'true');
  });

  it('folder Vælg grej ud af sig selv, når der ikke er valgt noget endnu', async () => {
    // På en tom tur er valget det, man skal begynde med. Er grejet valgt, er
    // det listen, man kommer for — og så ligger valget bag ét tryk.
    await visPakning({ grej: [] });

    expect(await screen.findByRole('button', { name: /Vælg grej/ })).toHaveAttribute('aria-expanded', 'true');
  });
});

describe('kun én fyldt primary', () => {
  it('er turens næste skridt — ikke et felt i listens vælger', async () => {
    await visPakning({ pakket: 1 });

    await screen.findByText('Pakkeliste (3)');
    expect(fyldteAccenter()).toHaveLength(1);
    expect(fyldteAccenter()[0]).toHaveTextContent('Start tur');
  });

  it('holder også, når man skærer listen ned til det, der mangler', async () => {
    await visPakning({ pakket: 1 });

    await userEvent.click(await screen.findByRole('button', { name: 'Mangler (2)' }));

    expect(fyldteAccenter()).toHaveLength(1);
  });

  it('skriver creme og ikke hvidt på den fyldte knap', async () => {
    await visPakning();

    const knap = await screen.findByRole('button', { name: 'Start tur' });
    expect(knap).toHaveStyle({ color: 'var(--accent-tekst)', background: 'var(--accent)' });
  });
});

describe('fremdriften er ærlig', () => {
  it('siger hvor langt man er, og hvad vægten er', async () => {
    await visPakning({ pakket: 1 });

    expect(await screen.findByText('1 af 3')).toBeInTheDocument();
    // 2,0 + 1,4 + 0,6 kg. Vægten står sammen med fremdriften, fordi det er de
    // to tal, man pakker efter.
    expect(vaegtlinjen()).toBe('4 kg');
  });

  it('runder ned, så striben ikke står på 100 med noget udenfor tasken', async () => {
    await visPakning({ pakket: 2 });

    // 2 af 3 er 66,6 %.
    expect(await screen.findByRole('progressbar', { name: 'Pakket' }))
      .toHaveAttribute('aria-valuenow', '66');
  });

  it('siger 100 og Alt er pakket, først når alt er i tasken', async () => {
    await visPakning({ pakket: 3 });

    expect(await screen.findByText('Alt er pakket')).toBeInTheDocument();
    expect(screen.getByRole('progressbar', { name: 'Pakket' })).toHaveAttribute('aria-valuenow', '100');
  });

  it('nævner ikke en vægt pr. person, når man er alene om den', async () => {
    await visPakning({ pakket: 1, personer: 1 });

    expect(await screen.findByText('1 af 3')).toBeInTheDocument();
    expect(vaegtlinjen()).toBe('4 kg');
  });

  it('deler vægten ud, når der er nogen at dele med', async () => {
    // Delt grej bæres af én og vises fair fordelt. Med to om turen er det
    // halvdelen hver — gennemsnittet er det tal, man pakker efter.
    await visPakning({ pakket: 1, personer: 2 });

    await screen.findByText('1 af 3');
    // Teltets 2 kg deles på to; de 2 kg personlige følger med hver især.
    expect(vaegtlinjen()).toBe('4 kg · 3 kg pr. person');
  });

  it('siger pakketallet ét sted — ikke to', async () => {
    // Kortet og listen stod før på hver sin fane og sagde hver sit tal. På én
    // flade må det kun stå ét sted, ellers kan de komme til at sige hver sit.
    await visPakning({ pakket: 1 });

    await screen.findByText('1 af 3');
    expect(screen.queryByText('1 af 3 pakket')).not.toBeInTheDocument();
  });
});

describe('Mangler-filteret', () => {
  it('tæller det, der stadig ligger udenfor', async () => {
    await visPakning({ pakket: 1 });

    expect(await screen.findByRole('button', { name: 'Mangler (2)' })).toHaveAttribute('aria-pressed', 'false');
  });

  it('skærer listen ned til dem — og lader den vokse igen', async () => {
    await visPakning({ pakket: 1 });

    const filter = await screen.findByRole('button', { name: 'Mangler (2)' });
    await userEvent.click(filter);

    expect(screen.queryByRole('checkbox', { name: /Telt/ })).not.toBeInTheDocument();
    expect(screen.getByRole('checkbox', { name: /Sovepose/ })).toBeInTheDocument();
    expect(filter).toHaveAttribute('aria-pressed', 'true');

    await userEvent.click(filter);
    expect(screen.getByRole('checkbox', { name: /Telt/ })).toBeInTheDocument();
  });

  it('kan slås til fra fremdriftskortet, hvor tallet står', async () => {
    await visPakning({ pakket: 1 });

    await userEvent.click(await screen.findByRole('button', { name: 'Vis kun dem' }));

    expect(screen.getByRole('button', { name: 'Mangler (2)' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.queryByRole('checkbox', { name: /Telt/ })).not.toBeInTheDocument();
  });

  it('forsvinder, når der ikke er noget at skære væk', async () => {
    await visPakning({ pakket: 3 });

    await screen.findByText('Alt er pakket');
    expect(screen.queryByRole('button', { name: /^Mangler/ })).not.toBeInTheDocument();
  });

  it('beholder overskriften over det, der mangler', async () => {
    // Man skal stadig kunne se, hvilket grejsæt en manglende ting kom med i.
    await db.grupper.add(lavGruppe({ uid: 'g-lejr', navn: 'Lejr', item_ids: ['u-telt', 'u-sovepose'] }));
    await db.items.bulkAdd(GREJ.map((g) => lavItem(g)));
    const id = await db.ture.add(lavTur({
      status: 'klar',
      gruppe_ids: ['g-lejr'],
      pakkede_item_uids: ['u-telt']
    }));

    tegn(<TurDetalje turId={id as number} tilbage={vi.fn()} />, DESKTOP);
    await userEvent.click(await screen.findByRole('tab', { name: /^Pakning/ }));
    await userEvent.click(await screen.findByRole('button', { name: 'Mangler (1)' }));

    expect(screen.getByRole('checkbox', { name: /Sovepose/ })).toBeInTheDocument();
    expect(screen.queryByRole('checkbox', { name: /Telt/ })).not.toBeInTheDocument();
    // Overskriften over det, der er tilbage.
    expect(screen.getByText('Lejr')).toBeInTheDocument();
  });
});

// ─────────────────────────────────────────────
// Pakning · mobil
//
// Fra handoff'en "Ejer Pakning (mobil)" og docs/design/mobile/06-pakning.html,
// med research-forslag #1: pakningen er mobil-primær — store trykflader,
// ærlig fremdrift, "kun upakkede", og offline synligt i fladen.
//
// Det nye i forhold til PC er knappen: den fyldte accent følger pakningen.
// Tom → Tilføj grej. Delvis → Pak de n upakkede. Færdig → turens eget næste
// skridt. Den der ikke har den, er outline — aldrig to fyldte.
// ─────────────────────────────────────────────

const visMobil = (felter: Parameters<typeof visPakning>[0] = {}) =>
  visPakning({ bredde: MOBIL, ...felter });

describe('Pakning · mobil: knappen følger pakningen', () => {
  it('er Tilføj grej, når der ikke er valgt noget — og turens skridt er outline', async () => {
    await visMobil({ grej: [] });

    const primaer = await screen.findByRole('button', { name: 'Tilføj grej' });
    expect(fyldteAccenter()).toEqual([primaer]);
    expect(screen.getByRole('button', { name: 'Start tur' })).toHaveClass('ui-button--sekundaer');
  });

  it('er Pak de n upakkede, mens noget stadig ligger udenfor', async () => {
    await visMobil({ pakket: 1 });

    const primaer = await screen.findByRole('button', { name: 'Pak de 2 upakkede' });
    expect(fyldteAccenter()).toEqual([primaer]);
    expect(screen.getByRole('button', { name: 'Start tur' })).toHaveClass('ui-button--sekundaer');
  });

  it('skærer listen ned til de upakkede, når man trykker', async () => {
    await visMobil({ pakket: 1 });

    await userEvent.click(await screen.findByRole('button', { name: 'Pak de 2 upakkede' }));

    expect(screen.getByRole('button', { name: 'Mangler (2)' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.queryByRole('checkbox', { name: /Telt/ })).not.toBeInTheDocument();
    expect(screen.getByRole('checkbox', { name: /Sovepose/ })).toBeInTheDocument();
  });

  it('skifter, mens man krydser af', async () => {
    await visMobil({ pakket: 1 });

    await userEvent.click(await screen.findByRole('checkbox', { name: /Sovepose/ }));

    expect(await screen.findByRole('button', { name: 'Pak den sidste' })).toHaveClass('ui-button--primaer');
  });

  it('giver pladsen til turens næste skridt, når alt er pakket', async () => {
    await visMobil({ pakket: 3 });

    await screen.findByText('Alt er pakket');
    expect(fyldteAccenter()).toHaveLength(1);
    expect(fyldteAccenter()[0]).toHaveTextContent('Start tur');
    expect(screen.queryByRole('button', { name: /upakkede|Pak den sidste/ })).not.toBeInTheDocument();
  });

  it('skriver creme på accent', async () => {
    await visMobil({ pakket: 1 });

    expect(await screen.findByRole('button', { name: 'Pak de 2 upakkede' }))
      .toHaveStyle({ color: 'var(--accent-tekst)', background: 'var(--accent)' });
  });

  it('holder én fyldt, også med filteret slået til', async () => {
    await visMobil({ pakket: 1 });

    await userEvent.click(await screen.findByRole('button', { name: 'Mangler (2)' }));

    expect(fyldteAccenter()).toHaveLength(1);
  });

  it('rører ikke knapperne på en aktiv tur — dér er det på-tur-skærmen', async () => {
    await visMobil({ pakket: 1, status: 'aktiv' });

    await screen.findByText('1 af 3');
    expect(fyldteAccenter()).toHaveLength(1);
    expect(fyldteAccenter()[0]).toHaveTextContent('Åbn på-tur-skærmen');
  });

  it('rører ikke de andre faner', async () => {
    await visMobil({ pakket: 1 });
    await screen.findByRole('button', { name: 'Pak de 2 upakkede' });

    await userEvent.click(screen.getByRole('tab', { name: /^Overblik/ }));

    expect(screen.queryByRole('button', { name: 'Pak de 2 upakkede' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Start tur' })).toHaveClass('ui-button--primaer');
  });
});

describe('Pakning · mobil: offline kan ses', () => {
  afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); });

  const saetOnline = (online: boolean) =>
    vi.spyOn(window.navigator, 'onLine', 'get').mockReturnValue(online);
  // Om prøvekaldet ud kommer igennem. Uden stub ville testen banke på et
  // rigtigt netværk.
  const saetNet = (svarer: boolean) => vi.stubGlobal('fetch', svarer
    ? vi.fn().mockResolvedValue(new Response(null, { status: 200 }))
    : vi.fn().mockRejectedValue(new TypeError('Failed to fetch')));

  it('siger at krydset gemmes på telefonen', async () => {
    saetOnline(true);
    saetNet(true);
    await visMobil({ pakket: 1 });

    const linje = await screen.findByRole('status');
    await waitFor(() => expect(fetch).toHaveBeenCalled());
    expect(linje).toHaveTextContent('gemmes på telefonen med det samme');
    expect(linje).toHaveAttribute('data-online', 'true');
  });

  it('advarer, når nettet er væk, selvom browseren siger online', async () => {
    // Reed-testen på PR #80: `navigator.onLine` blev ved med at sige sandt,
    // og linjen blev ved med at sige "også uden net".
    saetOnline(true);
    saetNet(false);
    await visMobil({ pakket: 1 });

    const linje = await screen.findByRole('status');
    await waitFor(() => expect(linje).toHaveTextContent('Du er offline'));
    expect(linje).toHaveAttribute('data-online', 'false');
    expect(linje).not.toHaveTextContent('også uden net');
  });

  it('skifter til advarslen, når browseren melder offline', async () => {
    saetOnline(true);
    saetNet(true);
    await visMobil({ pakket: 1 });
    const linje = await screen.findByRole('status');
    await waitFor(() => expect(linje).toHaveAttribute('data-online', 'true'));

    act(() => { window.dispatchEvent(new Event('offline')); });

    expect(linje).toHaveTextContent('Du er offline');
    expect(linje).toHaveAttribute('data-online', 'false');
  });

  it('holder én fyldt accent, også offline', async () => {
    saetOnline(false);
    await visMobil({ pakket: 1 });

    await screen.findByText('Du er offline.');
    expect(fyldteAccenter()).toHaveLength(1);
    expect(fyldteAccenter()[0]).toHaveTextContent('Pak de 2 upakkede');
  });

  it('siger det, når man er offline — uden at love en sync', async () => {
    saetOnline(false);
    await visMobil({ pakket: 1 });

    const linje = await screen.findByRole('status');
    expect(linje).toHaveTextContent('Du er offline');
    expect(linje).toHaveAttribute('data-online', 'false');
    expect(linje.textContent).not.toMatch(/synk|sendt/i);
  });

  it('står også på en tom tur, før der er noget at krydse af', async () => {
    await visMobil({ grej: [] });

    expect(await screen.findByRole('status')).toBeInTheDocument();
  });
});
