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
import { lavBillede, lavItem, lavGruppe, lavTur, lavTurDag } from './test/data';

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

describe('billeder i snapshottet', () => {
  it('tager billederne med, forsiden først', () => {
    const tur = lavTur({ uid: 't-1', hero_billede: 'b-2' });
    const billeder = [
      lavBillede({ uid: 'b-1', tur_uid: 't-1', tid: '2026-07-10T08:00:00Z', url: 'https://pb/a.jpg' }),
      lavBillede({
        uid: 'b-2', tur_uid: 't-1', tid: '2026-07-11T08:00:00Z', url: 'https://pb/b.jpg',
        beskrivelse: 'Bålet', original_url: 'https://pb/b-org.jpg', original_byte: 4_200_000
      })
    ];

    const snapshot = lavSnapshot(tur, [], [], new Date(), billeder);

    expect(snapshot.billeder).toEqual([
      { url: 'https://pb/b.jpg', beskrivelse: 'Bålet', original: 'https://pb/b-org.jpg', original_byte: 4_200_000 },
      { url: 'https://pb/a.jpg', beskrivelse: '', original: '', original_byte: 0 }
    ]);
  });

  // Et billede der kun ligger på ejerens telefon, har ingen adresse gæsten
  // kan hente det fra.
  it('udelader billeder der ikke er nået op endnu', () => {
    const tur = lavTur({ uid: 't-1' });
    const billeder = [
      lavBillede({ uid: 'b-1', tur_uid: 't-1', url: '', blob: new Blob(['x']) }),
      lavBillede({ uid: 'b-2', tur_uid: 't-1', url: 'https://pb/b.jpg' })
    ];

    expect(lavSnapshot(tur, [], [], new Date(), billeder).billeder)
      .toEqual([{ url: 'https://pb/b.jpg', beskrivelse: '', original: '', original_byte: 0 }]);
  });

  it('tager ikke billeder fra andre ture med', () => {
    const tur = lavTur({ uid: 't-1' });
    const fremmed = lavBillede({ tur_uid: 't-2', url: 'https://pb/x.jpg' });

    expect(lavSnapshot(tur, [], [], new Date(), [fremmed]).billeder).toEqual([]);
  });

  it('giver en tom liste når turen ingen billeder har', () => {
    expect(lavSnapshot(lavTur(), [], []).billeder).toEqual([]);
  });
});

describe('laesSnapshot og billeder', () => {
  const grund = { ...lavSnapshot(lavTur({ navn: 'Tur' }), [], []) };

  // Snapshottet kommer fra serveren og lægges direkte i en src.
  it('kaster adresser der ikke er http eller https væk', () => {
    const raa = JSON.stringify({
      ...grund,
      billeder: [
        { url: 'https://pb/ok.jpg', beskrivelse: '', original: 'https://pb/ok-org.jpg', original_byte: 12 },
        // Visningsadressen er god, men originalen er det ikke — den skal
        // falde bort for sig, uden at tage billedet med.
        { url: 'https://pb/to.jpg', beskrivelse: '', original: 'javascript:alert(1)', original_byte: 0 },
        { url: 'javascript:alert(1)', beskrivelse: '', original: '', original_byte: 0 },
        { url: 'data:image/svg+xml,<svg onload="alert(1)"/>', beskrivelse: '', original: '', original_byte: 0 }
      ]
    });

    expect(laesSnapshot(raa)?.billeder).toEqual([
      { url: 'https://pb/ok.jpg', beskrivelse: '', original: 'https://pb/ok-org.jpg', original_byte: 12 },
      { url: 'https://pb/to.jpg', beskrivelse: '', original: '', original_byte: 0 }
    ]);
  });

  it('klarer et snapshot fra før billederne fandtes', () => {
    const gammelt = JSON.stringify({ ...grund, version: 2, billeder: undefined });
    expect(laesSnapshot(gammelt)?.billeder).toEqual([]);
  });

  it('klarer at billed-feltet er vrøvl', () => {
    expect(laesSnapshot(JSON.stringify({ ...grund, billeder: 'nej' }))?.billeder).toEqual([]);
    expect(laesSnapshot(JSON.stringify({ ...grund, billeder: [null, 7] }))?.billeder).toEqual([]);
  });
});


