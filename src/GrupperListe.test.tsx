// @vitest-environment jsdom
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

vi.mock('./pb', () => import('./test/pbMock'));

import { db } from './db';
import GrupperListe from './GrupperListe';
import { lavItem, lavGruppe, lavTur } from './test/data';
import { tegn, DESKTOP } from './test/skaerm';

// ─────────────────────────────────────────────
// Grejsæt · desktop
//
// Fra handoff'en "Ejer Grejsæt · desktop" (16. sep 2026) og den visuelle
// reference i `docs/design/desktop/06-grejsaet.html`. Testene er
// acceptkriterierne skrevet ud.
//
// De to, der bærer resten:
//
//   · **Højst én fyldt accent pr. skærmbillede.** Referencen tegner både
//     "Nyt sæt" og "Brug på tur" fyldt, og det er én for meget.
//   · **"Brug på tur" må ikke være en stille overskrivning.** Der skal
//     vælges en tur, overblikket skal stå på skærmen, og Annuller skal
//     kunne lukke arket uden at have rørt turen.
// ─────────────────────────────────────────────

beforeEach(async () => {
  await Promise.all([db.grupper.clear(), db.items.clear(), db.ture.clear()]);
  vi.spyOn(console, 'error').mockImplementation(() => {});
});

const TARP = lavItem({ uid: 'i-tarp', navn: 'Tarp 3×3', vaegt_g: 890, delt: true });
const KOEKKEN = lavItem({ uid: 'i-koekken', navn: 'Stormkøkken', vaegt_g: 1200, delt: true });
const SOVEPOSE = lavItem({ uid: 'i-sovepose', navn: 'Sovepose −5°', vaegt_g: 1400, delt: false });

// To sæt og et stykke grej i hvert, som referencen: et valgt og et ikke.
const medToSaet = async () => {
  await db.items.bulkAdd([TARP, KOEKKEN, SOVEPOSE]);
  await db.grupper.bulkAdd([
    lavGruppe({ uid: 'g-bushcraft', navn: 'Bushcraft weekend', item_ids: ['i-tarp', 'i-koekken', 'i-sovepose'] }),
    lavGruppe({ uid: 'g-solo', navn: 'Letvægts solo', item_ids: ['i-sovepose'] })
  ]);
};

const vis = (props: Partial<Parameters<typeof GrupperListe>[0]> = {}) => {
  const alle = { fane: 'grupper' as const, skift: vi.fn(), aabnGruppe: vi.fn(), nyGruppe: vi.fn(), ...props };
  tegn(<GrupperListe {...alle} />, DESKTOP);
  return alle;
};

// Alt på skærmen, der er malet med den fyldte accent. Både `Knap`-varianten
// og alt andet med accenten som baggrund — det var netop noget, der ikke var
// en knap, der brød reglen på Grej.
const fyldteAccenter = () => Array.from(document.querySelectorAll<HTMLElement>('*'))
  .filter((el) => el.classList.contains('ui-button--primaer') || el.style.background === 'var(--accent)');

const saetkort = (navn: string) => screen.getByRole('button', { name: new RegExp(navn) });
const detalje = () => screen.getByRole('region', { name: /^Sættet / });

// ─────────────────────────────────────────────

describe('overskrift og forklaring', () => {
  it('har vejen tilbage til Grej, titlen og antallet af sæt', async () => {
    await medToSaet();
    const { skift } = vis();

    expect(await screen.findByRole('heading', { level: 1, name: 'Grejsæt' })).toBeInTheDocument();
    expect(await screen.findByText('2 sæt · genbrug hele pakninger')).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: '‹ Grej' }));
    expect(skift).toHaveBeenCalledWith('inventar');
  });

  it('forklarer i én linje, hvad et grejsæt er', async () => {
    vis();

    expect(await screen.findByText(/Et grejsæt er en gemt pakning/)).toBeInTheDocument();
  });
});

