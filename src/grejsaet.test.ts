import { describe, it, expect } from 'vitest';
import {
  saetindhold, vaegttekst, delingstekst, sidstBrugtPrSaet, brugttekst, saetlinje,
  indlaesning, indlaesningstekst, medSaet, saetFraTur, tureTilValg, turlinje, turnavn
} from './grejsaet';
import { lavItem, lavGruppe, lavTur } from './test/data';

// ─────────────────────────────────────────────
// Grejsæt
//
// Regnestykkerne bag skærmen. Det vigtigste er `indlaesning`: den skal kunne
// sige, hvad der sker med turen, *før* man trykker — ellers er "Brug på tur"
// en stille overskrivning, og det er præcis det, handoff'en forbyder.
// ─────────────────────────────────────────────

const tarp = lavItem({ uid: 'i-tarp', navn: 'Tarp 3×3', vaegt_g: 890, delt: true });
const koekken = lavItem({ uid: 'i-koekken', navn: 'Stormkøkken', vaegt_g: 1200, delt: true });
const sovepose = lavItem({ uid: 'i-sovepose', navn: 'Sovepose −5°', vaegt_g: 1400, delt: false });
const lampe = lavItem({ uid: 'i-lampe', navn: 'Hovedlampe', vaegt_g: 95, delt: false });
const ALLE = [tarp, koekken, sovepose, lampe];

describe('saetindhold', () => {
  it('tæller og vejer det grej, sættet peger på', () => {
    const saet = lavGruppe({ item_ids: ['i-tarp', 'i-koekken'] });
    const indhold = saetindhold(saet, ALLE);

    expect(indhold.antal).toBe(2);
    expect(indhold.vaegt_g).toBe(2090);
    expect(indhold.items.map((i) => i.navn)).toEqual(['Tarp 3×3', 'Stormkøkken']);
  });

  it('tæller ikke grej, der ikke findes længere', () => {
    // Slettes et stykke grej på en anden enhed, bliver uid'et stående i
    // sættet. Antallet må ikke love mere, end der er.
    const saet = lavGruppe({ item_ids: ['i-tarp', 'i-vaek'] });

    expect(saetindhold(saet, ALLE).antal).toBe(1);
  });

  it('er tomt for et tomt sæt', () => {
    expect(saetindhold(lavGruppe(), ALLE)).toMatchObject({ antal: 0, vaegt_g: 0 });
  });
});

describe('vaegttekst', () => {
  it('skriver gram under kiloet', () => {
    expect(vaegttekst(890)).toBe('890 g');
    expect(vaegttekst(95)).toBe('95 g');
  });

  it('skriver kilo fra kiloet og op, med dansk komma', () => {
    expect(vaegttekst(1200)).toBe('1,2 kg');
    expect(vaegttekst(1000)).toBe('1 kg');
  });
});

describe('delingstekst', () => {
  it('siger fælles om delt grej og personligt om resten', () => {
    expect(delingstekst(tarp)).toBe('fælles');
    expect(delingstekst(sovepose)).toBe('personligt');
  });
});

describe('sidstBrugtPrSaet', () => {
  it('finder turen med den nyeste startdato', () => {
    const ture = [
      lavTur({ navn: 'Fovslet Skov', startdato: '2026-08-01', gruppe_ids: ['g-1'] }),
      lavTur({ navn: 'Øghaven', startdato: '2026-05-01', gruppe_ids: ['g-1'] })
    ];

    expect(sidstBrugtPrSaet(ture).get('g-1')?.navn).toBe('Fovslet Skov');
  });

  it('kender ikke et sæt, der aldrig har været med', () => {
    const ture = [lavTur({ gruppe_ids: ['g-1'] })];

    expect(sidstBrugtPrSaet(ture).get('g-2')).toBeUndefined();
    expect(brugttekst(undefined)).toBe('aldrig brugt på tur');
  });

  it('springer ture uden startdato over — de kan ikke placeres i tid', () => {
    const ture = [lavTur({ navn: 'Uden dato', startdato: '', gruppe_ids: ['g-1'] })];

    expect(sidstBrugtPrSaet(ture).get('g-1')).toBeUndefined();
  });
});

describe('saetlinje', () => {
  it('er antal, vægt og hvornår sættet sidst var med', () => {
    const saet = lavGruppe({ item_ids: ['i-tarp', 'i-koekken', 'i-sovepose'] });
    const tur = lavTur({ navn: 'Fovslet Skov' });

    expect(saetlinje(saetindhold(saet, ALLE), tur)).toBe('3 ting · 3,5 kg · brugt på Fovslet Skov');
  });

  it('siger det ligeud, når sættet aldrig har været med', () => {
    const saet = lavGruppe({ item_ids: ['i-lampe'] });

    expect(saetlinje(saetindhold(saet, ALLE), undefined)).toBe('1 ting · 0,1 kg · aldrig brugt på tur');
  });
});

