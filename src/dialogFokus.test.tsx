// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import { useRef, useState } from 'react';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

vi.mock('./pb', () => import('./test/pbMock'));

import { naesteIFaelde, useDialogFokus } from './dialogFokus';
import { db } from './db';
import TurDetalje from './TurDetalje';
import { NyTurArk } from './Ark';
import { Qrfuldskaerm } from './Qrkode';
import PaaTurTilstand from './PaaTurTilstand';
import { lavTur } from './test/data';
import { tegn, DESKTOP, MOBIL } from './test/skaerm';

// ─────────────────────────────────────────────
// Dialoger og ark: fokus ind, fokus fanget, fokus ud, Escape.
//
// Et lag over skærmen er kun et lag for den, der kan se det. Testene her
// holder de tre regler fra dialogFokus.ts for alle lagene i appen, så et nyt
// lag ikke kan glemme én af dem uden at noget falder.
// ─────────────────────────────────────────────

describe('naesteIFaelde — reglen for Tab ved kanterne', () => {
  const a = document.createElement('button');
  const b = document.createElement('button');
  const c = document.createElement('button');
  const alle = [a, b, c];

  it('Tab fra den sidste går til den første', () => {
    expect(naesteIFaelde(alle, c, false)).toBe(a);
  });

  it('Shift+Tab fra den første går til den sidste', () => {
    expect(naesteIFaelde(alle, a, true)).toBe(c);
  });

  it('lader browseren flytte fokus inde i midten', () => {
    expect(naesteIFaelde(alle, a, false)).toBeNull();
    expect(naesteIFaelde(alle, b, true)).toBeNull();
  });

  it('fanger fokus, der står uden for de fokuserbare (fx på selve laget)', () => {
    expect(naesteIFaelde(alle, document.body, false)).toBe(a);
    expect(naesteIFaelde(alle, document.body, true)).toBe(c);
  });

  it('gør ingenting, når der intet er at tabbe til', () => {
    expect(naesteIFaelde([], null, false)).toBeNull();
  });
});

// En side med en udløser-knap, der åbner et lag. Laget står ved siden af
// knappen, sådan som arkene gør i appen.
function MedArk() {
  const [aaben, setAaben] = useState(false);
  return (
    <div>
      <button onClick={() => setAaben(true)}>Ny tur</button>
      <button>Noget bag laget</button>
      {aaben && <NyTurArk idag="2026-09-19" opret={() => {}} annuller={() => setAaben(false)} />}
    </div>
  );
}

describe('opret-arket', () => {
  it('flytter fokus ind i det første felt ved åbning', async () => {
    tegn(<MedArk />, DESKTOP);
    await userEvent.click(screen.getByRole('button', { name: 'Ny tur' }));

    expect(screen.getByLabelText('Titel')).toHaveFocus();
  });

  it('sender fokus tilbage til udløseren, når det lukkes med Annuller', async () => {
    tegn(<MedArk />, DESKTOP);
    const udloeser = screen.getByRole('button', { name: 'Ny tur' });
    await userEvent.click(udloeser);
    await userEvent.click(screen.getByRole('button', { name: 'Annuller' }));

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(udloeser).toHaveFocus();
  });

  it('lukker på Escape og sender fokus tilbage til udløseren', async () => {
    tegn(<MedArk />, MOBIL);
    const udloeser = screen.getByRole('button', { name: 'Ny tur' });
    await userEvent.click(udloeser);
    expect(screen.getByRole('dialog')).toBeInTheDocument();

    await userEvent.keyboard('{Escape}');

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(udloeser).toHaveFocus();
  });

  it('fanger fokus: Tab fra den sidste knap går rundt til den første', async () => {
    tegn(<MedArk />, DESKTOP);
    await userEvent.click(screen.getByRole('button', { name: 'Ny tur' }));
    const dialog = screen.getByRole('dialog');

    // Hele vejen rundt og et skridt til. Fokus må aldrig forlade arket.
    for (let i = 0; i < 12; i++) {
      await userEvent.tab();
      expect(dialog.contains(document.activeElement)).toBe(true);
    }
  });

  it('fanger fokus baglæns: Shift+Tab fra det første felt går til den sidste knap', async () => {
    tegn(<MedArk />, DESKTOP);
    await userEvent.click(screen.getByRole('button', { name: 'Ny tur' }));
    const dialog = screen.getByRole('dialog');

    // Krydset står før titelfeltet, så første Shift+Tab lander på det.
    await userEvent.tab({ shift: true });
    expect(screen.getByRole('button', { name: 'Luk' })).toHaveFocus();
    await userEvent.tab({ shift: true });
    expect(dialog.contains(document.activeElement)).toBe(true);
    expect(screen.getByRole('button', { name: 'Noget bag laget' })).not.toHaveFocus();
  });
});

