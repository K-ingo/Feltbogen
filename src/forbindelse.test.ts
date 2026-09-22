import { describe, it, expect, vi } from 'vitest';
import { kanNaaUd, PROEVEADRESSE } from './forbindelse';

// Offline-linjen på Pakning. Reed-testen på PR #80 fandt, at linjen blev ved
// med at sige "også uden net" på en telefon uden net: `navigator.onLine` sagde
// sandt. Derfor spørges der også ud, og det er dét, der testes her.
describe('kanNaaUd', () => {
  it('spørger ikke engang, når browseren ved, den er offline', async () => {
    const hent = vi.fn();

    expect(await kanNaaUd(hent, false)).toBe(false);
    expect(hent).not.toHaveBeenCalled();
  });

  it('er offline, når kaldet fejler — selvom browseren siger online', async () => {
    const hent = vi.fn().mockRejectedValue(new TypeError('Failed to fetch'));

    expect(await kanNaaUd(hent, true)).toBe(false);
  });

  it('er online, når noget svarer', async () => {
    const hent = vi.fn().mockResolvedValue(new Response(null, { status: 200 }));

    expect(await kanNaaUd(hent, true)).toBe(true);
  });

  it('regner et svar med fejlkode som forbindelse — der kom jo et svar', async () => {
    const hent = vi.fn().mockResolvedValue(new Response(null, { status: 503 }));

    expect(await kanNaaUd(hent, true)).toBe(true);
  });

  it('giver op efter fristen og er offline', async () => {
    // Et kald, der aldrig svarer, men respekterer afbrydelsen — som fetch.
    const hent = vi.fn((_: RequestInfo | URL, init?: RequestInit) => new Promise<Response>((_, afvis) => {
      init?.signal?.addEventListener('abort', () => afvis(new DOMException('afbrudt', 'AbortError')));
    }));

    expect(await kanNaaUd(hent as unknown as typeof fetch, true, 10)).toBe(false);
  });

  it('går uden om cachen, så service workeren ikke kan lade som om', async () => {
    const hent = vi.fn().mockResolvedValue(new Response(null, { status: 200 }));

    await kanNaaUd(hent, true);

    const [adresse, init] = hent.mock.calls[0];
    expect(adresse).toMatch(new RegExp(`^${PROEVEADRESSE}\\?forbindelse=\\d+$`));
    expect(init).toMatchObject({ method: 'HEAD', cache: 'no-store' });
  });
});