// ─────────────────────────────────────────────
// Dagsplanen i snapshottet
//
// "Hvor sover vi tirsdag?" er det, en deltager spørger om. Dagene er ejerens
// plan, og gæsten får dem frosset ned som alt andet.
// ─────────────────────────────────────────────

describe('dagsplanen i snapshottet', () => {
  const turen = lavTur({ uid: 'tur-1', navn: 'Møn', startdato: '2026-07-10', naetter: 2 });
  const dag = (dag_nr: number, felter = {}) => lavTurDag({ tur_uid: 'tur-1', dag_nr, ...felter });

  it('kommer med, når turen har dage', () => {
    const s = lavSnapshot(turen, [], [], new Date(), [], [
      dag(1, { destination: 'Rold Skov', aktivitet: 'vandretur', overnatning: 'shelter' })
    ]);

    expect(s.dage).toEqual([expect.objectContaining({
      nr: 1,
      destination: 'Rold Skov',
      aktivitet: 'vandretur',
      overnatning: 'shelter'
    })]);
  });

  // Datoen bages ind. Gæsten skal ikke have en dagberegning, hun kan komme
  // til at være uenig med.
  it('bager datoen ind, udledt af turens start', () => {
    const s = lavSnapshot(turen, [], [], new Date(), [], [dag(1), dag(3)]);

    expect(s.dage.map((d) => d.dato)).toEqual(['2026-07-10', '2026-07-12']);
  });

  it('lader datoen stå tom, når turen ingen startdato har', () => {
    const uden = lavTur({ uid: 'tur-1', startdato: '', naetter: 2 });
    const s = lavSnapshot(uden, [], [], new Date(), [], [dag(1)]);

    expect(s.dage[0].dato).toBe('');
  });

  // Gæsten har ikke etikettabellen. Hun skal ikke sidde med "haengekoeje".
  it('skriver aktivitet og overnatning ud på dansk', () => {
    const s = lavSnapshot(turen, [], [], new Date(), [], [
      dag(1, { overnatning: 'haengekoeje' })
    ]);

    expect(s.dage[0].overnatning).toBe('hængekøje');
  });

  it('står i rækkefølge', () => {
    const s = lavSnapshot(turen, [], [], new Date(), [], [dag(3), dag(1), dag(2)]);

    expect(s.dage.map((d) => d.nr)).toEqual([1, 2, 3]);
  });

  it('tager kun turens egne dage med', () => {
    const fremmed = lavTurDag({ tur_uid: 'en-anden-tur', dag_nr: 1, destination: 'Ikke min' });
    const s = lavSnapshot(turen, [], [], new Date(), [], [dag(1), fremmed]);

    expect(s.dage).toHaveLength(1);
  });

  it('er tom på en tur uden dage — og det er de fleste', () => {
    expect(lavSnapshot(turen, [], []).dage).toEqual([]);
  });
});

describe('dagsplanen læst tilbage', () => {
  const rundtur = (dage: unknown) => laesSnapshot(JSON.stringify({
    version: SNAPSHOT_VERSION, navn: 'Møn', dage
  }));

  it('kommer hel igennem', () => {
    const laest = rundtur([{ nr: 2, dato: '2026-07-11', aktivitet: 'kano', overnatning: 'telt', destination: 'Sortesø', noter: 'Kort dag' }]);

    expect(laest?.dage).toEqual([{
      nr: 2, dato: '2026-07-11', aktivitet: 'kano', overnatning: 'telt',
      destination: 'Sortesø', noter: 'Kort dag'
    }]);
  });

  // Et snapshot fra version 5 har feltet slet ikke. Det skal læses som
  // "ingen dagsplan" og ikke som et hul.
  it('læser et gammelt snapshot uden dage', () => {
    const gammelt = laesSnapshot(JSON.stringify({ version: 5, navn: 'Fra i går' }));

    expect(gammelt).not.toBeNull();
    expect(gammelt?.dage).toEqual([]);
  });

  it('tåler at feltet er noget helt andet', () => {
    expect(rundtur('ikke en liste')?.dage).toEqual([]);
    expect(rundtur(null)?.dage).toEqual([]);
    expect(rundtur([null, 42])?.dage).toHaveLength(2);
  });

  it('sorterer efter nummer, uanset hvad der stod i filen', () => {
    const laest = rundtur([{ nr: 3 }, { nr: 1 }, { nr: 2 }]);

    expect(laest?.dage.map((d) => d.nr)).toEqual([1, 2, 3]);
  });
});
