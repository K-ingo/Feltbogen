import { describe, it, expect } from 'vitest';
import { navnestatus } from './navnestatus';

describe('navnestatus', () => {
  it('har intet at gemme, når navnet er uændret', () => {
    expect(navnestatus('Emil', 'Emil')).toEqual({ tomt: false, aendret: false, kanGemmes: false, visKnap: false });
  });

  it('kan gemme et ændret, gyldigt navn', () => {
    const s = navnestatus('Emilie', 'Emil');
    expect(s.kanGemmes).toBe(true);
    expect(s.visKnap).toBe(true);
  });

  it('gemmer aldrig et tomt navn', () => {
    const s = navnestatus('', 'Emil');
    expect(s.tomt).toBe(true);
    expect(s.aendret).toBe(true);
    expect(s.kanGemmes).toBe(false);
    expect(s.visKnap).toBe(true);
  });

  it('tæller kun mellemrum som tomt', () => {
    expect(navnestatus('   ', 'Emil').kanGemmes).toBe(false);
    expect(navnestatus('   ', 'Emil').tomt).toBe(true);
  });

  it('ser bort fra mellemrum i enderne', () => {
    expect(navnestatus('  Emil ', 'Emil').aendret).toBe(false);
  });

  it('viser en slukket knap, når kontoen ikke har et navn endnu', () => {
    expect(navnestatus('', '')).toEqual({ tomt: true, aendret: false, kanGemmes: false, visKnap: true });
  });
});
