import { describe, it, expect, beforeEach } from 'vitest';

import { db } from './db';
import type { Gaestesnapshot } from './gaest';
import { kontostatus, adopterBase, rydEnhed, laesEjer, KONTO_EJER } from './konto';
import { saet, laes, KROPSVAEGT } from './indstillinger';
import { lavItem, lavGruppe, lavTur, lavSted, lavPerson, lavBillede, lavTurDag } from './test/data';

beforeEach(async () => {
  await Promise.all([
    db.items.clear(),
    db.grupper.clear(),
    db.ture.clear(),
    db.tur_dage.clear(),
    db.steder.clear(),
    db.personer.clear(),
    db.billeder.clear(),
    db.slettede.clear(),
    db.delte_ture.clear(),
    db.afviste_forslag.clear(),
    db.indstillinger.clear()
  ]);
});

describe('kontostatus', () => {
  it('siger uden_konto, når ingen er logget ind', async () => {
    expect(await kontostatus(null)).toBe('uden_konto');
  });

  it('siger uden_konto, selv når basen har en ejer', async () => {
    await adopterBase('emil');
    expect(await kontostatus(null)).toBe('uden_konto');
  });

  it('siger umaerket, når basen aldrig har haft en konto', async () => {
    expect(await kontostatus('emil')).toBe('umaerket');
  });

  it('siger egen, når mærket passer', async () => {
    await adopterBase('emil');
    expect(await kontostatus('emil')).toBe('egen');
  });

  it('siger fremmed, når mærket peger et andet sted hen', async () => {
    await adopterBase('emil');
    expect(await kontostatus('maja')).toBe('fremmed');
  });
});

// Det er de tre overgange, der ikke må forveksles. To af dem skal være
// lydløse; den tredje må aldrig være det.
describe('de tre overgange', () => {
  it('adopterer data lavet uden konto — det er ens egne', async () => {
    await db.items.add(lavItem({ navn: 'Fra før kontoen' }));

    expect(await kontostatus('emil')).toBe('umaerket');
    await adopterBase('emil');

    expect(await kontostatus('emil')).toBe('egen');
    expect(await db.items.count()).toBe(1);
  });

  it('koster ingenting at logge ud og ind igen', async () => {
    await adopterBase('emil');
    await db.items.add(lavItem({ navn: 'Sovepose' }));

    // logUd() rører ikke basen — mærket bliver, og det er meningen.
    expect(await kontostatus('emil')).toBe('egen');
    expect(await db.items.count()).toBe(1);
  });

  it('stopper ved en anden konto i stedet for at blande', async () => {
    await adopterBase('emil');
    await db.items.add(lavItem({ navn: 'Emils økse' }));

    expect(await kontostatus('maja')).toBe('fremmed');
    // Intet er rørt. Rydningen sker kun, hvis nogen beder om den.
    expect(await db.items.count()).toBe(1);
    expect(await laesEjer()).toBe('emil');
  });
});

describe('rydEnhed', () => {
  const fyldOp = async () => {
    await db.items.add(lavItem({ navn: 'Økse' }));
    await db.grupper.add(lavGruppe({ navn: 'Sommer' }));
    await db.ture.add(lavTur({ navn: 'Møn' }));
    await db.tur_dage.add(lavTurDag({ tur_uid: 'tur-1' }));
    await db.steder.add(lavSted({ navn: 'Hareskoven' }));
    await db.personer.add(lavPerson({ navn: 'Maja' }));
    await db.billeder.add(lavBillede({ tur_uid: 'tur-1' }));
    await db.slettede.add({ samling: 'items', pb_id: 'pb1', uid: 'uid-1', slettet: new Date() });
    // Indholdet er ligegyldigt her — testen handler om, at rækken forsvinder,
    // ikke om hvad der stod i den. Derfor et tomt snapshot frem for tredive
    // felter, ingen læser.
    await db.delte_ture.add({
      token: 'abc',
      snapshot: {} as Gaestesnapshot,
      kilde: 'https://feltbogen.dk',
      tur_pb_id: 'pb-tur',
      gemt: new Date(),
      opdateret: new Date()
    });
    await db.afviste_forslag.add({
      tur_uid: 'tur-1',
      forslag_id: 'f1',
      aftryk: '',
      afvist: new Date()
    });
  };

  it('tager alle tabellerne med', async () => {
    await adopterBase('emil');
    await fyldOp();

    await rydEnhed('maja');

    expect(await db.items.count()).toBe(0);
    expect(await db.grupper.count()).toBe(0);
    expect(await db.ture.count()).toBe(0);
    expect(await db.tur_dage.count()).toBe(0);
    expect(await db.steder.count()).toBe(0);
    expect(await db.personer.count()).toBe(0);
    expect(await db.billeder.count()).toBe(0);
    expect(await db.delte_ture.count()).toBe(0);
    expect(await db.afviste_forslag.count()).toBe(0);
  });

  // Sporene peger på den forrige ejers records. Blev de liggende, ville de
  // blive sendt af sted under den nye konto ved næste synkronisering.
  it('tager sporene efter usendte sletninger med', async () => {
    await adopterBase('emil');
    await fyldOp();

    await rydEnhed('maja');

    expect(await db.slettede.count()).toBe(0);
  });

  // Kropsvægt og afgangs-skabelonen er den forrige ejers persondata og hører
  // ikke til hos den næste.
  it('tager enhedens indstillinger med', async () => {
    await adopterBase('emil');
    await saet(KROPSVAEGT, '82');

    await rydEnhed('maja');

    expect(await laes(KROPSVAEGT)).toBeNull();
  });

  it('giver enheden til den nye konto', async () => {
    await adopterBase('emil');
    await fyldOp();

    await rydEnhed('maja');

    expect(await laesEjer()).toBe('maja');
    expect(await kontostatus('maja')).toBe('egen');
  });

  // Ejermærket er det eneste, der må stå tilbage i indstillingerne. Ryddes det
  // med, ville basen se umærket ud, og næste login ville adoptere den i stedet
  // for at spørge.
  it('efterlader kun ejermærket i indstillingerne', async () => {
    await adopterBase('emil');
    await saet(KROPSVAEGT, '82');

    await rydEnhed('maja');

    expect((await db.indstillinger.toArray()).map((i) => i.noegle)).toEqual([KONTO_EJER]);
  });
});
