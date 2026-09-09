import { describe, it, expect, beforeEach, vi } from 'vitest';

vi.mock('./pb', () => import('./test/pbMock'));

import { db } from './db';
import { pbMock } from './test/pbMock';
import { friskDelteSnapshots } from './delesnapshot';
import { laesSnapshot, lavSnapshot } from './gaest';
import { opretItem, opretGruppe, opretTur, opdaterItem, opdaterTur, sletItem, opretTurDag, opdaterTurDag } from './sync';
import { lavItem, lavGruppe, lavTur, lavTurDag } from './test/data';
import { itemsPaaTur } from './smartMotor';

// Gæstens udgave skal følge med af sig selv. Testene her handler lige så meget
// om det den IKKE gør: skrive når intet er ændret, og dermed udløse sig selv
// i ring.

const TOKEN = 'a'.repeat(32);

async function delttur(over: Parameters<typeof lavTur>[0] = {}) {
  const itemId = await opretItem(lavItem({ navn: 'Telt', vaegt_g: 2400 }));
  const item = (await db.items.get(itemId))!;

  const gruppeId = await opretGruppe(lavGruppe({ navn: 'Sovegrej', item_ids: [item.uid] }));
  const gruppe = (await db.grupper.get(gruppeId))!;

  const turId = await opretTur(lavTur({
    navn: 'Rold Skov', gruppe_ids: [gruppe.uid], dele_token: TOKEN, ...over
  }));
  const tur = (await db.ture.get(turId))!;

  // Turen deles som appen ville gøre det: øjebliksbilledet fryses ned.
  await opdaterTur(turId, {
    dele_snapshot: JSON.stringify(lavSnapshot(tur, [gruppe], itemsPaaTur(tur, [gruppe], [item])))
  });

  return { turId, itemId, gruppeId, itemUid: item.uid };
}

beforeEach(async () => {
  pbMock.reset();
  await Promise.all([db.items.clear(), db.grupper.clear(), db.ture.clear(), db.tur_dage.clear(), db.slettede.clear()]);
});

describe('friskDelteSnapshots', () => {
  it('gør ingenting når ingen ture er delt', async () => {
    await opretTur(lavTur({ navn: 'Privat' }));
    expect(await friskDelteSnapshots()).toBe(0);
  });

  // Det vigtigste: uden en ændring skrives der ingenting. Ellers ville
  // ombygningen tælle som en skrivning og starte sig selv forfra.
  it('skriver ikke når intet har ændret sig', async () => {
    await delttur();
    expect(await friskDelteSnapshots()).toBe(0);
  });

  it('kan køres igen og igen uden at skrive', async () => {
    await delttur();
    expect(await friskDelteSnapshots()).toBe(0);
    expect(await friskDelteSnapshots()).toBe(0);
    expect(await friskDelteSnapshots()).toBe(0);
  });

  it('bygger om når turen får et nyt navn', async () => {
    const { turId } = await delttur();
    await opdaterTur(turId, { navn: 'Rold Skov, udsat' });

    expect(await friskDelteSnapshots()).toBe(1);
    const tur = await db.ture.get(turId);
    expect(laesSnapshot(tur?.dele_snapshot)?.navn).toBe('Rold Skov, udsat');
  });

  // Pakkelisten er sat sammen af items og grupper. Omdøber man et stykke gear,
  // ændrer det hvad gæsten skal se — også selvom turen ikke er rørt.
  it('bygger om når et stykke gear får et nyt navn', async () => {
    const { turId, itemId } = await delttur();
    await opdaterItem(itemId, { navn: 'Hilleberg Soulo' });

    expect(await friskDelteSnapshots()).toBe(1);
    const tur = await db.ture.get(turId);
    expect(JSON.stringify(laesSnapshot(tur?.dele_snapshot))).toContain('Hilleberg Soulo');
  });

  it('bygger om når vægten på et stykke gear ændrer sig', async () => {
    const { turId, itemId } = await delttur();
    await opdaterItem(itemId, { vaegt_g: 1900 });

    expect(await friskDelteSnapshots()).toBe(1);
    expect(laesSnapshot((await db.ture.get(turId))?.dele_snapshot)?.vaegt_i_alt_g).toBe(1900);
  });

  it('bygger om når gear forsvinder fra turen', async () => {
    const { turId, itemId } = await delttur();
    await sletItem(itemId);

    expect(await friskDelteSnapshots()).toBe(1);
    expect(laesSnapshot((await db.ture.get(turId))?.dele_snapshot)?.vaegt_i_alt_g).toBe(0);
  });

  it('bygger om når beskeden til gæsterne ændrer sig', async () => {
    const { turId } = await delttur();
    await opdaterTur(turId, { besked_fra_ejer: 'Vi mødes ved P kl. 15' });

    expect(await friskDelteSnapshots()).toBe(1);
    expect(laesSnapshot((await db.ture.get(turId))?.dele_snapshot)?.besked_fra_ejer)
      .toBe('Vi mødes ved P kl. 15');
  });

  // Efter en ombygning står de to igen på det samme, og næste kørsel skal
  // være tavs. Er den ikke det, kører den i ring.
  it('falder til ro igen efter en ombygning', async () => {
    const { turId } = await delttur();
    await opdaterTur(turId, { navn: 'Nyt navn' });

    expect(await friskDelteSnapshots()).toBe(1);
    expect(await friskDelteSnapshots()).toBe(0);
  });

  it('rører ikke en tur der ikke er delt', async () => {
    const privatId = await opretTur(lavTur({ navn: 'Privat', dele_token: '' }));
    await delttur();
    await friskDelteSnapshots();

    expect((await db.ture.get(privatId))?.dele_snapshot).toBe('');
  });

  it('bygger flere delte ture om på én gang', async () => {
    await delttur({ navn: 'Rold' });
    await delttur({ navn: 'Mols' });

    await db.ture.toCollection().modify({ navn: 'Rettet' });
    expect(await friskDelteSnapshots()).toBe(2);
  });

  // Er det gemte øjebliksbillede noget vrøvl — fra en halv skrivning eller en
  // ældre udgave — er et nyt bedre end at lade det stå.
  it('erstatter et øjebliksbillede der ikke kan læses', async () => {
    const { turId } = await delttur();
    await db.ture.update(turId, { dele_snapshot: 'ikke json' });

    expect(await friskDelteSnapshots()).toBe(1);
    expect(laesSnapshot((await db.ture.get(turId))?.dele_snapshot)?.navn).toBe('Rold Skov');
  });

  it('tager tidsstemplet med når der faktisk er noget nyt', async () => {
    const { turId } = await delttur();
    await opdaterTur(turId, { navn: 'Nyt navn' });

    const nu = new Date('2026-08-05T12:00:00.000Z');
    await friskDelteSnapshots(nu);

    expect(laesSnapshot((await db.ture.get(turId))?.dele_snapshot)?.delt_den)
      .toBe(nu.toISOString());
  });
});


