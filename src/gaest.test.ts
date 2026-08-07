import { describe, it, expect } from 'vitest';
import {
  nytDeletoken,
  lavSnapshot,
  laesSnapshot,
  deleLink,
  tokenFraAdresse,
  linkadvarsel,
  linkvaert,
  SNAPSHOT_VERSION
} from './gaest';
import { lavItem, lavGruppe, lavTur } from './test/data';

describe('nytDeletoken', () => {
  it('giver 32 hex-tegn', () => {
    expect(nytDeletoken()).toMatch(/^[0-9a-f]{32}$/);
  });

  it('giver et nyt hver gang', () => {
    const set = new Set(Array.from({ length: 50 }, () => nytDeletoken()));
    expect(set.size).toBe(50);
  });
});

describe('lavSnapshot', () => {
  const gryde = lavItem({ uid: 'u-gryde', navn: 'Toaks 1L', vaegt_g: 155, pris_kr: 400 });
  const tarp = lavItem({ uid: 'u-tarp', navn: 'Full Moon Tarp', vaegt_g: 720, delt: true });
  const gruppe = lavGruppe({ uid: 'g-1', navn: 'Køkken', item_ids: ['u-gryde'] });

  const tur = () => lavTur({
    navn: 'Rold Skov',
    sted: 'Rold',
    startdato: '2026-08-21',
    slutdato: '2026-08-23',
    naetter: 2,
    personer: 2,
    gruppe_ids: ['g-1'],
    loese_item_ids: ['u-tarp'],
    besked_fra_ejer: 'Vi mødes ved P kl. 15',
    deltagere: [
      { id: 'd1', navn: 'Emil', overnatning: null, personligt_gear_ids: [], baerer_delt_ids: [], person_uid: '' },
      { id: 'd2', navn: 'Mikkel', overnatning: null, personligt_gear_ids: [], baerer_delt_ids: [], person_uid: '' }
    ]
  });

  it('tager turens oplysninger og pakkelisten med', () => {
    const s = lavSnapshot(tur(), [gruppe], [gryde, tarp]);

    expect(s.version).toBe(SNAPSHOT_VERSION);
    expect(s.navn).toBe('Rold Skov');
    expect(s.besked_fra_ejer).toBe('Vi mødes ved P kl. 15');
    expect(s.afsnit.map((a) => a.titel)).toEqual(['Køkken', 'Løse items']);
    expect(s.vaegt_i_alt_g).toBe(875);
  });

  it('tager kun deltagernes navne med', () => {
    expect(lavSnapshot(tur(), [gruppe], []).deltagere).toEqual(['Emil', 'Mikkel']);
  });

  // Det er hele pointen med et øjebliksbillede: gæsten skal se hvad hun skal
  // pakke, ikke hvad tingene har kostet.
  it('tager hverken priser, købsinfo eller noter med', () => {
    const raa = JSON.stringify(lavSnapshot(tur(), [gruppe], [gryde, tarp]));

    expect(raa).not.toContain('pris_kr');
    expect(raa).not.toContain('400');
    expect(raa).not.toContain('koebt_hos');
    expect(raa).not.toContain('koebsdato');
  });

  // Gearets uid følger med fra version 2, så en deltager kan sige "jeg tager
  // den". Det er et tilfældigt id og fortæller intet om tingen — og uden
  // adgang til items-samlingen kan det ikke slås op til noget.
  it('tager gearets uid med, men ikke gruppernes', () => {
    const raa = JSON.stringify(lavSnapshot(tur(), [gruppe], [gryde, tarp]));
    expect(raa).toContain('u-gryde');
    expect(raa).not.toContain('g-1');
  });

  it('beholder om et item er delt', () => {
    const s = lavSnapshot(tur(), [gruppe], [gryde, tarp]);
    const loese = s.afsnit.find((a) => a.titel === 'Løse items');
    expect(loese?.items[0]).toEqual({ uid: 'u-tarp', navn: 'Full Moon Tarp', vaegt_g: 720, delt: true, baerer: '' });
  });

  it('skriver hvem der bærer hvad, med navn og ikke id', () => {
    const medBaerer = lavTur({
      ...tur(),
      deltagere: [
        { id: 'd1', navn: 'Emil', overnatning: null, personligt_gear_ids: [], baerer_delt_ids: ['u-tarp'], person_uid: '' },
        { id: 'd2', navn: 'Mikkel', overnatning: null, personligt_gear_ids: ['u-gryde'], baerer_delt_ids: [], person_uid: '' }
      ]
    });

    const s = lavSnapshot(medBaerer, [gruppe], [gryde, tarp]);
    const alle = s.afsnit.flatMap((a) => a.items);

    expect(alle.find((i) => i.navn === 'Full Moon Tarp')?.baerer).toBe('Emil');
    expect(alle.find((i) => i.navn === 'Toaks 1L')?.baerer).toBe('Mikkel');
    expect(JSON.stringify(s)).not.toContain('d1');
  });

  it('lader bæreren stå tom når gearet ikke er fordelt', () => {
    const s = lavSnapshot(tur(), [gruppe], [gryde, tarp]);
    expect(s.afsnit.flatMap((a) => a.items).every((i) => i.baerer === '')).toBe(true);
  });

  it('tager vejrudsigten med hvis den er hentet', () => {
    const vejr = { dage: [{ dato: '2026-08-21', temp_min: 12, temp_max: 19, nedboer_mm: 0, vind_ms: 3, vejrkode: 0, sol_op: '06:00', sol_ned: '20:30' }], observationer: [], hentet: '' };
    const medVejr = lavTur({ ...tur(), vejrsnapshot: JSON.stringify(vejr) });

    expect(lavSnapshot(medVejr, [], []).vejr?.dage).toHaveLength(1);
  });

  it('klarer et ulæseligt vejrsnapshot', () => {
    const daarligt = lavTur({ ...tur(), vejrsnapshot: 'ikke json' });
    expect(lavSnapshot(daarligt, [], []).vejr).toBeNull();
  });
});

