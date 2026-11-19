// @vitest-environment jsdom
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

vi.mock('./pb', () => import('./test/pbMock'));

import { db } from './db';
import TurDetalje from './TurDetalje';
import { lavGruppe, lavItem, lavTur } from './test/data';
import { nytAfgangsTjek, STANDARD_SKABELON } from './afgangsTjek';
import { tegn, DESKTOP, MOBIL } from './test/skaerm';

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

const visTur = async (felter = {}, bredde = DESKTOP) => {
  const id = await db.ture.add(lavTur({ navn: 'Fovslet Skov', sted: 'Fovslet', ...felter }));
  tegn(<TurDetalje turId={id as number} tilbage={vi.fn()} />, bredde);
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

// Overblik med alt foldet ud (0.2.18). Testene ovenfor ser kun skærmen, som
// den åbner — med Vejrudsigt foldet sammen og uden motorforslag. Fold man
// vejret ud, eller har motoren et grejsæt at foreslå, stod der før tre fyldte
// knapper: turens næste skridt, "Hent vejr" og forslagets "Tag sættet med".
// Nu er de to sidste outline, og det gælder på PC og telefon.
describe('Overblik: én fyldt primary, også med vejr og forslag fremme', () => {
  const visFyldtOverblik = async (status: 'kladde' | 'klar' | 'aktiv', bredde: number) => {
    // Et grejsæt med turens aktivitet som tag giver motoren et forslag.
    await db.grupper.add(lavGruppe({ navn: 'Bushcraftsæt', tags: ['bushcraft'] }));
    await visTur({ status }, bredde);

    const tagImod = await screen.findByRole('button', { name: 'Tag sættet med' });
    await userEvent.click(screen.getByRole('button', { name: /Vejrudsigt/ }));
    const hentVejr = await screen.findByRole('button', { name: 'Hent vejr' });
    return { tagImod, hentVejr };
  };

  for (const [navn, bredde] of [['PC', DESKTOP], ['telefon', MOBIL]] as const) {
    it(`har turens næste skridt som den eneste fyldte på en kladde (${navn})`, async () => {
      const { tagImod, hentVejr } = await visFyldtOverblik('kladde', bredde);

      expect(fyldte()).toHaveLength(1);
      expect(fyldte()[0]).toHaveTextContent('Markér som klar');
      expect(hentVejr).toHaveClass('ui-button--sekundaer');
      expect(tagImod).toHaveClass('ui-button--sekundaer');
      // Afvis er stadig ghost.
      expect(screen.getByRole('button', { name: 'Ikke på denne tur' })).toHaveClass('ui-button--tekst');
    });

    it(`holder også på en klar tur (${navn})`, async () => {
      await visFyldtOverblik('klar', bredde);

      expect(fyldte()).toHaveLength(1);
      expect(fyldte()[0]).toHaveTextContent('Start tur');
    });
  }

  it('lader på-tur-skærmen være den fyldte på en aktiv tur på telefonen', async () => {
    await visFyldtOverblik('aktiv', MOBIL);

    expect(fyldte()).toHaveLength(1);
    expect(fyldte()[0]).toHaveTextContent('Åbn på-tur-skærmen');
    expect(screen.getByRole('button', { name: 'Afslut tur' })).toHaveClass('ui-button--sekundaer');
  });

  it('lader turens næste skridt være den fyldte på en aktiv tur på PC', async () => {
    await visFyldtOverblik('aktiv', DESKTOP);

    expect(fyldte()).toHaveLength(1);
    expect(fyldte()[0]).toHaveTextContent('Afslut tur');
    expect(screen.getByRole('button', { name: 'På tur' })).toHaveClass('ui-button--sekundaer');
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

describe('Afgangs-tjek på en smal telefon', () => {
  // Fra Noor: efter 16 px skrift i felterne (0.2.21) blev de lange punkter
  // skåret af. Et <input> kan ikke ombryde, så teksten står i et tekstområde,
  // og spalten må give efter for sit indhold (minmax(0, 1fr)).
  const visAfgang = async () => {
    await visTur({ status: 'aktiv', afgangs_tjek: nytAfgangsTjek() }, 320);
    const undervejs = await screen.findByRole('tab', { name: 'Undervejs' }).catch(() => null);
    if (undervejs) await userEvent.click(undervejs);
    return screen.findAllByRole('textbox', { name: 'Punktets tekst' });
  };

  it('viser hvert punkt i et felt, der kan ombryde', async () => {
    const felter = await visAfgang();
    expect(felter).toHaveLength(STANDARD_SKABELON.length);
    for (const felt of felter) expect(felt.tagName).toBe('TEXTAREA');
    expect(felter[2]).toHaveValue('Sagt hvor jeg er, og hvornår jeg er hjemme');
  });

  it('lader spalten krympe under indholdets naturlige bredde', async () => {
    const [felt] = await visAfgang();
    let el: HTMLElement | null = felt;
    const spor: string[] = [];
    while (el) {
      if (el.style.display === 'grid') spor.push(el.style.gridTemplateColumns);
      el = el.parentElement;
    }
    expect(spor.length).toBeGreaterThan(0);
    for (const s of spor) expect(s).toMatch(/minmax\(0,/);
  });

  it('laver ikke et linjeskift på Enter — et punkt er én linje', async () => {
    const [felt] = await visAfgang();
    await userEvent.click(felt);
    await userEvent.keyboard('{End}{Enter}x');
    const tur = (await db.ture.toArray())[0];
    expect(tur.afgangs_tjek?.linjer[0].tekst).toBe('Nøglerx');
  });
});
