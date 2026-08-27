import { describe, it, expect } from 'vitest';
import { gyldig, vurderingAf, erGodtVurderet, gennemsnit, snittekst, GODT } from './vurdering';
import { lavItem } from './test/data';

describe('gyldig', () => {
  it('tager de fem trin på skalaen', () => {
    expect([1, 2, 3, 4, 5].map(gyldig)).toEqual([1, 2, 3, 4, 5]);
  });

  it('afviser hvad der ligger uden for skalaen', () => {
    expect(gyldig(0)).toBeNull();
    expect(gyldig(6)).toBeNull();
    expect(gyldig(-3)).toBeNull();
  });

  it('afviser det der slet ikke er et tal', () => {
    // Sync og import kan levere hvad som helst.
    expect(gyldig(null)).toBeNull();
    expect(gyldig(undefined)).toBeNull();
    expect(gyldig('4')).toBeNull();
    expect(gyldig(NaN)).toBeNull();
    expect(gyldig(Infinity)).toBeNull();
  });

  it('runder et halvt trin til nærmeste', () => {
    expect(gyldig(3.4)).toBe(3);
    expect(gyldig(3.6)).toBe(4);
  });
});

describe('vurderingAf', () => {
  it('læser et item fra før feltet fandtes som uvurderet', () => {
    const gammelt = lavItem();
    delete (gammelt as { vurdering?: number | null }).vurdering;

    expect(vurderingAf(gammelt)).toBeNull();
  });
});

describe('erGodtVurderet', () => {
  it('går ved grænsen og ikke kun ved topkarakteren', () => {
    expect(erGodtVurderet(lavItem({ vurdering: GODT }))).toBe(true);
    expect(erGodtVurderet(lavItem({ vurdering: 5 }))).toBe(true);
    expect(erGodtVurderet(lavItem({ vurdering: GODT - 1 }))).toBe(false);
  });

  it('regner ikke uvurderet som dårligt vurderet', () => {
    // De fleste ting bliver aldrig vurderet. Det er ikke en dom.
    expect(erGodtVurderet(lavItem({ vurdering: null }))).toBe(false);
  });
});

describe('gennemsnit', () => {
  it('regner snittet og siger hvor mange der ligger bag', () => {
    const items = [4, 5, 5].map((v) => lavItem({ vurdering: v }));
    expect(gennemsnit(items)).toEqual({ snit: 4.7, antal: 3 });
  });

  it('tæller ikke det uvurderede med som nuller', () => {
    const items = [lavItem({ vurdering: 5 }), lavItem({ vurdering: null }), lavItem({ vurdering: null })];
    expect(gennemsnit(items)).toEqual({ snit: 5, antal: 1 });
  });

  it('giver null når intet er vurderet', () => {
    expect(gennemsnit([lavItem({ vurdering: null })])).toBeNull();
    expect(gennemsnit([])).toBeNull();
  });

  it('runder til én decimal — skalaen har fem trin, ikke halvtreds', () => {
    const items = [1, 2].map((v) => lavItem({ vurdering: v }));
    expect(gennemsnit(items)?.snit).toBe(1.5);
  });
});

describe('snittekst', () => {
  it('skriver tallet på dansk', () => {
    expect(snittekst({ snit: 4.6, antal: 12 })).toBe('4,6 / 5');
    expect(snittekst({ snit: 5, antal: 1 })).toBe('5,0 / 5');
  });
});
