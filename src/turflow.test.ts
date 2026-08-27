import { describe, it, expect, beforeAll, vi } from 'vitest';

vi.mock('./pb', () => import('./test/pbMock'));

import { db } from './db';
import type { Item, Tur } from './db';
import { pbMock, saetTestNavn } from './test/pbMock';
import { opretTomTur } from './opret';
import { opretItem, opretGruppe, opdaterTur } from './sync';
import { itemsPaaTur, tildelGear, vaegtPrDeltager, baererAf } from './smartMotor';
import { veksl, fremdrift, pakAlle } from './pakning';
import { turfase } from './turfase';
import { tilfoej as tilfoejFeltnote, efterDag } from './feltnoter';
import { nytPakAfTjek, saetStatus, saetTurvurdering, brugPrItem } from './pakAfTjek';
import { foreslaaKopi, kopierGrej, antalNye } from './ligesomSidst';
import { vaegtbrydere } from './vaegtbrydere';

// Turen fra ende til anden.
//
// Specens §26 beder om integrationstests af flowet og ikke kun af
// regnestykkerne: opret tur, læg grej på, pak, fordel, tag afsted, skriv i
// logen, afslut, og brug turen igen næste gang. Hvert af de skridt har sine
// egne unittests i forvejen — det de ikke fanger, er overgangene mellem dem.
//
// Fejlene i det her lag ligner ikke fejl i en funktion. Det er et felt, der
// bliver læst ét sted og skrevet et andet; en liste, der peger på uid'er, som
// et andet skridt har flyttet; en tilstand, der er rigtig lige indtil den
// skal gemmes. `hero_billede` blev læst ned fra serveren og aldrig sendt op —
// hver funktion for sig var rigtig, og turen mistede sin forside alligevel.
//
// Derfor kører testen igennem det rigtige datalag: Dexie, `opdaterTur` og
// sync-mocken, med turen læst frisk fra basen efter hvert skridt. En påstand
// om et objekt, jeg selv holder i hånden, ville kun sige, at jeg kan skrive
// et objekt.
//
// Testene deler én tur og kører i rækkefølge, fordi det er det, et flow er.
// Det er med vilje og ikke sjusk: skridt fem giver ingen mening uden fire.

let turId: number;
let telt: Item;
let sovepose: Item;
let trangia: Item;

async function turen(): Promise<Tur> {
  const tur = await db.ture.get(turId);
  if (!tur) throw new Error('Turen findes ikke længere');
  return tur;
}

async function grejet(): Promise<Item[]> {
  return db.items.toArray();
}

async function paaTuren(): Promise<Item[]> {
  return itemsPaaTur(await turen(), await db.grupper.toArray(), await grejet());
}

beforeAll(async () => {
  pbMock.reset();
  saetTestNavn('Emil');
  await Promise.all([db.ture.clear(), db.items.clear(), db.grupper.clear()]);

  const nu = new Date('2026-07-01T12:00:00Z');
  const basis = {
    pris_kr: 0, dimensioner: '', antal: 1, status: 'ejer' as const,
    kraever: [], komplementer: [], koebt_hos: '', koebsdato: '', koebslink: '',
    ordrenummer: '', garanti: null, udlaan: null, laant_af: null,
    vedligehold: [], vurdering: null, noter: '', oprettet: nu, aendret: nu
  };

  // Grejet oprettes gennem det rigtige API, så uid'erne er dem, appen selv
  // ville have givet dem — resten af flowet peger på dem.
  const lav = async (navn: string, vaegt_g: number, delt: boolean, tags: string[]) => {
    const id = await opretItem({ navn, vaegt_g, delt, tags, ...basis });
    const item = await db.items.get(id);
    if (!item) throw new Error(`${navn} blev ikke oprettet`);
    return item;
  };

  telt = await lav('Telt', 2400, true, ['telt']);
  sovepose = await lav('Sovepose', 1100, false, ['sov']);
  trangia = await lav('Trangia', 900, true, ['køkken']);
  // Ligger kun i inventaret. Det er alternativet, vægtbryderne kan pege på.
  await lav('Stormkøkken', 320, true, ['køkken']);
});

