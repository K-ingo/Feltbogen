import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  FORTRYD_MS,
  afvisFortrydelse,
  fortrydBesked,
  fortryd,
  meldFortrydelse,
  nuvaerendeFortrydelse
} from './fortryd';

const intet = () => Promise.resolve();

beforeEach(() => {
  vi.useFakeTimers();
  afvisFortrydelse();
});

afterEach(() => {
  vi.useRealTimers();
});

describe('fortrydBesked', () => {
  it('nævner hvad der blev slettet', () => {
    expect(fortrydBesked({ slags: 'Gearet', navn: 'Toaks 1L', genskab: intet }))
      .toBe('Gearet "Toaks 1L" er slettet');
  });

  // Man kan nå at slette en tur inden den fik et navn.
  it('klarer sig uden navn', () => {
    expect(fortrydBesked({ slags: 'Turen', navn: '   ', genskab: intet }))
      .toBe('Turen er slettet');
  });
});

describe('fortryd', () => {
  it('kalder genskabelsen', async () => {
    const genskab = vi.fn(intet);
    meldFortrydelse({ slags: 'Gearet', navn: 'Tarp', genskab });

    await fortryd();

    expect(genskab).toHaveBeenCalledTimes(1);
  });

  // To hurtige tryk må ikke lægge posten tilbage to gange.
  it('kan kun fortrydes én gang', async () => {
    const genskab = vi.fn(intet);
    meldFortrydelse({ slags: 'Gearet', navn: 'Tarp', genskab });

    await Promise.all([fortryd(), fortryd()]);

    expect(genskab).toHaveBeenCalledTimes(1);
  });

  it('gør ingenting når der ikke er noget at fortryde', async () => {
    await expect(fortryd()).resolves.toBeUndefined();
  });
});

// Et afvist forslag er ikke slettet, og beskeden må ikke sige at det er.
describe('fortrydBesked med gjort', () => {
  it('siger hvad der faktisk skete', () => {
    expect(fortrydBesked({
      slags: 'Forslaget',
      navn: 'Lettere grej i skabet',
      gjort: 'afvist',
      genskab: intet
    })).toBe('Forslaget "Lettere grej i skabet" er afvist');
  });
});

describe('vinduet', () => {
  it('lukker af sig selv efter 25 sekunder', async () => {
    const genskab = vi.fn(intet);
    meldFortrydelse({ slags: 'Gearet', navn: 'Tarp', genskab });

    vi.advanceTimersByTime(FORTRYD_MS);
    await fortryd();

    // Sletningen står ved magt — det er den rigtige vej rundt.
    expect(genskab).not.toHaveBeenCalled();
  });

  it('står stadig lige inden tiden er gået', async () => {
    const genskab = vi.fn(intet);
    meldFortrydelse({ slags: 'Gearet', navn: 'Tarp', genskab });

    vi.advanceTimersByTime(FORTRYD_MS - 1);
    await fortryd();

    expect(genskab).toHaveBeenCalledTimes(1);
  });

  // En ny sletning afløser den forrige — to beskeder oven på hinanden er
  // værre end at den første forsvinder.
  it('lader den nyeste sletning afløse den forrige', async () => {
    const foerste = vi.fn(intet);
    const anden = vi.fn(intet);

    meldFortrydelse({ slags: 'Gearet', navn: 'Først', genskab: foerste });
    meldFortrydelse({ slags: 'Turen', navn: 'Så', genskab: anden });
    await fortryd();

    expect(foerste).not.toHaveBeenCalled();
    expect(anden).toHaveBeenCalledTimes(1);
  });

  // Den forrige sletnings ur må ikke lukke den nye besked før tid.
  it('starter nedtællingen forfra ved den næste sletning', async () => {
    const genskab = vi.fn(intet);

    meldFortrydelse({ slags: 'Gearet', navn: 'Først', genskab: intet });
    vi.advanceTimersByTime(FORTRYD_MS - 1000);
    meldFortrydelse({ slags: 'Turen', navn: 'Så', genskab });

    vi.advanceTimersByTime(2000);
    await fortryd();

    expect(genskab).toHaveBeenCalledTimes(1);
  });

  it('kan afvises i hånden', async () => {
    const genskab = vi.fn(intet);
    meldFortrydelse({ slags: 'Gearet', navn: 'Tarp', genskab });

    afvisFortrydelse();
    await fortryd();

    expect(genskab).not.toHaveBeenCalled();
  });
});

// To beskeder kan sagtens sige det samme — to ting med samme navn, to ens
// forslag. Nedtællingen skal begynde forfra alligevel, og det er nummeret der
// bærer det.
describe('meldingens nummer', () => {
  it('tæller op, også når beskeden er den samme', () => {
    meldFortrydelse({ slags: 'Forslaget', navn: 'Rygsækkene er skæve', genskab: intet });
    const foerste = nuvaerendeFortrydelse()?.nr ?? 0;

    meldFortrydelse({ slags: 'Forslaget', navn: 'Rygsækkene er skæve', genskab: intet });
    const anden = nuvaerendeFortrydelse()?.nr ?? 0;

    expect(anden).toBeGreaterThan(foerste);
  });
});