describe('laesSnapshot', () => {
  const gyldigt = () => JSON.stringify(lavSnapshot(lavTur({ navn: 'Tur' }), [], []));

  it('læser et snapshot vi selv har lavet', () => {
    expect(laesSnapshot(gyldigt())?.navn).toBe('Tur');
  });

  it('afviser tomt, ugyldigt og forkert formet', () => {
    expect(laesSnapshot('')).toBeNull();
    expect(laesSnapshot(null)).toBeNull();
    expect(laesSnapshot(42)).toBeNull();
    expect(laesSnapshot('ikke json')).toBeNull();
    expect(laesSnapshot('[1,2,3]')).toBeNull();
    expect(laesSnapshot('{"noget":"andet"}')).toBeNull();
  });

  // Feltet kom til efter de første snapshots blev lavet.
  it('klarer et snapshot fra før bæreren fandtes', () => {
    const gammelt = JSON.stringify({
      version: SNAPSHOT_VERSION,
      afsnit: [{ titel: 'Køkken', items: [{ navn: 'Gryde', vaegt_g: 155, delt: false }] }]
    });

    expect(laesSnapshot(gammelt)?.afsnit[0].items[0].baerer).toBe('');
  });

  it('afviser et snapshot fra en nyere version', () => {
    expect(laesSnapshot(JSON.stringify({ version: SNAPSHOT_VERSION + 1 }))).toBeNull();
  });

  // Feltet kommer fra serveren, så intet i det kan tages for givet.
  it('retter felter af forkert type op frem for at vælte', () => {
    const skævt = JSON.stringify({
      version: SNAPSHOT_VERSION,
      navn: 42,
      naetter: 'to',
      personer: null,
      deltagere: 'Emil',
      afsnit: [{ titel: 'Køkken', items: [{ navn: 'Gryde', vaegt_g: '155' }] }, null, 'volapyk'],
      koordinater: { lat: 'nord', lng: 9 }
    });

    const s = laesSnapshot(skævt);

    expect(s?.navn).toBe('');
    expect(s?.naetter).toBe(0);
    expect(s?.personer).toBe(1);
    expect(s?.deltagere).toEqual([]);
    expect(s?.koordinater).toBeNull();
    expect(s?.afsnit).toHaveLength(1);
    expect(s?.afsnit[0].items[0]).toEqual({ uid: '', navn: 'Gryde', vaegt_g: 0, delt: false, baerer: '' });
  });
});