describe('indlaesning', () => {
  const saet = lavGruppe({ uid: 'g-bushcraft', item_ids: ['i-tarp', 'i-koekken', 'i-sovepose'] });

  it('lægger hele sættet til en tom tur', () => {
    const tur = lavTur();
    const i = indlaesning(tur, saet, [saet], ALLE);

    expect(i).toMatchObject({ iSaettet: 3, nye: 3, dubletter: 0, foer: 0, efter: 3, alleredePaaTuren: false });
  });

  it('tæller grej, turen har som løst grej, som dublet', () => {
    const tur = lavTur({ loese_item_ids: ['i-tarp', 'i-lampe'] });
    const i = indlaesning(tur, saet, [saet], ALLE);

    // Tarp er i begge. Turen går fra 2 til 4 ting, ikke fra 2 til 5.
    expect(i).toMatchObject({ iSaettet: 3, nye: 2, dubletter: 1, foer: 2, efter: 4 });
  });

  it('tæller grej, turen har via et andet sæt, som dublet', () => {
    const andet = lavGruppe({ uid: 'g-andet', item_ids: ['i-koekken'] });
    const tur = lavTur({ gruppe_ids: ['g-andet'] });
    const i = indlaesning(tur, saet, [saet, andet], ALLE);

    expect(i).toMatchObject({ nye: 2, dubletter: 1, foer: 1, efter: 3 });
  });

  it('ser, når sættet allerede ligger på turen', () => {
    const tur = lavTur({ gruppe_ids: ['g-bushcraft'] });

    expect(indlaesning(tur, saet, [saet], ALLE).alleredePaaTuren).toBe(true);
  });

  it('tæller ikke grej, der ikke findes længere', () => {
    const halvt = lavGruppe({ uid: 'g-halvt', item_ids: ['i-tarp', 'i-vaek'] });

    expect(indlaesning(lavTur(), halvt, [halvt], ALLE)).toMatchObject({ iSaettet: 1, nye: 1 });
  });
});

describe('indlaesningstekst', () => {
  const grund = { iSaettet: 8, nye: 8, dubletter: 0, foer: 12, efter: 20, alleredePaaTuren: false };

  it('siger hvad turen går fra og til', () => {
    expect(indlaesningstekst(grund)).toBe('Turen går fra 12 til 20 ting.');
  });

  it('nævner dubletterne, så det er tydeligt at de ikke lægges til to gange', () => {
    const tekst = indlaesningstekst({ ...grund, nye: 6, dubletter: 2, efter: 18 });

    expect(tekst).toContain('2 af sættets ting er allerede på turen');
    expect(tekst).toContain('Turen går fra 12 til 18 ting.');
  });

  it('siger det, når hele sættet allerede er på turen som løst grej', () => {
    expect(indlaesningstekst({ ...grund, nye: 0, dubletter: 8, efter: 12 }))
      .toContain('Alle 8 ting er allerede på turen');
  });

  it('siger det, når sættet allerede er lagt på turen', () => {
    expect(indlaesningstekst({ ...grund, alleredePaaTuren: true }))
      .toBe('Sættet ligger allerede på turen. Der er ikke noget at lægge til.');
  });

  it('siger det, når sættet er tomt', () => {
    expect(indlaesningstekst({ ...grund, iSaettet: 0, nye: 0 })).toContain('Sættet er tomt');
  });
});

describe('medSaet', () => {
  const saet = lavGruppe({ uid: 'g-1' });

  it('lægger sættet på turen', () => {
    expect(medSaet(lavTur({ gruppe_ids: ['g-andet'] }), saet)).toEqual(['g-andet', 'g-1']);
  });

  it('lægger ikke det samme sæt på to gange', () => {
    expect(medSaet(lavTur({ gruppe_ids: ['g-1'] }), saet)).toEqual(['g-1']);
  });
});

describe('saetFraTur', () => {
  it('samler både løst grej og grej fra turens sæt', () => {
    const paaTuren = lavGruppe({ uid: 'g-paa', item_ids: ['i-tarp', 'i-koekken'] });
    const tur = lavTur({ gruppe_ids: ['g-paa'], loese_item_ids: ['i-lampe'] });

    expect(saetFraTur(tur, [paaTuren], ALLE).sort()).toEqual(['i-koekken', 'i-lampe', 'i-tarp']);
  });

  it('er tom for en tur uden grej', () => {
    expect(saetFraTur(lavTur(), [], ALLE)).toEqual([]);
  });
});

describe('tureTilValg', () => {
  it('sætter de afsluttede sidst og de nyeste øverst', () => {
    const ture = [
      lavTur({ navn: 'Gammel', status: 'afsluttet', startdato: '2026-01-01' }),
      lavTur({ navn: 'Næste', status: 'klar', startdato: '2026-09-01' }),
      lavTur({ navn: 'Kladde', status: 'kladde', startdato: '2026-10-01' })
    ];

    expect(tureTilValg(ture).map((t) => t.navn)).toEqual(['Kladde', 'Næste', 'Gammel']);
  });

  it('rører ikke listen, den fik', () => {
    const ture = [lavTur({ navn: 'A', startdato: '2026-01-01' }), lavTur({ navn: 'B', startdato: '2026-09-01' })];
    tureTilValg(ture);

    expect(ture.map((t) => t.navn)).toEqual(['A', 'B']);
  });
});

describe('turlinje', () => {
  it('skriver navn og fase med turfasens egne ord', () => {
    expect(turlinje(lavTur({ navn: 'Fovslet Skov', status: 'klar' }))).toBe('Fovslet Skov · Klar');
    expect(turlinje(lavTur({ navn: 'Øghaven', status: 'aktiv' }))).toBe('Øghaven · På tur');
  });

  it('kalder en navnløs tur noget, man kan pege på', () => {
    expect(turnavn(lavTur({ navn: '  ' }))).toBe('Uden navn');
  });
});
