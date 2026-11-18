import { describe, it, expect, afterEach, vi } from 'vitest';
import {
  hentMedTimeout,
  TimeoutFejl,
  erTimeout,
  netfejltekst,
  timeoutFor,
  TIMEOUT_MS,
  TIMEOUT_FIL_MS
} from './netkald';
import { loginFejlBesked } from './pbFejl';

// En fetch der aldrig svarer af sig selv — kun når den bliver afbrudt. Det er
// præcis den, der fik knapperne til at stå og sige "Tjekker…" for evigt.
function haengendeFetch() {
  return vi.fn((_adresse: RequestInfo | URL, init?: RequestInit) => new Promise<Response>((_ok, fejl) => {
    init?.signal?.addEventListener('abort', () => {
      fejl(Object.assign(new Error('The operation was aborted.'), { name: 'AbortError' }));
    });
  }));
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe('hentMedTimeout', () => {
  it('giver svaret videre, når det kommer i tide', async () => {
    const fetch = vi.fn<typeof globalThis.fetch>(async () => new Response('{"ok":true}', { status: 200 }));
    vi.stubGlobal('fetch', fetch);

    const svar = await hentMedTimeout('https://eksempel.test/api', { cache: 'no-store' });

    expect(svar.status).toBe(200);
    expect(await svar.json()).toEqual({ ok: true });
    // Kalderens egne indstillinger kommer med — plus et signal.
    const init = fetch.mock.calls[0][1] as RequestInit;
    expect(init.cache).toBe('no-store');
    expect(init.signal).toBeInstanceOf(AbortSignal);
  });

  it('afbryder og kaster TimeoutFejl, når serveren ikke svarer', async () => {
    vi.useFakeTimers();
    const fetch = haengendeFetch();
    vi.stubGlobal('fetch', fetch);

    const kald = hentMedTimeout('https://eksempel.test/api', {}, 5000);
    const fanget = kald.catch((e: unknown) => e);
    await vi.advanceTimersByTimeAsync(5000);
    const fejl = await fanget;

    expect(fejl).toBeInstanceOf(TimeoutFejl);
    expect((fejl as TimeoutFejl).ms).toBe(5000);
    expect((fejl as Error).message).toBe(
      'Serveren svarede ikke inden for 5 sekunder. Tjek din forbindelse og prøv igen.'
    );
    const signal = (fetch.mock.calls[0][1] as RequestInit).signal!;
    expect(signal.aborted).toBe(true);
  });

  it('giver ikke op før tiden er gået', async () => {
    vi.useFakeTimers();
    let svar: (r: Response) => void = () => {};
    vi.stubGlobal('fetch', vi.fn(() => new Promise<Response>((ok) => { svar = ok; })));

    const kald = hentMedTimeout('https://eksempel.test/api', {}, 5000);
    await vi.advanceTimersByTimeAsync(4999);
    svar(new Response('sent, men i tide'));

    expect(await (await kald).text()).toBe('sent, men i tide');
  });

  it('bruger 15 sekunder som standard', async () => {
    vi.useFakeTimers();
    vi.stubGlobal('fetch', haengendeFetch());

    const fanget = hentMedTimeout('https://eksempel.test/api').catch((e: unknown) => e);
    await vi.advanceTimersByTimeAsync(TIMEOUT_MS - 1);
    let faerdig = false;
    void fanget.then(() => { faerdig = true; });
    await Promise.resolve();
    expect(faerdig).toBe(false);

    await vi.advanceTimersByTimeAsync(1);
    expect(await fanget).toBeInstanceOf(TimeoutFejl);
  });

  // Kalderens egen afbrydelse er ikke en timeout, og må ikke ligne en.
  it('respekterer kalderens eget signal', async () => {
    vi.stubGlobal('fetch', haengendeFetch());
    const kontrol = new AbortController();

    const kald = hentMedTimeout('https://eksempel.test/api', { signal: kontrol.signal }, 5000);
    kontrol.abort();
    const fejl = await kald.catch((e: unknown) => e);

    expect(fejl).not.toBeInstanceOf(TimeoutFejl);
    expect((fejl as Error).name).toBe('AbortError');
  });

  it('lader en almindelig netværksfejl gå videre som den er', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => { throw new TypeError('Failed to fetch'); }));

    const fejl = await hentMedTimeout('https://eksempel.test/api').catch((e: unknown) => e);

    expect(fejl).toBeInstanceOf(TypeError);
    expect(erTimeout(fejl)).toBe(false);
  });
});

