import { describe, it, expect } from 'vitest';
import { minutterMellem, skumringsminutter, skumringstekst, soltider } from './soltider';

// København. Det sted flest kan slå efter i en almanak.
const KBH = { lat: 55.6761, lng: 12.5683 };
// Skagen — nordligste punkt, hvor forskellen på sommer og vinter er størst.
const SKAGEN = { lat: 57.7364, lng: 10.5896 };

// Klokkeslæt som minutter, så en afvigelse kan måles frem for sammenlignes.
function min(klokken: string): number {
  const [t, m] = klokken.split(':');
  return Number(t) * 60 + Number(m);
}

// Regnestykket rammer inden for et minut eller to. Testene tillader tre, så
// de ikke knækker af en afrunding — men ikke mere end det.
function taetPaa(faktisk: string, forventet: string, slup = 3) {
  expect(Math.abs(min(faktisk) - min(forventet))).toBeLessThanOrEqual(slup);
}

describe('soltider', () => {
  // Ved jævndøgn står solen op omkring klokken 6 i sand soltid overalt på
  // jorden. Det er den stærkeste prøve der findes på om regnestykket er
  // rigtigt, fordi den gælder uafhængigt af breddegrad.
  it('giver omtrent seks timer mellem opgang og middag ved jævndøgn', () => {
    for (const sted of [KBH, SKAGEN]) {
      const t = soltider('2026-03-20', sted.lat, sted.lng)!;
      const dagslys = minutterMellem(t.op, t.ned)!;

      // Tolv timer, plus det kvarter atmosfærens brydning lægger til.
      expect(dagslys).toBeGreaterThan(12 * 60);
      expect(dagslys).toBeLessThan(12 * 60 + 20);
    }
  });

  // Almanakværdier for København. Sommertid er gældende i juni.
  it('rammer sommersolhverv i København', () => {
    const t = soltider('2026-06-21', KBH.lat, KBH.lng)!;

    taetPaa(t.op, '04:25');
    taetPaa(t.ned, '21:58');
  });

  it('rammer vintersolhverv i København', () => {
    const t = soltider('2026-12-21', KBH.lat, KBH.lng)!;

    taetPaa(t.op, '08:37');
    taetPaa(t.ned, '15:38');
  });

  // Nord for København står solen op senere om vinteren og tidligere om
  // sommeren. Retningen skal være rigtig, også når minutterne er det.
  it('har længere sommerdag og kortere vinterdag jo længere mod nord', () => {
    const sommerKbh = soltider('2026-06-21', KBH.lat, KBH.lng)!;
    const sommerSkagen = soltider('2026-06-21', SKAGEN.lat, SKAGEN.lng)!;
    const vinterKbh = soltider('2026-12-21', KBH.lat, KBH.lng)!;
    const vinterSkagen = soltider('2026-12-21', SKAGEN.lat, SKAGEN.lng)!;

    expect(minutterMellem(sommerSkagen.op, sommerSkagen.ned)!)
      .toBeGreaterThan(minutterMellem(sommerKbh.op, sommerKbh.ned)!);
    expect(minutterMellem(vinterSkagen.op, vinterSkagen.ned)!)
      .toBeLessThan(minutterMellem(vinterKbh.op, vinterKbh.ned)!);
  });
});

describe('skumringen', () => {
  // Det er hele grunden til at feltet findes: solnedgang er ikke det samme
  // som mørkt, og forskellen er den tid man har til at få tarpen op.
  it('slutter efter solnedgang og begynder før solopgang', () => {
    const t = soltider('2026-09-15', KBH.lat, KBH.lng)!;

    expect(min(t.daggry)).toBeLessThan(min(t.op));
    expect(min(t.moerkt)).toBeGreaterThan(min(t.ned));
  });

  // Omkring jævndøgn er skumringen kortest i Danmark — omkring en halv time.
  // Om sommeren trækker den ud, fordi solen går fladere ned.
  it('varer længere om sommeren end ved jævndøgn', () => {
    const jaevndoegn = skumringsminutter(soltider('2026-09-23', KBH.lat, KBH.lng)!)!;
    const sommer = skumringsminutter(soltider('2026-06-21', KBH.lat, KBH.lng)!)!;

    expect(jaevndoegn).toBeGreaterThan(30);
    expect(jaevndoegn).toBeLessThan(45);
    expect(sommer).toBeGreaterThan(jaevndoegn);
  });

  it('regner rigtigt når skumringen går over midnat', () => {
    // 23.40 til 00.15 er 35 minutter, ikke minus 1405.
    expect(minutterMellem('23:40', '00:15')).toBe(35);
  });
});

describe('skumringstekst', () => {
  it('siger hvornår det er mørkt, og hvor længe efter solnedgang', () => {
    const t = soltider('2026-09-23', KBH.lat, KBH.lng)!;
    const tekst = skumringstekst(t);

    expect(tekst).toContain('Mørkt');
    expect(tekst).toMatch(/\d+ min efter solnedgang/);
  });

  // Nordnorge om sommeren. Sjældent, men ikke utænkeligt.
  it('siger det ligeud når solen ikke går ned', () => {
    const t = soltider('2026-06-21', 70, 25)!;
    expect(skumringstekst(t)).toBe('Solen står ikke op eller ned det døgn.');
  });
});

describe('robusthed', () => {
  it('giver intet for en dato der ikke er en dato', () => {
    expect(soltider('vrøvl', KBH.lat, KBH.lng)).toBeNull();
    expect(soltider('', KBH.lat, KBH.lng)).toBeNull();
  });

  it('giver tomme klokkeslæt frem for at kaste under mørketid', () => {
    const t = soltider('2026-12-21', 78, 15)!;
    expect(t.op).toBe('');
    expect(t.ned).toBe('');
  });
});