describe('turflowet — fra tom kladde til gjort op', () => {
  it('opretter turen som en kladde med ejeren på deltagerlisten', async () => {
    turId = await opretTomTur();
    const tur = await turen();

    expect(tur.status).toBe('kladde');
    expect(tur.deltagere.map((d) => d.navn)).toEqual(['Emil']);
    // Kladden er tom, og det er meningen: man skal kunne begynde uden at
    // udfylde en formular først.
    expect(turfase(tur, []).mangler.length).toBeGreaterThan(0);
  });

  it('lægger dato, sted og grej på — og manglerne forsvinder efterhånden', async () => {
    await opdaterTur(turId, {
      navn: 'Mols i juli',
      sted: 'Mols Bjerge',
      startdato: '2026-07-10',
      slutdato: '2026-07-12',
      naetter: 2,
      personer: 2,
      overnatning: 'telt',
      aktivitet: 'vandretur',
      terraen: 'skov'
    });

    // Stadig én mangel: der er ikke valgt grej endnu — og den ved, hvor den
    // rettes, så skærmen kan tage én derhen.
    expect(turfase(await turen(), []).mangler).toEqual([
      { tekst: 'Intet grej valgt', maal: 'pakning' }
    ]);

    // Køkkengrejet kommer med som et grejsæt, resten som løse ting. Begge veje
    // skal tælle med, og det er præcis dét, `itemUidsPaaTur` samler.
    const saetId = await opretGruppe({
      navn: 'Køkken', tags: ['køkken'], item_ids: [trangia.uid], noter: '',
      oprettet: new Date(), aendret: new Date()
    });
    const saet = await db.grupper.get(saetId);

    await opdaterTur(turId, {
      gruppe_ids: [saet!.uid],
      loese_item_ids: [telt.uid, sovepose.uid]
    });

    const navne = (await paaTuren()).map((i) => i.navn).sort();
    expect(navne).toEqual(['Sovepose', 'Telt', 'Trangia']);
    expect(turfase(await turen(), await db.grupper.toArray()).mangler).toEqual([]);
  });

  it('pakker grejet, og fremdriften følger med', async () => {
    const grej = await paaTuren();
    expect(fremdrift(await turen(), grej).procent).toBe(0);

    // Ét stykke ad gangen, som man ville krydse af i tasken. Hvert kryds
    // gemmes for sig, fordi det er sådan skærmen gør det.
    for (const item of grej) {
      await opdaterTur(turId, { pakkede_item_uids: veksl(await turen(), item.uid) });
    }

    const fuld = fremdrift(await turen(), grej);
    expect(fuld.pakket).toBe(3);
    expect(fuld.procent).toBe(100);
    expect(fuld.faerdig).toBe(true);

    // Og af igen: krydset er en kontakt, ikke en envejsdør.
    await opdaterTur(turId, { pakkede_item_uids: veksl(await turen(), telt.uid) });
    const efterAfkryds = fremdrift(await turen(), grej);
    expect(efterAfkryds.pakket).toBe(2);
    expect(efterAfkryds.mangler.map((i) => i.navn)).toEqual(['Telt']);

    await opdaterTur(turId, { pakkede_item_uids: pakAlle(grej) });
    expect(fremdrift(await turen(), grej).procent).toBe(100);
  });

  it('fordeler grejet mellem to deltagere', async () => {
    const tur = await turen();
    const emil = tur.deltagere[0];
    const anna = {
      id: crypto.randomUUID(), navn: 'Anna', overnatning: null,
      personligt_gear_ids: [], baerer_delt_ids: [], person_uid: ''
    };
    await opdaterTur(turId, { deltagere: [emil, anna] });

    const grej = await paaTuren();
    const find = (navn: string) => grej.find((i) => i.navn === navn)!;

    // Emil tager teltet, Anna køkkenet. Soveposen er personlig og bliver
    // liggende hos Emil.
    for (const [hvem, hvad] of [[emil.id, 'Telt'], [emil.id, 'Sovepose'], [anna.id, 'Trangia']] as const) {
      await opdaterTur(turId, { deltagere: tildelGear((await turen()).deltagere, hvem, find(hvad)) });
    }

    const vaegte = vaegtPrDeltager(await turen(), grej);
    expect(vaegte.find((v) => v.navn === 'Emil')?.vaegt_g).toBe(3500);
    expect(vaegte.find((v) => v.navn === 'Anna')?.vaegt_g).toBe(900);

    // Ingenting er dobbeltbåret: hvert stykke gear har præcis én bærer.
    expect(baererAf(await turen()).size).toBe(3);
  });

  it('flytter et stykke fælles gear i stedet for at tælle det to gange', async () => {
    const grej = await paaTuren();
    const teltet = grej.find((i) => i.navn === 'Telt')!;
    const anna = (await turen()).deltagere.find((d) => d.navn === 'Anna')!;

    await opdaterTur(turId, { deltagere: tildelGear((await turen()).deltagere, anna.id, teltet) });

    const vaegte = vaegtPrDeltager(await turen(), grej);
    expect(vaegte.find((v) => v.navn === 'Emil')?.vaegt_g).toBe(1100);
    expect(vaegte.find((v) => v.navn === 'Anna')?.vaegt_g).toBe(3300);
    expect(baererAf(await turen()).size).toBe(3);
  });

  it('går fra kladde til klar til på tur', async () => {
    const grupper = await db.grupper.toArray();

    // Klar-fasen spørger til afgangs-tjekket, men lader turen gå videre uden.
    await opdaterTur(turId, { status: 'klar' });
    const klar = turfase(await turen(), grupper);
    expect(klar.fase).toBe('klar');
    expect(klar.naeste).toMatchObject({ til: 'aktiv' });
    expect(klar.mangler).toEqual([
      { tekst: 'Afgangs-tjekket er ikke taget i brug', maal: 'afgangstjek' }
    ]);

    await opdaterTur(turId, {
      afgangs_tjek: {
        linjer: [{ id: 'a', tekst: 'Nøgler', afkrydset: true, fra_skabelon: false }]
      }
    });
    expect(turfase(await turen(), grupper).mangler).toEqual([]);

    await opdaterTur(turId, { status: 'aktiv' });
    expect(turfase(await turen(), grupper).fase).toBe('aktiv');
  });

  it('skriver i turlogen undervejs', async () => {
    const dag1 = new Date('2026-07-10T19:00:00Z');
    const dag2 = new Date('2026-07-11T08:30:00Z');

    await opdaterTur(turId, { feltnoter: tilfoejFeltnote((await turen()).feltnoter, 'Slog lejr ved søen', dag1) });
    await opdaterTur(turId, { feltnoter: tilfoejFeltnote((await turen()).feltnoter, 'Regn hele natten', dag1) });
    await opdaterTur(turId, { feltnoter: tilfoejFeltnote((await turen()).feltnoter, 'Tørt vejr, gik videre', dag2) });

    const dage = efterDag((await turen()).feltnoter);
    expect(dage).toHaveLength(2);
    expect(dage[0].dato).toBe('2026-07-11');
    expect(dage[0].indgange).toHaveLength(1);
    expect(dage[1].indgange).toHaveLength(2);
  });

  it('afslutter turen og gør den op', async () => {
    const grupper = await db.grupper.toArray();

    await opdaterTur(turId, { status: 'afsluttet' });
    const afsluttet = turfase(await turen(), grupper);
    expect(afsluttet.fase).toBe('afsluttet');
    expect(afsluttet.naeste).toEqual({ slags: 'pak_af_tjek', label: 'Lav pak-af-tjek' });

    // Pak-af-tjekket starter med alt som brugt; det man retter, er
    // undtagelserne. Trangiaen lå urørt, og turen fik fire stjerner.
    let tjek = nytPakAfTjek(await paaTuren(), 'let', new Date('2026-07-13T10:00:00Z'));
    tjek = saetStatus(tjek, trangia.uid, 'ubrugt');
    tjek = saetTurvurdering(tjek, 4);
    await opdaterTur(turId, { pak_af_tjek: tjek });

    const gjortOp = turfase(await turen(), grupper);
    expect(gjortOp.fase).toBe('evalueret');
    expect(gjortOp.navn).toBe('Gjort op');

    // Og det er den her viden, motoren arbejder videre på.
    const brug = brugPrItem([await turen()]);
    expect(brug.get(telt.uid)).toEqual({ gjort_op: 1, brugt: 1, i_stykker: 0 });
    expect(brug.get(trangia.uid)).toEqual({ gjort_op: 1, brugt: 0, i_stykker: 0 });
  });
});

