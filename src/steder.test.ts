import { describe, it, expect } from 'vitest';
import {
  afstandKm,
  besoegPaaSted,
  besoegPrSted,
  besoegstekst,
  erBesoeg,
  genbesoegstekst,
  noteFraBesoeg,
  noteFraSidst,
  tidligereBesoeg,
  foreslaaSteder,
  naermesteSted,
  sorterEfterBesoeg,
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
      lavTur({ sted_uid: 's-1', status: 'afsluttet' }),
      lavTur({ sted_uid: 's-1', status: 'aktiv' }),
      lavTur({ sted_uid: 's-2', status: 'afsluttet' }),
      lavTur({ sted_uid: '', status: 'afsluttet' })
    ];

    const antal = besoegPrSted(ture);

    expect(antal.get('s-1')).toBe(2);
    expect(antal.get('s-2')).toBe(1);
    expect(antal.has('')).toBe(false);
  });

  // En plan er ikke et besøg. Kladden, man sidder med, skal ikke sige
  // "Været her 1 gang".
  it('tæller ikke kladder og klare ture', () => {
    const ture = [
      lavTur({ sted_uid: 's-1', status: 'kladde' }),
      lavTur({ sted_uid: 's-1', status: 'klar' })
    ];

    expect(besoegPrSted(ture).get('s-1')).toBeUndefined();
  });
});

const note = (tid: string, tekst: string) => ({ id: tid, tid, tekst });

describe('erBesoeg', () => {
  it('er en tur, der er sket eller er i gang', () => {
    expect(erBesoeg(lavTur({ status: 'kladde' }))).toBe(false);
    expect(erBesoeg(lavTur({ status: 'klar' }))).toBe(false);
    expect(erBesoeg(lavTur({ status: 'aktiv' }))).toBe(true);
    expect(erBesoeg(lavTur({ status: 'afsluttet' }))).toBe(true);
  });
});

describe('besoegPaaSted', () => {
  it('er besøgene på stedet, nyeste først, uden planerne', () => {
    const ture = [
      lavTur({ navn: 'Maj', sted_uid: 's-1', status: 'afsluttet', startdato: '2026-05-01' }),
      lavTur({ navn: 'Plan', sted_uid: 's-1', status: 'kladde', startdato: '2026-10-01' }),
      lavTur({ navn: 'Juni', sted_uid: 's-1', status: 'afsluttet', startdato: '2026-06-01' })
    ];

    expect(besoegPaaSted(ture, 's-1').map((t) => t.navn)).toEqual(['Juni', 'Maj']);
  });

  it('finder intet uden et sted', () => {
    expect(besoegPaaSted([lavTur({ sted_uid: '', status: 'afsluttet' })], '')).toEqual([]);
  });

  // Opbevaringsstedet — hjem, hytte, bil — er ikke et tursted. Kun turens
  // kobling til et gemt sted tæller, aldrig et navn i fritekst.
  it('blander ikke fritekst som "hytte" ind i stedets besøg', () => {
    const ture = [
      lavTur({ sted: 'Hytten', sted_uid: '', status: 'afsluttet' }),
      lavTur({ sted: 'Hjemme', sted_uid: '', status: 'afsluttet' })
    ];

    expect(besoegPaaSted(ture, 's-1')).toEqual([]);
    expect(besoegPrSted(ture).size).toBe(0);
  });
});

describe('tidligereBesoeg', () => {
  const maj = lavTur({ navn: 'Maj', sted_uid: 's-1', status: 'afsluttet', startdato: '2026-05-01' });
  const juni = lavTur({ navn: 'Juni', sted_uid: 's-1', status: 'afsluttet', startdato: '2026-06-01' });

  it('tæller aldrig turen selv', () => {
    const nu = lavTur({ sted_uid: 's-1', status: 'aktiv', startdato: '2026-07-01' });
    expect(tidligereBesoeg([maj, juni, nu], nu).map((t) => t.navn)).toEqual(['Juni', 'Maj']);
  });

  it('er tom første gang', () => {
    const kladde = lavTur({ sted_uid: 's-1', status: 'kladde', startdato: '2026-07-01' });
    expect(tidligereBesoeg([kladde], kladde)).toEqual([]);
  });

  it('springer besøg efter turen over', () => {
    expect(tidligereBesoeg([maj, juni], maj)).toEqual([]);
    expect(tidligereBesoeg([maj, juni], juni).map((t) => t.navn)).toEqual(['Maj']);
  });

  it('tæller kun ture til samme sted', () => {
    const andet = lavTur({ sted_uid: 's-2', status: 'afsluttet', startdato: '2026-06-15' });
    const nu = lavTur({ sted_uid: 's-1', status: 'kladde', startdato: '2026-07-01' });
    expect(tidligereBesoeg([maj, andet, nu], nu).map((t) => t.navn)).toEqual(['Maj']);
  });

  it('har turen ingen dato, er alle andre besøg tidligere', () => {
    const udenDato = lavTur({ sted_uid: 's-1', status: 'kladde', startdato: '', slutdato: '' });
    expect(tidligereBesoeg([maj, juni, udenDato], udenDato)).toHaveLength(2);
  });
});

