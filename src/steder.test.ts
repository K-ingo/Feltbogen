import { describe, it, expect } from 'vitest';
import {
  afstandKm,
  besoegPrSted,
  besoegstekst,
  foreslaaSteder,
  naermesteSted,
  stedForTur,
  turePaaSted
} from './steder';
import { lavSted, lavTur } from './test/data';

const ROLD = { lat: 56.83, lng: 9.85 };

describe('turePaaSted', () => {
  it('finder turene der er knyttet til stedet, nyeste først', () => {
    const ture = [
      lavTur({ navn: 'Gammel', sted_uid: 's-1', startdato: '2025-05-01' }),
      lavTur({ navn: 'Ny', sted_uid: 's-1', startdato: '2026-05-01' }),
      lavTur({ navn: 'Andet sted', sted_uid: 's-2', startdato: '2026-06-01' })
    ];

    expect(turePaaSted(ture, 's-1').map((t) => t.navn)).toEqual(['Ny', 'Gammel']);
  });

  // Fritekst siger ingenting om hvor man var — kun koblingen tæller.
  it('tæller ikke ture der kun har stedet som fritekst', () => {
    const ture = [lavTur({ sted: 'Rold Skov', sted_uid: '' })];
    expect(turePaaSted(ture, 's-1')).toEqual([]);
  });
});

describe('besoegPrSted', () => {
  it('tæller besøg pr. sted', () => {
    const ture = [
      lavTur({ sted_uid: 's-1' }),
      lavTur({ sted_uid: 's-1' }),
      lavTur({ sted_uid: 's-2' }),
      lavTur({ sted_uid: '' })
    ];

    const antal = besoegPrSted(ture);

    expect(antal.get('s-1')).toBe(2);
    expect(antal.get('s-2')).toBe(1);
    expect(antal.has('')).toBe(false);
  });
});

describe('besoegstekst', () => {
  it('bøjer gang og gange', () => {
    expect(besoegstekst(0)).toBe('Aldrig været her');
    expect(besoegstekst(1)).toBe('Været her 1 gang');
    expect(besoegstekst(3)).toBe('Været her 3 gange');
  });
});

describe('stedForTur', () => {
  it('slår stedet op på turens kobling', () => {
    const sted = lavSted({ uid: 's-1', navn: 'Rold Skov' });
    expect(stedForTur(lavTur({ sted_uid: 's-1' }), [sted])?.navn).toBe('Rold Skov');
  });

  it('giver null når turen ikke er koblet, eller stedet er slettet', () => {
    expect(stedForTur(lavTur({ sted_uid: '' }), [lavSted({ uid: 's-1' })])).toBeNull();
    expect(stedForTur(lavTur({ sted_uid: 's-væk' }), [lavSted({ uid: 's-1' })])).toBeNull();
  });
});

describe('foreslaaSteder', () => {
  const rold = lavSted({ uid: 's-1', navn: 'Rold Skov' });
  const feddet = lavSted({ uid: 's-2', navn: 'Feddet' });
  const steder = [rold, feddet];

  it('matcher på navn uden hensyn til store bogstaver', () => {
    expect(foreslaaSteder(steder, [], 'rold').map((s) => s.navn)).toEqual(['Rold Skov']);
  });

  it('matcher også på adressen', () => {
    const medAdresse = lavSted({ navn: 'Sheltret', adresse: 'Rebild Skovhusevej' });
    expect(foreslaaSteder([medAdresse], [], 'rebild')).toHaveLength(1);
  });

  // Det sted man kommer mest, er det man leder efter.
  it('sætter de mest besøgte steder øverst', () => {
    const ture = [lavTur({ sted_uid: 's-2' }), lavTur({ sted_uid: 's-2' }), lavTur({ sted_uid: 's-1' })];
    const begge = [lavSted({ uid: 's-1', navn: 'Skoven nord' }), lavSted({ uid: 's-2', navn: 'Skoven syd' })];

    expect(foreslaaSteder(begge, ture, 'skoven').map((s) => s.navn)).toEqual(['Skoven syd', 'Skoven nord']);
  });

  it('foreslår ingenting på en tom søgning', () => {
    expect(foreslaaSteder(steder, [], '')).toEqual([]);
    expect(foreslaaSteder(steder, [], '   ')).toEqual([]);
  });

  it('holder listen kort nok til at være et forslag', () => {
    const mange = Array.from({ length: 12 }, (_, n) => lavSted({ navn: `Shelter ${n}` }));
    expect(foreslaaSteder(mange, [], 'shelter')).toHaveLength(5);
  });
});

describe('afstandKm', () => {
  it('giver nul for det samme punkt', () => {
    expect(afstandKm(ROLD, ROLD)).toBe(0);
  });

  // En breddegrad er ca. 111 km.
  it('måler i kilometer', () => {
    expect(afstandKm({ lat: 56, lng: 10 }, { lat: 57, lng: 10 })).toBeCloseTo(111, 0);
  });
});

describe('naermesteSted', () => {
  const shelter = lavSted({ uid: 's-1', navn: 'Shelteret', koordinater: ROLD });

  it('finder et gemt sted man står lige ved siden af', () => {
    // Ca. 100 m mod nord.
    const taetPaa = { lat: ROLD.lat + 0.001, lng: ROLD.lng };
    expect(naermesteSted([shelter], taetPaa)?.navn).toBe('Shelteret');
  });

  it('regner et sted længere væk som et andet sted', () => {
    const langtVaek = { lat: ROLD.lat + 0.05, lng: ROLD.lng };
    expect(naermesteSted([shelter], langtVaek)).toBeNull();
  });

  it('vælger det nærmeste når flere ligger indenfor', () => {
    const naer = lavSted({ uid: 's-2', navn: 'Bålpladsen', koordinater: { lat: ROLD.lat + 0.0005, lng: ROLD.lng } });
    const punkt = { lat: ROLD.lat + 0.0006, lng: ROLD.lng };

    expect(naermesteSted([shelter, naer], punkt)?.navn).toBe('Bålpladsen');
  });

  it('ser bort fra steder uden koordinater', () => {
    expect(naermesteSted([lavSted({ koordinater: null })], ROLD)).toBeNull();
  });
});