describe('sætlisten', () => {
  it('siger antal, vægt og om sættet har været brugt', async () => {
    await medToSaet();
    await db.ture.add(lavTur({ navn: 'Fovslet Skov', startdato: '2026-08-01', gruppe_ids: ['g-bushcraft'] }));
    vis();

    expect(await screen.findByText('3 ting · 3,5 kg · brugt på Fovslet Skov')).toBeInTheDocument();
    expect(screen.getByText('1 ting · 1,4 kg · aldrig brugt på tur')).toBeInTheDocument();
  });

  it('markerer det valgte sæt — det første, indtil man vælger et andet', async () => {
    await medToSaet();
    vis();

    const foerste = await screen.findByRole('button', { name: /Bushcraft weekend/ });
    expect(foerste).toHaveAttribute('aria-pressed', 'true');
    expect(within(foerste).getByText('Valgt')).toBeInTheDocument();

    await userEvent.click(saetkort('Letvægts solo'));

    expect(saetkort('Letvægts solo')).toHaveAttribute('aria-pressed', 'true');
    expect(saetkort('Bushcraft weekend')).toHaveAttribute('aria-pressed', 'false');
  });
});

describe('sæt-detaljen', () => {
  it('viser navn, antal og vægt på det valgte sæt', async () => {
    await medToSaet();
    vis();

    const kort = await screen.findByRole('region', { name: 'Sættet Bushcraft weekend' });
    expect(within(kort).getByRole('heading', { name: 'Bushcraft weekend' })).toBeInTheDocument();
    expect(within(kort).getByText('3 ting · 3,5 kg')).toBeInTheDocument();
  });

  it('viser hver ting med vægt og om den er fælles eller personlig', async () => {
    await medToSaet();
    vis();

    const kort = await screen.findByRole('region', { name: 'Sættet Bushcraft weekend' });
    expect(within(kort).getByText('890 g · fælles')).toBeInTheDocument();
    expect(within(kort).getByText('1,2 kg · fælles')).toBeInTheDocument();
    expect(within(kort).getByText('1,4 kg · personligt')).toBeInTheDocument();
  });

  it('følger med, når man vælger et andet sæt', async () => {
    await medToSaet();
    vis();

    await userEvent.click(await screen.findByRole('button', { name: /Letvægts solo/ }));

    expect(within(detalje()).getByText('1 ting · 1,4 kg')).toBeInTheDocument();
    expect(within(detalje()).queryByText('Tarp 3×3')).not.toBeInTheDocument();
  });

  it('siger i bunden, hvad Brug på tur gør ved turen', async () => {
    await medToSaet();
    vis();

    const kort = await screen.findByRole('region', { name: 'Sættet Bushcraft weekend' });
    expect(within(kort).getByText(/lægges ikke til to gange/)).toBeInTheDocument();
  });

  it('sender Rediger ind i sættet', async () => {
    await medToSaet();
    const { aabnGruppe } = vis();

    await userEvent.click(await screen.findByRole('button', { name: 'Rediger' }));

    const id = (await db.grupper.get({ uid: 'g-bushcraft' }))?.id;
    expect(aabnGruppe).toHaveBeenCalledWith(id);
  });
});

describe('kun én fyldt accent', () => {
  it('er Brug på tur, når der er et sæt at bruge', async () => {
    await medToSaet();
    vis();

    await screen.findByRole('region', { name: 'Sættet Bushcraft weekend' });
    expect(fyldteAccenter()).toHaveLength(1);
    expect(fyldteAccenter()[0]).toHaveTextContent('Brug på tur');
    // Referencen tegner også "Nyt sæt" fyldt. Den er outline her.
    expect(screen.getByRole('button', { name: '+ Nyt sæt' })).not.toHaveClass('ui-button--primaer');
  });

  it('er Nyt sæt, når der ikke er nogen sæt — ellers står skærmen uden vej frem', async () => {
    vis();

    expect(await screen.findByRole('button', { name: '+ Nyt sæt' })).toHaveClass('ui-button--primaer');
    expect(fyldteAccenter()).toHaveLength(1);
  });

  it('er Nyt sæt, når det valgte sæt er tomt — der er ikke noget at lægge på en tur', async () => {
    await db.grupper.add(lavGruppe({ uid: 'g-tom', navn: 'Tomt sæt' }));
    vis();

    expect(await screen.findByRole('button', { name: '+ Nyt sæt' })).toHaveClass('ui-button--primaer');
    expect(screen.getByRole('button', { name: /Brug på tur/ })).toBeDisabled();
    expect(fyldteAccenter()).toHaveLength(1);
  });
});

