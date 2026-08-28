import { describe, it, expect } from 'vitest';
import { foreslaaFordeling, anvendFordeling, spredning, navnFor, MINDSTE_GEVINST_G } from './fordeling';
import { lavItem, lavTur } from './test/data';
import type { Deltager, Item, Tur } from './db';

function deltager(navn: string, felter: Partial<Deltager> = {}): Deltager {
  return {
    id: navn.toLowerCase(),
    navn,
    overnatning: null,
    personligt_gear_ids: [],
    baerer_delt_ids: [],
    person_uid: '',
    ...felter
  };
}

// Turen sætter items på som løse, så pakItems og turen er enige om, hvad der
// er med.
function tur(deltagere: Deltager[], items: Item[]): Tur {
  return lavTur({ personer: deltagere.length, deltagere, loese_item_ids: items.map((i) => i.uid) });
}

describe('spredning', () => {
  it('er forskellen mellem den tungeste og den letteste', () => {
    expect(spredning([1000, 4000, 2000])).toBe(3000);
  });

  it('er nul uden nogen', () => {
    expect(spredning([])).toBe(0);
  });
});

describe('foreslaaFordeling', () => {
  it('foreslår ingenting med under to deltagere', () => {
    const telt = lavItem({ navn: 'Telt', vaegt_g: 3000, delt: true });
    expect(foreslaaFordeling(tur([deltager('Emil')], [telt]), [telt])).toBeNull();
  });

  it('foreslår ingenting uden fælles grej', () => {
    const pose = lavItem({ navn: 'Sovepose', vaegt_g: 1200 });
    const t = tur([deltager('Emil', { personligt_gear_ids: [pose.uid] }), deltager('Jakob')], [pose]);
    expect(foreslaaFordeling(t, [pose])).toBeNull();
  });

  it('flytter fælles grej fra den tungeste til den letteste', () => {
    const telt = lavItem({ navn: 'Telt', vaegt_g: 3000, delt: true });
    const kogegrej = lavItem({ navn: 'Kogegrej', vaegt_g: 800, delt: true });
    const t = tur(
      [deltager('Emil', { baerer_delt_ids: [telt.uid, kogegrej.uid] }), deltager('Jakob')],
      [telt, kogegrej]
    );

    const forslag = foreslaaFordeling(t, [telt, kogegrej]);
    expect(forslag).not.toBeNull();
    expect(forslag!.spredning_foer_g).toBe(3800);
    expect(forslag!.spredning_efter_g).toBe(2200);
    // Teltet bliver, hvor det er: Emil bærer det i forvejen, og at bytte de
    // to rundt ville give præcis den samme spredning.
    expect(forslag!.flytninger).toHaveLength(1);
    expect(forslag!.flytninger[0].item.navn).toBe('Kogegrej');
    expect(navnFor(t, forslag!.flytninger[0].fra)).toBe('Emil');
    expect(navnFor(t, forslag!.flytninger[0].til)).toBe('Jakob');
  });

  it('regner det personlige grej med, men flytter det ikke', () => {
    const tung = lavItem({ navn: 'Kamera', vaegt_g: 2000 });
    const telt = lavItem({ navn: 'Telt', vaegt_g: 2000, delt: true });
    const t = tur(
      [
        deltager('Emil', { personligt_gear_ids: [tung.uid], baerer_delt_ids: [telt.uid] }),
        deltager('Jakob')
      ],
      [tung, telt]
    );

    const forslag = foreslaaFordeling(t, [tung, telt])!;
    // Kameraet bliver hos Emil; kun teltet flytter.
    expect(forslag.flytninger.map((f) => f.item.navn)).toEqual(['Telt']);
    expect(forslag.linjer.find((l) => l.navn === 'Emil')!.efter_g).toBe(2000);
    expect(forslag.linjer.find((l) => l.navn === 'Jakob')!.efter_g).toBe(2000);
  });

  it('fordeler også det som ingen har taget endnu', () => {
    const telt = lavItem({ navn: 'Telt', vaegt_g: 3000, delt: true });
    const t = tur([deltager('Emil'), deltager('Jakob')], [telt]);

    const forslag = foreslaaFordeling(t, [telt])!;
    expect(forslag.flytninger[0].fra).toBeNull();
    expect(navnFor(t, forslag.flytninger[0].fra)).toBe('Ingen');
    expect(forslag.ufordelt_antal).toBe(1);
    expect(forslag.ufordelt_g).toBe(3000);
  });

  // Ingen bar teltet før, så spredningen var nul. Den stiger, når det bliver
  // fordelt — og det er ikke en forværring: vægten var der hele tiden.
  it('siger til om ufordelt grej, også når spredningen stiger af det', () => {
    const telt = lavItem({ navn: 'Telt', vaegt_g: 3000, delt: true });
    const t = tur([deltager('Emil'), deltager('Jakob')], [telt]);

    const forslag = foreslaaFordeling(t, [telt])!;
    expect(forslag.spredning_foer_g).toBe(0);
    expect(forslag.spredning_efter_g).toBe(3000);
    expect(forslag.begrundelse).toContain('ingen bærer endnu');
  });

  it('lader være når fordelingen allerede er jævn', () => {
    const a = lavItem({ navn: 'Telt', vaegt_g: 2000, delt: true });
    const b = lavItem({ navn: 'Tarp', vaegt_g: 2000, delt: true });
    const t = tur(
      [deltager('Emil', { baerer_delt_ids: [a.uid] }), deltager('Jakob', { baerer_delt_ids: [b.uid] })],
      [a, b]
    );

    expect(foreslaaFordeling(t, [a, b])).toBeNull();
  });

  it('bytter ikke rundt for en gevinst man ikke mærker', () => {
    const a = lavItem({ navn: 'Telt', vaegt_g: 2000, delt: true });
    const b = lavItem({ navn: 'Tarp', vaegt_g: 2000 - MINDSTE_GEVINST_G, delt: true });
    const t = tur(
      [deltager('Emil', { baerer_delt_ids: [a.uid] }), deltager('Jakob', { baerer_delt_ids: [b.uid] })],
      [a, b]
    );

    // Spredningen er MINDSTE_GEVINST_G og kan ikke gøres mindre — der er
    // ingenting at foreslå.
    expect(foreslaaFordeling(t, [a, b])).toBeNull();
  });

  it('giver det samme svar to gange i træk', () => {
    const items = [3000, 2600, 2200, 1800, 900, 400].map((v, n) =>
      lavItem({ navn: `Ting ${n}`, vaegt_g: v, delt: true })
    );
    const t = tur([deltager('Emil', { baerer_delt_ids: items.map((i) => i.uid) }), deltager('Jakob'), deltager('Sofie')], items);

    const a = foreslaaFordeling(t, items)!;
    const b = foreslaaFordeling(t, items)!;
    expect(a.flytninger.map((f) => [f.item.uid, f.til])).toEqual(b.flytninger.map((f) => [f.item.uid, f.til]));
  });

  it('fordeler på tre nogenlunde jævnt', () => {
    const items = [3000, 2600, 2200, 1800, 900, 400].map((v, n) =>
      lavItem({ navn: `Ting ${n}`, vaegt_g: v, delt: true })
    );
    const t = tur([deltager('Emil', { baerer_delt_ids: items.map((i) => i.uid) }), deltager('Jakob'), deltager('Sofie')], items);

    const forslag = foreslaaFordeling(t, items)!;
    expect(forslag.spredning_foer_g).toBe(10900);
    // 10,9 kg fordelt på tre kan ikke blive helt lige, men skal blive tæt på.
    expect(forslag.spredning_efter_g).toBeLessThanOrEqual(1000);
  });
});