describe('turflowet — næste tur bygger på den forrige', () => {
  it('foreslår den afsluttede tur som skabelon og kopierer grejet over', async () => {
    const nyId = await opretTomTur();
    await opdaterTur(nyId, {
      navn: 'Mols igen', sted: 'Mols Bjerge',
      startdato: '2026-07-24', slutdato: '2026-07-26',
      naetter: 2, personer: 2,
      overnatning: 'telt', aktivitet: 'vandretur', terraen: 'skov'
    });

    const ny = await db.ture.get(nyId);
    const gamle = await db.ture.toArray();
    const grupper = await db.grupper.toArray();

    const forslag = foreslaaKopi(ny!, gamle, grupper);
    expect(forslag).toHaveLength(1);
    expect(forslag[0].tur.uid).toBe((await turen()).uid);
    // Fuldt match: samme overnatning, terræn, aktivitet, årstid og selskab.
    expect(forslag[0].score).toBe(forslag[0].maks);
    expect(forslag[0].begrundelse).not.toBe('');
    expect(antalNye(forslag[0].tur, ny!, grupper, await grejet())).toBe(3);

    await opdaterTur(nyId, kopierGrej(forslag[0].tur, ny!));

    const kopieret = await db.ture.get(nyId);
    const navne = itemsPaaTur(kopieret!, grupper, await grejet()).map((i) => i.navn).sort();
    expect(navne).toEqual(['Sovepose', 'Telt', 'Trangia']);
    // Grejsættet fulgte med som et sæt og ikke som løse ting, så det stadig
    // ændrer sig med sættet.
    expect(kopieret!.gruppe_ids).toHaveLength(1);
  });

  it('lader den gamle tur være urørt', async () => {
    const gammel = await turen();

    expect(gammel.status).toBe('afsluttet');
    expect(gammel.pak_af_tjek?.linjer).toHaveLength(3);
    expect(gammel.feltnoter).toHaveLength(3);
    // Pakningen fra sidste tur er ikke fulgt med over — den hørte til den tur.
    expect(gammel.pakkede_item_uids).toHaveLength(3);
    const ny = (await db.ture.toArray()).find((t) => t.navn === 'Mols igen');
    expect(ny?.pakkede_item_uids ?? []).toEqual([]);
  });

  it('foreslår ikke at skifte noget ud, man selv har givet fire stjerner', async () => {
    // Stormkøkkenet er 580 g lettere end Trangiaen og har samme tag, så det er
    // et oplagt bytte — indtil Trangiaen får fire stjerner. Det er den ene
    // dokumenterede regel, hvor evalueringen påvirker forslagene.
    const inventar = await grejet();
    const tur = { ...(await turen()), gruppe_ids: [], loese_item_ids: [trangia.uid] };
    const paa = [inventar.find((i) => i.navn === 'Trangia')!];

    expect(vaegtbrydere(tur, [], inventar, paa).map((b) => b.tung.navn)).toEqual(['Trangia']);

    // Fire stjerner, og forslaget forsvinder. Stormkøkkenet er stadig lettere;
    // motoren har bare ikke længere noget at indvende mod det, man har valgt.
    const vurderet = paa.map((i) => ({ ...i, vurdering: 4 }));
    expect(vaegtbrydere(tur, [], inventar, vurderet)).toEqual([]);
  });
});
