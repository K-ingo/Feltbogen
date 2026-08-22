import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  FORTRYD_MS,
  afvisFortrydelse,
  fortrydBesked,
  fortrydSletning,
  meldSletning
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

describe('fortrydSletning', () => {
  it('kalder genskabelsen', async () => {
    const genskab = vi.fn(intet);
    meldSletning({ slags: 'Gearet', navn: 'Tarp', genskab });

    await fortrydSletning();

    expect(genskab).toHaveBeenCalledTimes(1);
  });

  // To hurtige tryk må ikke lægge posten tilbage to gange.
  it('kan kun fortrydes én gang', async () => {
    const genskab = vi.fn(intet);
    meldSletning({ slags: 'Gearet', navn: 'Tarp', genskab });

    await Promise.all([fortrydSletning(), fortrydSletning()]);

    expect(genskab).toHaveBeenCalledTimes(1);
  });

  it('gør ingenting når der ikke er noget at fortryde', async () => {
    await expect(fortrydSletning()).resolves.toBeUndefined();
  });
});

describe('vinduet', () => {
  it('lukker af sig selv efter 25 sekunder', async () => {
    const genskab = vi.fn(intet);
    meldSletning({ slags: 'Gearet', navn: 'Tarp', genskab });

    vi.advanceTimersByTime(FORTRYD_MS);
    await fortrydSletning();

    // Sletningen står ved magt — det er den rigtige vej rundt.
    expect(genskab).not.toHaveBeenCalled();
  });

  it('står stadig lige inden tiden er gået', async () => {
    const genskab = vi.fn(intet);
    meldSletning({ slags: 'Gearet', navn: 'Tarp', genskab });

    vi.advanceTimersByTime(FORTRYD_MS - 1);
    await fortrydSletning();

    expect(genskab).toHaveBeenCalledTimes(1);
  });

  // En ny sletning afløser den forrige — to beskeder oven på hinanden er
  // værre end at den første forsvinder.
  it('lader den nyeste sletning afløse den forrige', async () => {
    const foerste = vi.fn(intet);
    const anden = vi.fn(intet);

    meldSletning({ slags: 'Gearet', navn: 'Først', genskab: foerste });
    meldSletning({ slags: 'Turen', navn: 'Så', genskab: anden });
    await fortrydSletning();

    expect(foerste).not.toHaveBeenCalled();
    expect(anden).toHaveBeenCalledTimes(1);
  });

  // Den forrige sletnings ur må ikke lukke den nye besked før tid.
  it('starter nedtællingen forfra ved den næste sletning', async () => {
    const genskab = vi.fn(intet);

    meldSletning({ slags: 'Gearet', navn: 'Først', genskab: intet });
    vi.advanceTimersByTime(FORTRYD_MS - 1000);
    meldSletning({ slags: 'Turen', navn: 'Så', genskab });

    vi.advanceTimersByTime(2000);
    await fortrydSletning();

    expect(genskab).toHaveBeenCalledTimes(1);
  });

  it('kan afvises i hånden', async () => {
    const genskab = vi.fn(intet);
    meldSletning({ slags: 'Gearet', navn: 'Tarp', genskab });

    afvisFortrydelse();
    await fortrydSletning();

    expect(genskab).not.toHaveBeenCalled();
  });
});
