// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import { erSkrivefelt, skjulBundnav, tastaturFremme } from './skrivefelt';

const input = (type?: string) => {
  const el = document.createElement('input');
  if (type) el.type = type;
  return el;
};

describe('erSkrivefelt', () => {
  it('kender felterne, der giver et tastatur', () => {
    expect(erSkrivefelt(input())).toBe(true);
    expect(erSkrivefelt(input('search'))).toBe(true);
    expect(erSkrivefelt(input('number'))).toBe(true);
    expect(erSkrivefelt(document.createElement('textarea'))).toBe(true);
    const redigerbar = document.createElement('div');
    redigerbar.setAttribute('contenteditable', 'true');
    expect(erSkrivefelt(redigerbar)).toBe(true);
  });

  it('lader afkrydsning, knapper og datovalg være', () => {
    expect(erSkrivefelt(input('checkbox'))).toBe(false);
    expect(erSkrivefelt(input('radio'))).toBe(false);
    expect(erSkrivefelt(input('date'))).toBe(false);
    expect(erSkrivefelt(document.createElement('button'))).toBe(false);
    expect(erSkrivefelt(document.body)).toBe(false);
    expect(erSkrivefelt(null)).toBe(false);
  });

  it('tæller ikke skrivebeskyttede eller slukkede felter med', () => {
    const laast = input();
    laast.readOnly = true;
    const slukket = document.createElement('textarea');
    slukket.disabled = true;
    expect(erSkrivefelt(laast)).toBe(false);
    expect(erSkrivefelt(slukket)).toBe(false);
  });
});

describe('tastaturFremme', () => {
  it('skelner et tastatur fra en adresselinje', () => {
    expect(tastaturFremme(844, 844)).toBe(false);
    expect(tastaturFremme(844, 780)).toBe(false);
    expect(tastaturFremme(844, 500)).toBe(true);
  });
});

describe('skjulBundnav', () => {
  const grund = { fokusISkrivefelt: true, tastatur: false, beroering: true, lukketUdenBlur: false };

  it('skjuler, så snart et felt får fokus på en berøringsskærm', () => {
    expect(skjulBundnav(grund)).toBe(true);
  });

  it('viser igen, når feltet slipper fokus', () => {
    expect(skjulBundnav({ ...grund, fokusISkrivefelt: false, tastatur: true })).toBe(false);
  });

  it('bliver stående med mus på en smal PC-browser', () => {
    expect(skjulBundnav({ ...grund, beroering: false })).toBe(false);
  });

  it('viser igen, når tastaturet lukkes, mens feltet beholder fokus', () => {
    expect(skjulBundnav({ ...grund, lukketUdenBlur: true })).toBe(false);
  });

  it('skjuler, når det synlige felt siger tastatur — også uden berøring', () => {
    expect(skjulBundnav({ ...grund, beroering: false, tastatur: true, lukketUdenBlur: true })).toBe(true);
  });
});