describe('Brug på tur', () => {
  const medTure = async () => {
    await medToSaet();
    await db.ture.bulkAdd([
      lavTur({ uid: 't-fovslet', navn: 'Fovslet Skov', status: 'klar', startdato: '2026-09-01' }),
      lavTur({ uid: 't-oeghaven', navn: 'Øghaven', status: 'afsluttet', startdato: '2026-05-01' })
    ]);
  };

  const aabnArk = async () => {
    await userEvent.click(await screen.findByRole('button', { name: 'Brug på tur' }));
    return screen.getByRole('dialog');
  };

  it('kræver et eksplicit valg: knappen er slået fra, indtil en tur er valgt', async () => {
    await medTure();
    vis();
    const ark = await aabnArk();

    expect(within(ark).getByRole('button', { name: /Indlæs 3 ting/ })).toBeDisabled();

    await userEvent.click(within(ark).getByRole('button', { name: /Fovslet Skov/ }));

    expect(within(ark).getByRole('button', { name: 'Indlæs 3 ting' })).toBeEnabled();
  });

  it('viser turens faser, så man kan se hvad man vælger', async () => {
    await medTure();
    vis();
    const ark = await aabnArk();

    expect(within(ark).getByRole('button', { name: /Fovslet Skov · Klar/ })).toBeInTheDocument();
    expect(within(ark).getByRole('button', { name: /Øghaven · Afsluttet/ })).toBeInTheDocument();
  });

  it('lægger sættet på turen, når man bekræfter', async () => {
    await medTure();
    vis();
    const ark = await aabnArk();

    await userEvent.click(within(ark).getByRole('button', { name: /Fovslet Skov/ }));
    await userEvent.click(within(ark).getByRole('button', { name: 'Indlæs 3 ting' }));

    expect(await screen.findByText(/er lagt på Fovslet Skov/)).toBeInTheDocument();
    const tur = await db.ture.get({ uid: 't-fovslet' });
    expect(tur?.gruppe_ids).toEqual(['g-bushcraft']);
  });

  it('Annuller lukker arket uden at røre turen', async () => {
    await medTure();
    vis();
    const ark = await aabnArk();

    await userEvent.click(within(ark).getByRole('button', { name: /Fovslet Skov/ }));
    await userEvent.click(within(ark).getByRole('button', { name: 'Annuller' }));

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect((await db.ture.get({ uid: 't-fovslet' }))?.gruppe_ids).toEqual([]);
    expect(screen.queryByText(/er lagt på/)).not.toBeInTheDocument();
  });

  it('viser overblikket før bekræft: hvad turen går fra og til', async () => {
    await medTure();
    vis();
    const ark = await aabnArk();

    await userEvent.click(within(ark).getByRole('button', { name: /Fovslet Skov/ }));

    expect(within(ark).getByText('Turen går fra 0 til 3 ting.')).toBeInTheDocument();
  });

  it('siger hvor mange dubletter der merges, når turen har noget af grejet i forvejen', async () => {
    await medTure();
    await db.ture.update((await db.ture.get({ uid: 't-fovslet' }))!.id!, { loese_item_ids: ['i-tarp'] });
    vis();
    const ark = await aabnArk();

    await userEvent.click(within(ark).getByRole('button', { name: /Fovslet Skov/ }));

    expect(within(ark).getByText(/1 af sættets ting er allerede på turen/)).toBeInTheDocument();
    expect(within(ark).getByText(/Turen går fra 1 til 3 ting/)).toBeInTheDocument();
  });

  it('kan ikke lægge det samme sæt på to gange', async () => {
    await medTure();
    await db.ture.update((await db.ture.get({ uid: 't-fovslet' }))!.id!, { gruppe_ids: ['g-bushcraft'] });
    vis();
    const ark = await aabnArk();

    await userEvent.click(within(ark).getByRole('button', { name: /Fovslet Skov/ }));

    expect(within(ark).getByText(/Sættet ligger allerede på turen/)).toBeInTheDocument();
    expect(within(ark).getByRole('button', { name: /Indlæs 3 ting/ })).toBeDisabled();
  });

  it('siger det ligeud, når der ikke er nogen ture at vælge', async () => {
    await medToSaet();
    vis();
    const ark = await aabnArk();

    expect(within(ark).getByText(/Du har ingen ture endnu/)).toBeInTheDocument();
    expect(within(ark).getByRole('button', { name: /Indlæs 3 ting/ })).toBeDisabled();
  });
});

