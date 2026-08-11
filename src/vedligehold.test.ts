import { describe, it, expect } from 'vitest';
import {
  VARSEL_DAGE,
  dageTilForfald,
  erForfalden,
  fjernHandling,
  forfaldne,
  forfaldstekst,
  laesMaaned,
  naesteGang,
  nyHandling,
  opdaterHandling,
  skrivMaaned,
  statustekst,
  tilfoejHandling
} from './vedligehold';
import type { Vedligehold } from './db';
import { lavItem } from './test/data';

const NU = new Date('2026-07-30T12:00:00');

const handling = (felter: Partial<Vedligehold> = {}): Vedligehold => ({
  id: 'h-1',
  navn: 'Imprægnering',
  sidst_udfoert: '08/2025',
  interval_maaneder: 12,
  noter: '',
  ...felter
});

describe('laesMaaned og skrivMaaned', () => {
  it('læser MM/ÅÅÅÅ', () => {
    const d = laesMaaned('08/2025');
    expect(d?.getFullYear()).toBe(2025);
    expect(d?.getMonth()).toBe(7);
  });

  it('afviser noget der ikke er en måned', () => {
    expect(laesMaaned('')).toBeNull();
    expect(laesMaaned('august 2025')).toBeNull();
    expect(laesMaaned('13/2025')).toBeNull();
    expect(laesMaaned('00/2025')).toBeNull();
    expect(laesMaaned('08/2025/01')).toBeNull();
  });

  it('skriver med nul foran', () => {
    expect(skrivMaaned(new Date(2026, 0, 15))).toBe('01/2026');
    expect(skrivMaaned(new Date(2026, 10, 1))).toBe('11/2026');
  });

  it('kan læse det den selv har skrevet', () => {
    const nu = new Date(2026, 6, 30);
    expect(laesMaaned(skrivMaaned(nu))?.getMonth()).toBe(6);
  });
});

describe('naesteGang', () => {
  it('lægger intervallet til den sidste gang', () => {
    const d = naesteGang(handling({ sidst_udfoert: '08/2025', interval_maaneder: 12 }));
    expect(skrivMaaned(d!)).toBe('08/2026');
  });

  it('klarer et interval der går over et årsskifte', () => {
    const d = naesteGang(handling({ sidst_udfoert: '11/2025', interval_maaneder: 6 }));
    expect(skrivMaaned(d!)).toBe('05/2026');
  });

  it('giver null når den aldrig er udført', () => {
    expect(naesteGang(handling({ sidst_udfoert: '' }))).toBeNull();
  });

  // Uden et interval er der ingenting at regne frem til.
  it('giver null uden et interval', () => {
    expect(naesteGang(handling({ interval_maaneder: 0 }))).toBeNull();
  });

  // Købsdatoer skrives DD/MM/ÅÅÅÅ andre steder i appen; den form skal også
  // kunne læses, så en indtastning ikke bare bliver tavst ignoreret.
  it('læser også en fuld dansk dato', () => {
    const d = naesteGang(handling({ sidst_udfoert: '15/08/2025', interval_maaneder: 12 }));
    expect(skrivMaaned(d!)).toBe('08/2026');
  });
});

describe('dageTilForfald og erForfalden', () => {
  it('tæller dage til næste gang', () => {
    // Sidst 08/2025 + 12 mdr = 01/08/2026, som er 2 dage efter NU.
    expect(dageTilForfald(handling(), NU)).toBe(2);
  });

  it('giver et negativt tal når fristen er passeret', () => {
    expect(dageTilForfald(handling({ sidst_udfoert: '01/2025' }), NU)).toBeLessThan(0);
  });

  // Imprægnering skal helst ske inden turen, ikke bagefter.
  it('varsler et stykke tid før forfald', () => {
    expect(erForfalden(handling(), NU)).toBe(true);
    expect(VARSEL_DAGE).toBeGreaterThan(0);
  });

  it('tier om noget der ligger langt ude i fremtiden', () => {
    expect(erForfalden(handling({ sidst_udfoert: '06/2026' }), NU)).toBe(false);
  });

  it('tier om noget der aldrig er udført', () => {
    expect(erForfalden(handling({ sidst_udfoert: '' }), NU)).toBe(false);
    expect(dageTilForfald(handling({ sidst_udfoert: '' }), NU)).toBeNull();
  });
});