describe('deleLink og tokenFraAdresse', () => {
  it('bygger et link ud fra hvor appen kører', () => {
    expect(deleLink('a'.repeat(32), 'https://feltbogen.dk')).toBe(`https://feltbogen.dk/?tur=${'a'.repeat(32)}`);
  });

  it('læser tokenet ud af adressen igen', () => {
    const token = nytDeletoken();
    expect(tokenFraAdresse(`?tur=${token}`)).toBe(token);
  });

  it('giver null uden token', () => {
    expect(tokenFraAdresse('')).toBeNull();
    expect(tokenFraAdresse('?andet=1')).toBeNull();
  });

  // Et token vi ikke selv kunne have lavet, skal ikke sendes videre til
  // serveren.
  it('afviser alt der ikke ligner et token vi har lavet', () => {
    expect(tokenFraAdresse('?tur=kort')).toBeNull();
    expect(tokenFraAdresse('?tur=' + 'z'.repeat(32))).toBeNull();
    expect(tokenFraAdresse('?tur=' + 'a'.repeat(33))).toBeNull();
    expect(tokenFraAdresse("?tur=' OR 1=1 --")).toBeNull();
  });
});

describe('linkadvarsel', () => {
  it('advarer om adresser der kun findes på ens egen maskine', () => {
    expect(linkadvarsel('http://localhost:5173')).toBe('lokal');
    expect(linkadvarsel('http://127.0.0.1:4173')).toBe('lokal');
    expect(linkadvarsel('http://feltbogen.local')).toBe('lokal');
  });

  it('advarer om adresser på det lokale net', () => {
    expect(linkadvarsel('http://192.168.1.42:5173')).toBe('lokal');
    expect(linkadvarsel('http://10.0.0.5:5173')).toBe('lokal');
    expect(linkadvarsel('http://172.20.0.3:5173')).toBe('lokal');
  });

  it('tager ikke 172.x for lokal når den ikke er det', () => {
    // Kun 172.16–172.31 er private.
    expect(linkadvarsel('http://172.15.0.1')).toBeNull();
    expect(linkadvarsel('http://172.32.0.1')).toBeNull();
  });

  it('advarer om Vercels grenpreviews', () => {
    expect(linkadvarsel('https://feltbogen-git-claude-code-review-abc.vercel.app')).toBe('preview');
  });

  // En falsk advarsel på en god adresse er værre end ingen advarsel, så
  // produktionsnavne med bindestreger skal slippe igennem.
  it('advarer ikke om produktionsadresser', () => {
    expect(linkadvarsel('https://feltbogen.vercel.app')).toBeNull();
    expect(linkadvarsel('https://min-feltbog.vercel.app')).toBeNull();
    expect(linkadvarsel('https://feltbogen.dk')).toBeNull();
  });

  it('siger ikke noget om en adresse den ikke kan læse', () => {
    expect(linkadvarsel('volapyk')).toBeNull();
  });
});

describe('linkvaert', () => {
  it('viser værten gæsten lander på', () => {
    expect(linkvaert('https://feltbogen.vercel.app')).toBe('feltbogen.vercel.app');
    expect(linkvaert('http://localhost:4173')).toBe('localhost:4173');
  });
});