describe('Opret fra tur', () => {
  it('er en secondary path og ikke en fyldt knap', async () => {
    await medToSaet();
    vis();

    const knap = await screen.findByRole('button', { name: /Opret fra tur/ });
    expect(knap).not.toHaveClass('ui-button--primaer');
  });

  it('opretter først, når man bekræfter — ikke når arket åbner', async () => {
    await medToSaet();
    await db.ture.add(lavTur({ uid: 't-fovslet', navn: 'Fovslet Skov', loese_item_ids: ['i-tarp', 'i-koekken'] }));
    vis();

    await userEvent.click(await screen.findByRole('button', { name: /Opret fra tur/ }));
    expect(await db.grupper.count()).toBe(2);

    const ark = screen.getByRole('dialog');
    await userEvent.click(within(ark).getByRole('button', { name: /Fovslet Skov/ }));
    await userEvent.click(within(ark).getByRole('button', { name: 'Opret sæt af 2 ting' }));

    expect(await db.grupper.count()).toBe(3);
    const nyt = (await db.grupper.toArray()).find((g) => g.navn === 'Fovslet Skov');
    expect(nyt?.item_ids.sort()).toEqual(['i-koekken', 'i-tarp']);
  });

  it('Annuller opretter ingenting', async () => {
    await medToSaet();
    await db.ture.add(lavTur({ navn: 'Fovslet Skov', loese_item_ids: ['i-tarp'] }));
    vis();

    await userEvent.click(await screen.findByRole('button', { name: /Opret fra tur/ }));
    const ark = screen.getByRole('dialog');
    await userEvent.click(within(ark).getByRole('button', { name: /Fovslet Skov/ }));
    await userEvent.click(within(ark).getByRole('button', { name: 'Annuller' }));

    expect(await db.grupper.count()).toBe(2);
  });

  it('kan ikke gemme et sæt fra en tur uden grej', async () => {
    await medToSaet();
    await db.ture.add(lavTur({ navn: 'Tom tur' }));
    vis();

    await userEvent.click(await screen.findByRole('button', { name: /Opret fra tur/ }));
    const ark = screen.getByRole('dialog');
    await userEvent.click(within(ark).getByRole('button', { name: /Tom tur/ }));

    expect(within(ark).getByText(/ikke noget grej på sig endnu/)).toBeInTheDocument();
    expect(within(ark).getByRole('button', { name: /Opret sæt/ })).toBeDisabled();
  });

  it('åbner det nye sæt, så navnet kan rettes med det samme', async () => {
    await db.items.add(TARP);
    await db.ture.add(lavTur({ navn: 'Fovslet Skov', loese_item_ids: ['i-tarp'] }));
    const { aabnGruppe } = vis();

    await userEvent.click(await screen.findByRole('button', { name: /Opret fra tur/ }));
    const ark = screen.getByRole('dialog');
    await userEvent.click(within(ark).getByRole('button', { name: /Fovslet Skov/ }));
    await userEvent.click(within(ark).getByRole('button', { name: 'Opret sæt af 1 ting' }));

    const nyt = (await db.grupper.toArray()).find((g) => g.navn === 'Fovslet Skov');
    await waitFor(() => expect(aabnGruppe).toHaveBeenCalledWith(nyt?.id));
  });
});

describe('tom skærm', () => {
  it('peger på begge veje ind, når der ikke er nogen sæt', async () => {
    vis();

    expect(await screen.findByText('Ingen sæt endnu?')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Opret fra tur/ })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Intet sæt endnu' })).toBeInTheDocument();
  });

  it('kalder nyGruppe, når man trykker Nyt sæt', async () => {
    const { nyGruppe } = vis();

    await userEvent.click(await screen.findByRole('button', { name: '+ Nyt sæt' }));
    expect(nyGruppe).toHaveBeenCalled();
  });
});