describe('noteFraBesoeg', () => {
  it('er den nyeste indgang i turlogen', () => {
    const tur = lavTur({
      feltnoter: [note('2026-05-01T20:00', 'Første aften'), note('2026-05-02T09:00', 'Kildevand mod øst')],
      noter: 'Husk nøglen'
    });
    expect(noteFraBesoeg(tur)?.tekst).toBe('Kildevand mod øst');
  });

  it('falder tilbage på turens noter', () => {
    expect(noteFraBesoeg(lavTur({ noter: '  Myg i juli  ' }))?.tekst).toBe('Myg i juli');
  });

  it('er ingenting, når man ikke skrev noget', () => {
    expect(noteFraBesoeg(lavTur({ feltnoter: [note('2026-05-01T20:00', '   ')], noter: '' }))).toBeNull();
  });
});

describe('noteFraSidst', () => {
  it('er fra forrige besøg og ikke fra turen, man står i', () => {
    const forrige = lavTur({
      navn: 'Forrige', sted_uid: 's-1', status: 'afsluttet', startdato: '2026-05-01',
      feltnoter: [note('2026-05-01T20:00', 'Shelter 2 er tørrest')]
    });
    const kladde = lavTur({
      sted_uid: 's-1', status: 'kladde', startdato: '2026-07-01',
      feltnoter: [note('2026-06-30T20:00', 'Kladdens egen note')], noter: 'Kladdens noter'
    });

    const svar = noteFraSidst([forrige, kladde], kladde);
    expect(svar?.tekst).toBe('Shelter 2 er tørrest');
    expect(svar?.tur.navn).toBe('Forrige');
  });

  // "Fra sidst" skal betyde fra sidst. Skrev man intet på seneste besøg,
  // hentes der ikke en gammel note frem fra et ældre.
  it('bruger kun det seneste tidligere besøg', () => {
    const gammel = lavTur({ sted_uid: 's-1', status: 'afsluttet', startdato: '2025-05-01', noter: 'Gammel note' });
    const sidst = lavTur({ sted_uid: 's-1', status: 'afsluttet', startdato: '2026-05-01', noter: '' });
    const nu = lavTur({ sted_uid: 's-1', status: 'kladde', startdato: '2026-07-01' });

    expect(noteFraSidst([gammel, sidst, nu], nu)).toBeNull();
  });

  it('springer planlagte ture over', () => {
    const besoeg = lavTur({ sted_uid: 's-1', status: 'afsluttet', startdato: '2026-05-01', noter: 'Fra besøget' });
    const plan = lavTur({ sted_uid: 's-1', status: 'klar', startdato: '2026-06-01', noter: 'Fra planen' });
    const nu = lavTur({ sted_uid: 's-1', status: 'kladde', startdato: '2026-07-01' });

    expect(noteFraSidst([besoeg, plan, nu], nu)?.tekst).toBe('Fra besøget');
  });

  it('er ingenting første gang', () => {
    const nu = lavTur({ sted_uid: 's-1', status: 'kladde', noter: 'Min plan' });
    expect(noteFraSidst([nu], nu)).toBeNull();
  });

  it('er ingenting uden gemt sted', () => {
    const foer = lavTur({ sted: 'Rold Skov', sted_uid: '', status: 'afsluttet', startdato: '2026-05-01', noter: 'x' });
    const nu = lavTur({ sted: 'Rold Skov', sted_uid: '', status: 'kladde' });
    expect(noteFraSidst([foer, nu], nu)).toBeNull();
  });
});

describe('genbesoegstekst', () => {
  it('siger første gang og bøjer gang og gange', () => {
    expect(genbesoegstekst(0)).toBe('Første gang her');
    expect(genbesoegstekst(1)).toBe('Været her 1 gang før');
    expect(genbesoegstekst(2)).toBe('Været her 2 gange før');
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
    const ture = [
      lavTur({ sted_uid: 's-2', status: 'afsluttet' }),
      lavTur({ sted_uid: 's-2', status: 'afsluttet' }),
      lavTur({ sted_uid: 's-1', status: 'afsluttet' })
    ];
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

describe('sorterEfterBesoeg', () => {
  it('sætter de mest besøgte først', () => {
    const sjaelden = lavSted({ uid: 's-1', navn: 'Sjælden' });
    const fast = lavSted({ uid: 's-2', navn: 'Fast' });
    const ture = [
      lavTur({ sted_uid: 's-2', status: 'afsluttet' }),
      lavTur({ sted_uid: 's-2', status: 'afsluttet' }),
      lavTur({ sted_uid: 's-1', status: 'afsluttet' })
    ];

    expect(sorterEfterBesoeg([sjaelden, fast], ture).map((s) => s.navn)).toEqual(['Fast', 'Sjælden']);
  });

  it('sorterer på navn når besøgene står lige', () => {
    const steder = [lavSted({ navn: 'Ørnen' }), lavSted({ navn: 'Bøgen' }), lavSted({ navn: 'Asken' })];
    expect(sorterEfterBesoeg(steder, []).map((s) => s.navn)).toEqual(['Asken', 'Bøgen', 'Ørnen']);
  });

  // Knappen "vælg blandt mine steder" viser hele listen — den må ikke skæres af.
  it('tager alle med, også når der er mange', () => {
    const mange = Array.from({ length: 20 }, (_, n) => lavSted({ navn: `Sted ${n}` }));
    expect(sorterEfterBesoeg(mange, [])).toHaveLength(20);
  });

  it('rører ikke den liste den får ind', () => {
    const steder = [lavSted({ navn: 'B' }), lavSted({ navn: 'A' })];
    sorterEfterBesoeg(steder, []);
    expect(steder.map((s) => s.navn)).toEqual(['B', 'A']);
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