describe('QR i fuld skærm', () => {
  function MedQr() {
    const [aaben, setAaben] = useState(false);
    return (
      <div>
        <button onClick={() => setAaben(true)}>Vis stort</button>
        {aaben && <Qrfuldskaerm vaerdi="https://example.test/t/abc" luk={() => setAaben(false)} />}
      </div>
    );
  }

  it('er en navngivet dialog, der får fokus og lukker på Escape', async () => {
    tegn(<MedQr />);
    const udloeser = screen.getByRole('button', { name: 'Vis stort' });
    await userEvent.click(udloeser);

    const dialog = screen.getByRole('dialog', { name: 'QR-kode i fuld skærm' });
    expect(dialog).toHaveFocus();

    // Intet at tabbe til herinde: fokus bliver på laget.
    await userEvent.tab();
    expect(dialog).toHaveFocus();

    await userEvent.keyboard('{Escape}');
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(udloeser).toHaveFocus();
  });
});

describe('På tur-skærmen', () => {
  function MedPaaTur() {
    const [aaben, setAaben] = useState(false);
    return (
      <div>
        <button onClick={() => setAaben(true)}>På tur</button>
        {aaben && (
          <PaaTurTilstand
            tur={lavTur({ navn: 'Fovslet Skov' })}
            vejr={null}
            skrivNote={() => {}}
            luk={() => setAaben(false)}
          />
        )}
      </div>
    );
  }

  it('er en dialog med turens navn, får fokus og giver det tilbage på Escape', async () => {
    tegn(<MedPaaTur />);
    const udloeser = screen.getByRole('button', { name: 'På tur' });
    await userEvent.click(udloeser);

    const dialog = screen.getByRole('dialog', { name: 'Fovslet Skov' });
    // Selve skærmen og ikke turloggens felt: det står langt nede.
    expect(dialog).toHaveFocus();
    expect(screen.getByLabelText('Ny indgang i turloggen')).not.toHaveFocus();

    await userEvent.keyboard('{Escape}');
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(udloeser).toHaveFocus();
  });

  it('lukker også med Luk-knappen og giver fokus tilbage', async () => {
    tegn(<MedPaaTur />);
    const udloeser = screen.getByRole('button', { name: 'På tur' });
    await userEvent.click(udloeser);
    await userEvent.click(screen.getByRole('button', { name: 'Luk' }));

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(udloeser).toHaveFocus();
  });
});

