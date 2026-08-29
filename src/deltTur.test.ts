import { describe, it, expect, beforeEach, vi } from 'vitest';

vi.mock('./pb', () => import('./test/pbMock'));

import { db } from './db';
import { pbMock } from './test/pbMock';
import {
  gemDeltTur,
  sletDeltTur,
  erDeltTurGemt,
  opdaterDeltTur,
  hentDeltTur,
  lavSnapshot
} from './gaest';
import type { Gaestesnapshot, GaesteItem } from './gaest';
import { ledigtFaelles, gaestetitel } from './gaest';
import { lavItem, lavGruppe, lavTur } from './test/data';

// Et gæstelink er et kig, ikke en kopi. Herunder testes det gæsten kan gøre
// ved turen bagefter: gemme den hos sig selv, finde den igen, og hente
// ejerens nyeste udgave.

const KILDE = 'https://feltbogen.vercel.app';

function snapshotFor(navn: string): Gaestesnapshot {
  const telt = lavItem({ uid: 'u-telt', navn: 'Telt', vaegt_g: 2400 });
  return lavSnapshot(
    lavTur({ navn, sted: 'Rold', startdato: '2026-08-21', slutdato: '2026-08-23', loese_item_ids: ['u-telt'] }),
    [lavGruppe({ uid: 'g-1', navn: 'Sovegrej', item_ids: [] })],
    [telt]
  );
}

beforeEach(async () => {
  pbMock.reset();
  await db.delte_ture.clear();
});

describe('gemDeltTur', () => {
  it('lægger turen i basen så den kan findes uden linket', async () => {
    await gemDeltTur('a'.repeat(32), snapshotFor('Rold Skov'), KILDE);

    const gemte = await db.delte_ture.toArray();
    expect(gemte).toHaveLength(1);
    expect(gemte[0].snapshot.navn).toBe('Rold Skov');
    expect(gemte[0].kilde).toBe(KILDE);
  });

  // Man kan sagtens komme til at åbne linket to gange — fra sms'en og fra
  // browserhistorikken. Så skal turen ikke ligge to steder i listen.
  it('opdaterer den gemte frem for at lægge en til', async () => {
    const token = 'b'.repeat(32);
    await gemDeltTur(token, snapshotFor('Rold Skov'), KILDE);
    await gemDeltTur(token, snapshotFor('Rold Skov — udsat'), KILDE);

    const gemte = await db.delte_ture.toArray();
    expect(gemte).toHaveLength(1);
    expect(gemte[0].snapshot.navn).toBe('Rold Skov — udsat');
  });

  it('holder to forskellige links hver for sig', async () => {
    await gemDeltTur('c'.repeat(32), snapshotFor('Rold Skov'), KILDE);
    await gemDeltTur('d'.repeat(32), snapshotFor('Mols Bjerge'), KILDE);

    expect(await db.delte_ture.count()).toBe(2);
  });

  // "gemt" er hvornår gæsten tog turen ind, "opdateret" hvornår indholdet
  // sidst kom fra ejeren. Listen sorterer efter den første.
  it('lader gemt stå fast når turen opdateres', async () => {
    const token = 'e'.repeat(32);
    const foerst = new Date('2026-08-01T10:00:00Z');
    const senere = new Date('2026-08-05T10:00:00Z');

    await gemDeltTur(token, snapshotFor('Rold Skov'), KILDE, foerst);
    await gemDeltTur(token, snapshotFor('Rold Skov'), KILDE, senere);

    const gemt = await erDeltTurGemt(token);
    expect(gemt?.gemt).toEqual(foerst);
    expect(gemt?.opdateret).toEqual(senere);
  });
});

describe('erDeltTurGemt', () => {
  it('finder turen på tokenet', async () => {
    const token = 'f'.repeat(32);
    await gemDeltTur(token, snapshotFor('Rold Skov'), KILDE);
    expect((await erDeltTurGemt(token))?.snapshot.navn).toBe('Rold Skov');
  });

  it('siger ingenting om et link man ikke har gemt', async () => {
    expect(await erDeltTurGemt('0'.repeat(32))).toBeUndefined();
  });
});

describe('sletDeltTur', () => {
  it('fjerner turen', async () => {
    const id = await gemDeltTur('1'.repeat(32), snapshotFor('Rold Skov'), KILDE);
    await sletDeltTur(id);
    expect(await db.delte_ture.count()).toBe(0);
  });
});

describe('hentDeltTur', () => {
  it('finder turen på dens deletoken', async () => {
    const token = '2'.repeat(32);
    pbMock.seed('ture', 'pb-tur', {
      dele_token: token,
      dele_snapshot: JSON.stringify(snapshotFor('Rold Skov'))
    });

    const svar = await hentDeltTur(token);
    expect(svar.slags).toBe('ok');
    if (svar.slags === 'ok') expect(svar.snapshot.navn).toBe('Rold Skov');
  });

  it('siger ikke_fundet når intet svarer til tokenet', async () => {
    pbMock.seed('ture', 'pb-tur', { dele_token: '3'.repeat(32), dele_snapshot: '{}' });
    expect((await hentDeltTur('4'.repeat(32))).slags).toBe('ikke_fundet');
  });
});