// Dagsplanen er ejerens plan, og gæsten ser den frosset. Ændrer ejeren den,
// skal gæsten se det — ellers møder nogen op det forkerte sted.
describe('dagsplanen følger med', () => {
  const dagPaa = async (turUid: string, dag_nr: number, felter = {}) => {
    const { uid, id, ...resten } = lavTurDag({ tur_uid: turUid, dag_nr, ...felter });
    void uid; void id;
    return opretTurDag(resten);
  };

  it('bygger om, når der kommer en dag til', async () => {
    const { turId } = await delttur();
    const tur = (await db.ture.get(turId))!;

    await dagPaa(tur.uid, 1, { destination: 'Sortesø' });

    expect(await friskDelteSnapshots()).toBe(1);
    const frisk = laesSnapshot((await db.ture.get(turId))!.dele_snapshot);
    expect(frisk?.dage.map((d) => d.destination)).toEqual(['Sortesø']);
  });

  it('bygger om, når en dag rettes', async () => {
    const { turId } = await delttur();
    const tur = (await db.ture.get(turId))!;
    const dagId = await dagPaa(tur.uid, 1, { destination: 'Sortesø' });
    await friskDelteSnapshots();

    await opdaterTurDag(dagId, { destination: 'Møns Klint' });

    expect(await friskDelteSnapshots()).toBe(1);
    const frisk = laesSnapshot((await db.ture.get(turId))!.dele_snapshot);
    expect(frisk?.dage[0].destination).toBe('Møns Klint');
  });

  // Det samme krav som resten: uden en ændring må der ikke skrives, ellers
  // udløser ombygningen sig selv i ring.
  it('skriver ikke, når dagene står som de gjorde', async () => {
    const { turId } = await delttur();
    const tur = (await db.ture.get(turId))!;
    await dagPaa(tur.uid, 1, { destination: 'Sortesø' });
    await friskDelteSnapshots();

    expect(await friskDelteSnapshots()).toBe(0);
  });

  it('rører ikke en tur, hvis dage hører til en anden', async () => {
    const { turId } = await delttur();

    await dagPaa('en-helt-anden-tur', 1, { destination: 'Ikke min' });

    expect(await friskDelteSnapshots()).toBe(0);
    const frisk = laesSnapshot((await db.ture.get(turId))!.dele_snapshot);
    expect(frisk?.dage).toEqual([]);
  });
});