describe('På tur, der tegnes i stedet for skærmen', () => {
  // Sådan står det i TurDetalje: når På tur er åben, er hele turskærmen —
  // og dermed knappen — væk. Når den lukker, tegnes skærmen og knappen igen
  // som nye elementer. Før stod fokus da på body.
  function SomTurskaermen({ ventFoerst = false }: { ventFoerst?: boolean }) {
    const [aaben, setAaben] = useState(false);
    const aabn = async () => {
      // TurDetalje sikrer afgangstjekket i basen, før skærmen åbner.
      if (ventFoerst) await new Promise((r) => setTimeout(r, 10));
      setAaben(true);
    };
    if (aaben) {
      return (
        <PaaTurTilstand
          tur={lavTur({ navn: 'Fovslet Skov' })}
          vejr={null}
          skrivNote={() => {}}
          luk={() => setAaben(false)}
        />
      );
    }
    return (
      <div>
        <button>Skift status</button>
        <button onClick={() => void aabn()}>På tur</button>
      </div>
    );
  }

  it('giver fokus tilbage til På tur-knappen efter Escape', async () => {
    tegn(<SomTurskaermen />);
    screen.getByRole('button', { name: 'På tur' }).focus();
    await userEvent.keyboard('{Enter}');
    expect(screen.getByRole('dialog', { name: 'Fovslet Skov' })).toHaveFocus();

    await userEvent.keyboard('{Escape}');

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'På tur' })).toHaveFocus();
  });

  it('giver fokus tilbage til På tur-knappen efter Luk', async () => {
    tegn(<SomTurskaermen />);
    await userEvent.click(screen.getByRole('button', { name: 'På tur' }));
    await userEvent.click(screen.getByRole('button', { name: 'Luk' }));

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'På tur' })).toHaveFocus();
  });

  it('virker også, når skærmen først åbner efter et skriv i basen', async () => {
    tegn(<SomTurskaermen ventFoerst />);
    await userEvent.click(screen.getByRole('button', { name: 'På tur' }));
    expect(await screen.findByRole('dialog', { name: 'Fovslet Skov' })).toBeInTheDocument();

    await userEvent.keyboard('{Escape}');
    expect(screen.getByRole('button', { name: 'På tur' })).toHaveFocus();
  });

  it('giver fokus tilbage på den rigtige turskærm (TurDetalje)', async () => {
    const id = await db.ture.add(lavTur({ navn: 'Fovslet Skov', sted: 'Fovslet', status: 'aktiv' }));
    tegn(<TurDetalje turId={id as number} tilbage={() => {}} />, DESKTOP);

    await userEvent.click(await screen.findByRole('button', { name: 'På tur' }));
    expect(await screen.findByRole('dialog', { name: 'Fovslet Skov' })).toHaveFocus();

    await userEvent.keyboard('{Escape}');
    await waitFor(() => expect(screen.getByRole('button', { name: 'På tur' })).toHaveFocus());

    await userEvent.click(screen.getByRole('button', { name: 'På tur' }));
    await userEvent.click(await screen.findByRole('button', { name: 'Luk' }));
    await waitFor(() => expect(screen.getByRole('button', { name: 'På tur' })).toHaveFocus());
  });
});

describe('lag oven på lag', () => {
  // To lag åbne på én gang: kun det øverste må lukke på Escape. Ellers lukker
  // ét tryk både QR-koden og den skærm, den blev åbnet fra.
  function Lag({ navn, luk, children }: { navn: string; luk: () => void; children?: React.ReactNode }) {
    const ref = useRef<HTMLDivElement>(null);
    useDialogFokus(ref, luk);
    return (
      <div ref={ref} role="dialog" aria-label={navn}>
        <button>{`Knap i ${navn}`}</button>
        {children}
      </div>
    );
  }

  function ToLag() {
    const [nederst, setNederst] = useState(true);
    const [øverst, setØverst] = useState(true);
    return nederst ? (
      <Lag navn="nederst" luk={() => setNederst(false)}>
        {øverst && <Lag navn="øverst" luk={() => setØverst(false)} />}
      </Lag>
    ) : null;
  }

  it('Escape lukker kun det øverste lag', async () => {
    tegn(<ToLag />);
    expect(screen.getAllByRole('dialog')).toHaveLength(2);
    // Det øverste lag har fokus — det nederste må ikke tage det tilbage.
    expect(screen.getByRole('button', { name: 'Knap i øverst' })).toHaveFocus();

    await userEvent.keyboard('{Escape}');
    expect(screen.queryByRole('dialog', { name: 'øverst' })).not.toBeInTheDocument();
    expect(screen.getByRole('dialog', { name: 'nederst' })).toBeInTheDocument();

    await userEvent.keyboard('{Escape}');
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });
});
