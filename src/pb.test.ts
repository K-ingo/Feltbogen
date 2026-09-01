import { describe, it, expect, afterEach, vi } from 'vitest';
import { pb, erLoggetInd, fornyLogin, nuvaerendeBruger, serveradresse } from './pb';

// Et token appen kan tro på: PocketBase-klienten læser kun `exp` ud af
// nyttelasten, så resten behøver ikke være ægte.
function token(udloeber: Date): string {
  const krop = JSON.stringify({ id: 'bruger1', exp: Math.floor(udloeber.getTime() / 1000) });
  return `hoved.${Buffer.from(krop).toString('base64').replace(/=+$/, '')}.signatur`;
}

const OM_EN_TIME = new Date(Date.now() + 60 * 60 * 1000);
const FOR_EN_TIME_SIDEN = new Date(Date.now() - 60 * 60 * 1000);

const konto = {
  id: 'bruger1',
  collectionId: 'users',
  collectionName: 'users',
  email: 'test@eksempel.dk',
  created: '2026-01-01 00:00:00Z',
  updated: '2026-01-01 00:00:00Z'
};

function logInd(udloeber: Date) {
  pb.authStore.save(token(udloeber), konto);
}

// Et svar fra serveren, uden at der er en server.
function svar(status: number, krop: unknown = {}): Response {
  return new Response(JSON.stringify(krop), {
    status,
    headers: { 'content-type': 'application/json' }
  });
}

function serveren(svarer: () => Promise<Response>) {
  vi.stubGlobal('fetch', vi.fn(svarer));
}

afterEach(() => {
  pb.authStore.clear();
  vi.unstubAllGlobals();
});

describe('nuvaerendeBruger', () => {
  it('giver brugeren når sessionen er gyldig', () => {
    logInd(OM_EN_TIME);

    expect(nuvaerendeBruger()?.email).toBe('test@eksempel.dk');
    expect(erLoggetInd()).toBe(true);
  });

  // Fejlen der kostede en tavs sync: brugeren blev liggende i localStorage
  // efter tokenet var udløbet, appen troede den var logget ind, og PocketBase
  // afviste hver eneste skrivning med 400 og en tom fejlkrop.
  it('giver ingen bruger når tokenet er udløbet, selvom kontoen står gemt', () => {
    logInd(FOR_EN_TIME_SIDEN);

    expect(pb.authStore.record).not.toBeNull();
    expect(nuvaerendeBruger()).toBeNull();
    expect(erLoggetInd()).toBe(false);
  });

  it('giver ingen bruger når ingen har logget ind', () => {
    expect(nuvaerendeBruger()).toBeNull();
  });
});

describe('fornyLogin', () => {
  it('forlænger sessionen', async () => {
    logInd(OM_EN_TIME);
    const nyt = token(new Date(Date.now() + 14 * 24 * 60 * 60 * 1000));
    serveren(async () => svar(200, { token: nyt, record: konto }));

    await fornyLogin();

    expect(pb.authStore.token).toBe(nyt);
    expect(nuvaerendeBruger()?.id).toBe('bruger1');
  });

  // Skiftet kodeord eller slettet konto. Så skal appen bede om login frem for
  // at blive stående som logget ind og fejle på hver skrivning.
  it('rydder sessionen når serveren afviser tokenet', async () => {
    logInd(OM_EN_TIME);
    serveren(async () => svar(401, { code: 401, message: 'The request requires valid record authorization token.' }));

    await fornyLogin();

    expect(nuvaerendeBruger()).toBeNull();
    expect(pb.authStore.record).toBeNull();
  });

  // Man skal ikke logges ud af at stå uden dækning.
  it('beholder sessionen når nettet svigter', async () => {
    logInd(OM_EN_TIME);
    serveren(async () => { throw new TypeError('fetch failed'); });

    await fornyLogin();

    expect(nuvaerendeBruger()?.id).toBe('bruger1');
  });

  it('beholder sessionen når serveren har en dårlig dag', async () => {
    logInd(OM_EN_TIME);
    serveren(async () => svar(500, { code: 500, message: 'Something went wrong.' }));

    await fornyLogin();

    expect(nuvaerendeBruger()?.id).toBe('bruger1');
  });

  it('rører ikke serveren når der ikke er nogen session at forny', async () => {
    const kald = vi.fn(async () => svar(200));
    vi.stubGlobal('fetch', kald);

    await fornyLogin();
    logInd(FOR_EN_TIME_SIDEN);
    await fornyLogin();

    expect(kald).not.toHaveBeenCalled();
  });
});

// Adressen står på indstillingsskærmen, fordi en forkert server ellers er
// usynlig: appen opfører sig ens, den ringer bare det forkerte sted hen.
describe('serveradresse', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.resetModules();
  });

  it('viser appens eget domæne når adressen er relativ', async () => {
    vi.stubGlobal('window', { location: { origin: 'https://feltbogen.dk' } });
    vi.resetModules();

    const { serveradresse: fra } = await import('./pb');

    expect(fra()).toBe('https://feltbogen.dk (samme domæne som appen)');
  });

  it('viser adressen som den er når VITE_PB_URL peger et andet sted hen', async () => {
    vi.stubEnv('VITE_PB_URL', 'https://pb.eksempel.dk');
    vi.resetModules();

    const { serveradresse: fra } = await import('./pb');

    expect(fra()).toBe('https://pb.eksempel.dk');
  });

  // Uden et vindue — som her i testene — er der ingen origin at sætte foran.
  // Så skal der stadig stå noget forståeligt frem for en tom række.
  it('siger stadig noget når der ikke er noget vindue', () => {
    expect(serveradresse()).toBe('samme domæne som appen');
  });
});
