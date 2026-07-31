import { describe, it, expect } from 'vitest';
import {
  lavSikkerhedskopi,
  tilJson,
  laesSikkerhedskopi,
  fletInd,
  filnavn,
  KopiFejl,
  KOPI_VERSION
} from './dataudveksling';
import { lavItem, lavGruppe, lavTur } from './test/data';

const tomBase = { items: [], grupper: [], ture: [] };

describe('lavSikkerhedskopi', () => {
  it('tager alle tre tabeller med', () => {
    const kopi = lavSikkerhedskopi([lavItem()], [lavGruppe()], [lavTur(), lavTur()]);

    expect(kopi.version).toBe(KOPI_VERSION);
    expect(kopi.items).toHaveLength(1);
    expect(kopi.grupper).toHaveLength(1);
    expect(kopi.ture).toHaveLength(2);
  });

  // id er lokalt for enheden, og pb_id peger på en record der måske er væk.
  it('lader lokale id\'er og pb_id blive hjemme, men beholder uid', () => {
    const item = lavItem({ id: 7, uid: 'u-1', pb_id: 'pbXYZ' });

    const [gemt] = lavSikkerhedskopi([item], [], []).items;

    expect(gemt.uid).toBe('u-1');
    expect('id' in gemt).toBe(false);
    expect('pb_id' in gemt).toBe(false);
  });

  it('rører ikke posterne den får ind', () => {
    const item = lavItem({ id: 7, pb_id: 'pbXYZ' });
    lavSikkerhedskopi([item], [], []);
    expect(item.id).toBe(7);
    expect(item.pb_id).toBe('pbXYZ');
  });
});

describe('en kopi kan læses tilbage', () => {
  it('overlever turen gennem JSON', () => {
    const item = lavItem({ uid: 'u-1', navn: 'Moonquilt', vaegt_g: 780, tags: ['søvn'] });
    const tur = lavTur({ uid: 'u-tur', navn: 'Rold Skov', loese_item_ids: ['u-1'] });

    const tilbage = laesSikkerhedskopi(tilJson(lavSikkerhedskopi([item], [], [tur])));

    expect(tilbage.items[0].navn).toBe('Moonquilt');
    expect(tilbage.items[0].vaegt_g).toBe(780);
    expect(tilbage.items[0].tags).toEqual(['søvn']);
    expect(tilbage.ture[0].loese_item_ids).toEqual(['u-1']);
  });

  // JSON har ingen datotype, så de kommer ud som tekst.
  it('gør datoerne til Date igen', () => {
    const item = lavItem({ oprettet: new Date('2026-03-01T10:00:00Z') });

    const tilbage = laesSikkerhedskopi(tilJson(lavSikkerhedskopi([item], [], [])));

    expect(tilbage.items[0].oprettet).toBeInstanceOf(Date);
    expect(tilbage.items[0].oprettet.toISOString()).toBe('2026-03-01T10:00:00.000Z');
  });
});

describe('laesSikkerhedskopi afviser det den ikke kan bruge', () => {
  it('siger fra ved ugyldig JSON', () => {
    expect(() => laesSikkerhedskopi('ikke json')).toThrow(KopiFejl);
  });

  it('siger fra ved JSON der ikke er en kopi', () => {
    expect(() => laesSikkerhedskopi('[1,2,3]')).toThrow(KopiFejl);
    expect(() => laesSikkerhedskopi('{"noget":"andet"}')).toThrow(KopiFejl);
  });

  it('siger fra ved en nyere kopiversion', () => {
    const nyere = JSON.stringify({ version: KOPI_VERSION + 1, items: [], grupper: [], ture: [] });
    expect(() => laesSikkerhedskopi(nyere)).toThrow(/nyere version/);
  });

  it('springer poster over der mangler uid, i stedet for at vælte importen', () => {
    const blandet = JSON.stringify({
      version: KOPI_VERSION,
      items: [{ uid: 'u-god', navn: 'God' }, { navn: 'Uden uid' }, null, 'volapyk'],
      grupper: [],
      ture: []
    });

    expect(laesSikkerhedskopi(blandet).items.map((i) => i.navn)).toEqual(['God']);
  });

  it('klarer at en tabel mangler helt', () => {
    const kopi = laesSikkerhedskopi(JSON.stringify({ version: KOPI_VERSION, items: [lavItem()] }));
    expect(kopi.grupper).toEqual([]);
    expect(kopi.ture).toEqual([]);
  });
});

describe('fletInd', () => {
  it('lægger nye poster til', () => {
    const kopi = lavSikkerhedskopi([lavItem({ uid: 'u-1' }), lavItem({ uid: 'u-2' })], [], []);

    const flettet = fletInd(kopi, tomBase);

    expect(flettet.tilfoejet).toBe(2);
    expect(flettet.fandtes).toBe(0);
    expect(flettet.items.map((i) => i.uid)).toEqual(['u-1', 'u-2']);
  });

  // Den samme kopi skal kunne læses ind to gange uden at fordoble noget.
  it('springer poster over der allerede findes', () => {
    const kopi = lavSikkerhedskopi([lavItem({ uid: 'u-1' }), lavItem({ uid: 'u-2' })], [], []);

    const flettet = fletInd(kopi, { ...tomBase, items: [lavItem({ uid: 'u-1' })] });

    expect(flettet.tilfoejet).toBe(1);
    expect(flettet.fandtes).toBe(1);
    expect(flettet.items.map((i) => i.uid)).toEqual(['u-2']);
  });

  it('overskriver ikke en lokal post der er redigeret siden', () => {
    const lokal = lavItem({ uid: 'u-1', navn: 'Nyt navn' });
    const kopi = lavSikkerhedskopi([lavItem({ uid: 'u-1', navn: 'Gammelt navn' })], [], []);

    fletInd(kopi, { ...tomBase, items: [lokal] });

    expect(lokal.navn).toBe('Nyt navn');
  });

  it('lader ikke dubletter i selve kopien slippe igennem', () => {
    const kopi = lavSikkerhedskopi([lavItem({ uid: 'u-1' }), lavItem({ uid: 'u-1' })], [], []);

    expect(fletInd(kopi, tomBase).items).toHaveLength(1);
  });

  // Uden pb_id findes posterne ikke på serveren og skal sendes op.
  it('markerer det importerede som usendt', () => {
    const kopi = lavSikkerhedskopi([lavItem({ uid: 'u-1' })], [lavGruppe({ uid: 'g-1' })], [lavTur({ uid: 't-1' })]);

    const flettet = fletInd(kopi, tomBase);

    expect(flettet.items[0].usendt_aendring).toBe(true);
    expect(flettet.grupper[0].usendt_aendring).toBe(true);
    expect(flettet.ture[0].usendt_aendring).toBe(true);
  });

  it('holder de tre tabeller adskilt', () => {
    // Samme uid i to tabeller må ikke skygge for hinanden.
    const kopi = lavSikkerhedskopi([lavItem({ uid: 'delt' })], [lavGruppe({ uid: 'delt' })], []);

    const flettet = fletInd(kopi, tomBase);

    expect(flettet.items).toHaveLength(1);
    expect(flettet.grupper).toHaveLength(1);
  });
});

describe('filnavn', () => {
  it('sætter dato på med nul foran', () => {
    expect(filnavn(new Date(2026, 6, 5))).toBe('feltbogen-2026-07-05.json');
    expect(filnavn(new Date(2026, 11, 31))).toBe('feltbogen-2026-12-31.json');
  });
});