describe('opdaterDeltTur', () => {
  const token = '5'.repeat(32);

  it('henter ejerens nyeste ind over den gemte', async () => {
    pbMock.seed('ture', 'pb-tur', {
      dele_token: token,
      dele_snapshot: JSON.stringify(snapshotFor('Rold Skov'))
    });
    await gemDeltTur(token, snapshotFor('Rold Skov'), KILDE);

    pbMock.roer('ture', 'pb-tur', {
      dele_snapshot: JSON.stringify(snapshotFor('Rold Skov — nu med shelter'))
    });

    const gemt = await erDeltTurGemt(token);
    expect(await opdaterDeltTur(gemt!)).toBe('opdateret');
    expect((await erDeltTurGemt(token))?.snapshot.navn).toBe('Rold Skov — nu med shelter');
  });

  // Uden dækning er en tur man kan læse bedre end en tom skærm. Det gemte
  // øjebliksbillede må ikke ryge, bare fordi opdateringen ikke kunne nås.
  it('lader den gemte stå når der ikke er forbindelse', async () => {
    await gemDeltTur(token, snapshotFor('Rold Skov'), KILDE);
    const gemt = await erDeltTurGemt(token);

    pbMock.offline = true;
    expect(await opdaterDeltTur(gemt!)).toBe('fejl');
    expect((await erDeltTurGemt(token))?.snapshot.navn).toBe('Rold Skov');
  });

  it('lader den gemte stå når ejeren har trukket delingen tilbage', async () => {
    await gemDeltTur(token, snapshotFor('Rold Skov'), KILDE);
    const gemt = await erDeltTurGemt(token);

    expect(await opdaterDeltTur(gemt!)).toBe('ikke_fundet');
    expect((await erDeltTurGemt(token))?.snapshot.navn).toBe('Rold Skov');
  });

  it('lægger ikke en ekstra tur ind når den opdateres', async () => {
    pbMock.seed('ture', 'pb-tur', {
      dele_token: token,
      dele_snapshot: JSON.stringify(snapshotFor('Rold Skov'))
    });
    await gemDeltTur(token, snapshotFor('Rold Skov'), KILDE);

    await opdaterDeltTur((await erDeltTurGemt(token))!);
    expect(await db.delte_ture.count()).toBe(1);
  });
});

// En delt tur er ikke ens egen. Den må aldrig havne i ens egne ture og
// dermed i ens egen PocketBase-konto.
describe('afgrænsning', () => {
  it('rører ikke turtabellen', async () => {
    await db.ture.clear();
    await gemDeltTur('6'.repeat(32), snapshotFor('Rold Skov'), KILDE);
    expect(await db.ture.count()).toBe(0);
  });

  it('sender ikke noget til PocketBase når man gemmer', async () => {
    await gemDeltTur('7'.repeat(32), snapshotFor('Rold Skov'), KILDE);
    expect(pbMock.kald.filter((k) => k.metode === 'create')).toHaveLength(0);
  });
});

// ─────────────────────────────────────────────
// Turen læst med gæstens øjne
// ─────────────────────────────────────────────

describe('ledigtFaelles', () => {
  const item = (navn: string, felter: Partial<GaesteItem> = {}): GaesteItem => ({
    uid: navn.toLowerCase(), navn, vaegt_g: 500, delt: false, baerer: '', ...felter
  });

  it('finder fælles grej som ingen har taget', () => {
    const afsnit = [{ titel: 'Køkken', items: [
      item('Trangia', { delt: true }),
      item('Gasdåse', { delt: true, baerer: 'Mikkel' })
    ]}];

    expect(ledigtFaelles(afsnit).map((i) => i.navn)).toEqual(['Trangia']);
  });

  // Ejerens egen sovepose uden bærer er hendes eget. Det er ikke noget en
  // gæst kan melde sig til at bære.
  it('rører ikke ejerens personlige grej', () => {
    const afsnit = [{ titel: 'Sovegrej', items: [item('Sovepose')] }];
    expect(ledigtFaelles(afsnit)).toEqual([]);
  });

  it('regner grej som taget, når en deltager selv har meldt sig', () => {
    const afsnit = [{ titel: 'Køkken', items: [item('Trangia', { delt: true })] }];
    const meldte = new Map([['trangia', ['Sofie']]]);

    expect(ledigtFaelles(afsnit, meldte)).toEqual([]);
  });

  // Gear fra et gammelt link har intet uid og kan ikke peges på. Det tælles
  // stadig som ledigt — man kan bare ikke klikke sig til det.
  it('tæller gear uden uid med', () => {
    const afsnit = [{ titel: 'Køkken', items: [item('Trangia', { uid: '', delt: true })] }];
    expect(ledigtFaelles(afsnit)).toHaveLength(1);
  });
});

describe('gaestetitel', () => {
  // "Uden tag" er ejerens ord om sit eget system. En gæst ved ikke hvad et
  // tag er, og skal ikke lære det for at læse en pakkeliste.
  it('oversætter ejerens interne afsnitsnavne', () => {
    expect(gaestetitel('Uden tag')).toBe('Andet');
    expect(gaestetitel('Ikke fordelt endnu')).toBe('Ingen har taget den endnu');
  });

  it('lader ejerens egne tags stå som de er', () => {
    expect(gaestetitel('Sovegrej')).toBe('Sovegrej');
  });
});