describe('tekster', () => {
  it('skriver sidst og næste ud', () => {
    expect(statustekst(handling())).toBe('Sidst 08/2025 · næste 08/2026');
  });

  it('siger til når den aldrig er udført', () => {
    expect(statustekst(handling({ sidst_udfoert: '' }))).toBe('Aldrig udført');
  });

  it('nøjes med sidst når der ikke er et interval', () => {
    expect(statustekst(handling({ interval_maaneder: 0 }))).toBe('Sidst 08/2025');
  });

  it('måler forfald i dage, uger og måneder', () => {
    expect(forfaldstekst(3)).toBe('om 3 dage');
    expect(forfaldstekst(1)).toBe('om 1 dag');
    expect(forfaldstekst(21)).toBe('om 3 uger');
    expect(forfaldstekst(90)).toBe('om 3 måneder');
  });

  it('siger det ligeud når fristen er overskredet', () => {
    expect(forfaldstekst(0)).toBe('forfalder i dag');
    expect(forfaldstekst(-60)).toBe('overskredet med 2 måneder');
  });
});

describe('listen af handlinger', () => {
  it('lægger en til, retter i den, og fjerner den igen', () => {
    const item = lavItem();
    const en = tilfoejHandling(item, handling({ id: 'h-1' }));
    expect(en).toHaveLength(1);

    const rettet = opdaterHandling(en, 'h-1', { interval_maaneder: 6 });
    expect(rettet[0].interval_maaneder).toBe(6);

    expect(fjernHandling(rettet, 'h-1')).toEqual([]);
  });

  it('rører ikke de andre handlinger når én rettes', () => {
    const to = [handling({ id: 'h-1' }), handling({ id: 'h-2', navn: 'Slibning' })];
    expect(opdaterHandling(to, 'h-1', { navn: 'Nyt' })[1].navn).toBe('Slibning');
  });

  it('nyHandling giver hver sit id', () => {
    expect(nyHandling().id).not.toBe(nyHandling().id);
  });
});

describe('forfaldne', () => {
  it('samler alt der skal passes, det mest overskredne først', () => {
    const snart = lavItem({ navn: 'Tarp', vedligehold: [handling({ sidst_udfoert: '08/2025' })] });
    const bagud = lavItem({ navn: 'Økse', vedligehold: [handling({ navn: 'Slibning', sidst_udfoert: '01/2024' })] });

    const liste = forfaldne([snart, bagud], NU);

    expect(liste.map((f) => f.item.navn)).toEqual(['Økse', 'Tarp']);
  });

  it('tager alle handlinger med fra det samme item', () => {
    const item = lavItem({
      vedligehold: [
        handling({ id: 'h-1', sidst_udfoert: '08/2025' }),
        handling({ id: 'h-2', navn: 'Slibning', sidst_udfoert: '01/2025', interval_maaneder: 6 })
      ]
    });

    expect(forfaldne([item], NU)).toHaveLength(2);
  });

  // Noget man har solgt behøver man ikke imprægnere.
  it('rører ikke gear man ikke ejer', () => {
    const solgt = lavItem({ status: 'solgt', vedligehold: [handling({ sidst_udfoert: '01/2024' })] });
    expect(forfaldne([solgt], NU)).toEqual([]);
  });

  it('ser bort fra gear uden vedligehold', () => {
    expect(forfaldne([lavItem()], NU)).toEqual([]);
  });

  it('tier om det der ligger langt ude', () => {
    const item = lavItem({ vedligehold: [handling({ sidst_udfoert: '06/2026' })] });
    expect(forfaldne([item], NU)).toEqual([]);
  });
});