describe('anvendFordeling', () => {
  it('skriver flytningerne ind på deltagerne', () => {
    const telt = lavItem({ navn: 'Telt', vaegt_g: 3000, delt: true });
    const kogegrej = lavItem({ navn: 'Kogegrej', vaegt_g: 800, delt: true });
    const t = tur(
      [deltager('Emil', { baerer_delt_ids: [telt.uid, kogegrej.uid] }), deltager('Jakob')],
      [telt, kogegrej]
    );

    const forslag = foreslaaFordeling(t, [telt, kogegrej])!;
    const { deltagere } = anvendFordeling(t, forslag);

    expect(deltagere![0].baerer_delt_ids).toEqual([telt.uid]);
    expect(deltagere![1].baerer_delt_ids).toEqual([kogegrej.uid]);
  });

  it('lader det personlige grej være i fred', () => {
    const eget = lavItem({ navn: 'Sovepose', vaegt_g: 1200 });
    const telt = lavItem({ navn: 'Telt', vaegt_g: 3000, delt: true });
    const t = tur(
      [
        deltager('Emil', { personligt_gear_ids: [eget.uid], baerer_delt_ids: [telt.uid] }),
        deltager('Jakob')
      ],
      [eget, telt]
    );

    const forslag = foreslaaFordeling(t, [eget, telt])!;
    const { deltagere } = anvendFordeling(t, forslag);
    expect(deltagere![0].personligt_gear_ids).toEqual([eget.uid]);
    expect(deltagere![1].personligt_gear_ids).toEqual([]);
  });

  it('rører ikke fælles grej som forslaget ikke nævner', () => {
    const telt = lavItem({ navn: 'Telt', vaegt_g: 3000, delt: true });
    const oekse = lavItem({ navn: 'Økse', vaegt_g: 1000, delt: true });
    const t = tur(
      [deltager('Emil', { baerer_delt_ids: [telt.uid] }), deltager('Jakob', { baerer_delt_ids: [oekse.uid] })],
      [telt, oekse]
    );

    const forslag = foreslaaFordeling(t, [telt, oekse]);
    // 3,0 mod 1,0 kg: teltet og øksen bytter ikke plads, for det ville give
    // den samme spredning. Der er intet forslag.
    expect(forslag).toBeNull();
  });

  it('bevarer hver flyttet ting hos præcis én', () => {
    const items = [3000, 2600, 2200, 1800, 900, 400].map((v, n) =>
      lavItem({ navn: `Ting ${n}`, vaegt_g: v, delt: true })
    );
    const t = tur([deltager('Emil', { baerer_delt_ids: items.map((i) => i.uid) }), deltager('Jakob'), deltager('Sofie')], items);

    const { deltagere } = anvendFordeling(t, foreslaaFordeling(t, items)!);
    const alle = deltagere!.flatMap((d) => d.baerer_delt_ids);
    expect(alle).toHaveLength(items.length);
    expect(new Set(alle).size).toBe(items.length);
  });
});