describe('timeoutFor', () => {
  it('giver en upload den lange grænse', () => {
    expect(timeoutFor({ body: new FormData() })).toBe(TIMEOUT_FIL_MS);
    expect(timeoutFor({ body: new Blob(['x']) })).toBe(TIMEOUT_FIL_MS);
  });

  it('giver alt andet den korte', () => {
    expect(timeoutFor()).toBe(TIMEOUT_MS);
    expect(timeoutFor({ body: '{"a":1}' })).toBe(TIMEOUT_MS);
  });
});

describe('fejlteksten', () => {
  it('kender en timeout, også pakket ind af PocketBase-klienten', () => {
    const indpakket = { status: 0, originalError: new TimeoutFejl(15_000) };
    expect(erTimeout(indpakket)).toBe(true);
    expect(netfejltekst(indpakket)).toBe(
      'Serveren svarede ikke inden for 15 sekunder. Tjek din forbindelse og prøv igen.'
    );
  });

  it('viser aldrig browserens rå engelske tekst', () => {
    expect(netfejltekst(new TypeError('Failed to fetch'))).toBe(
      'Kunne ikke nå serveren. Tjek din forbindelse og prøv igen.'
    );
  });

  it('bruges også på login-skærmen', () => {
    const indpakket = { status: 0, message: 'Something went wrong.', originalError: new TimeoutFejl(15_000) };
    expect(loginFejlBesked(indpakket)).toMatch(/^Serveren svarede ikke inden for 15 sekunder/);
  });
});

// Alle PocketBase-kald går gennem helperen (pb.beforeSend i pb.ts), og det
// samme gør helbredstjekket på Indstillinger.
describe('PocketBase-klienten og forbindelsestjekket', () => {
  it('afbryder et PocketBase-kald, der hænger, med en dansk fejl', async () => {
    const { pb } = await import('./pb');
    vi.useFakeTimers();
    const fetch = haengendeFetch();
    vi.stubGlobal('fetch', fetch);

    const fanget = pb.collection('items').getList(1, 1).catch((e: unknown) => e);
    await vi.advanceTimersByTimeAsync(TIMEOUT_MS);
    const fejl = await fanget;

    expect(fetch).toHaveBeenCalled();
    expect((fejl as { status?: number }).status).toBe(0);
    expect(erTimeout(fejl)).toBe(true);
    expect(loginFejlBesked(fejl)).toMatch(/^Serveren svarede ikke inden for 15 sekunder/);
  });

  it('svarer på forbindelsestjekket i stedet for at hænge', async () => {
    const { tjekForbindelse } = await import('./pb');
    vi.useFakeTimers();
    vi.stubGlobal('fetch', haengendeFetch());

    const svar = tjekForbindelse();
    await vi.advanceTimersByTimeAsync(TIMEOUT_MS);
    const resultat = await svar;

    expect(resultat.ok).toBe(false);
    expect(resultat.tekst).toMatch(/svarede ikke i tide/);
    expect(resultat.tekst).not.toMatch(/abort/i);
  });
});

// Reglen er "alle netkald", og den holder kun, hvis den bliver ved med at
// holde. Et nyt fetch-kald uden om helperen får den her til at falde.
describe('ingen rå fetch-kald i appen', () => {
  it('går alle netkald gennem hentMedTimeout', async () => {
    const { readdirSync, readFileSync } = await import('node:fs');
    const { join } = await import('node:path');
    const mappe = join(process.cwd(), 'src');

    const synder = readdirSync(mappe)
      .filter((f) => /\.tsx?$/.test(f) && !/\.test\.tsx?$/.test(f) && f !== 'netkald.ts')
      // Både et kald og en standardværdi (`hent = fetch`) tæller: den sidste
      // er et kald, der bare sker et andet sted.
      .filter((f) => /(^|[^\w.])fetch\s*\(|=\s*fetch\b/m.test(readFileSync(join(mappe, f), 'utf8')));

    expect(synder).toEqual([]);
  });
});

describe('en fetch-attrap som argument', () => {
  it('bruger den i stedet for den globale', async () => {
    const attrap = vi.fn<typeof globalThis.fetch>(async () => new Response('fra attrappen'));

    const svar = await hentMedTimeout('/x', {}, 1000, attrap);

    expect(await svar.text()).toBe('fra attrappen');
    expect(attrap).toHaveBeenCalledOnce();
  });
});
