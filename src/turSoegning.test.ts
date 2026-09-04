import { describe, expect, it } from 'vitest';
import { matcherTur } from './turSoegning';
describe('tursøgning', () => {
  it('viser alle ved tom søgning', () => expect(matcherTur('Tur', 'Skov', '  ')).toBe(true));
  it('søger på tværs af navn og sted', () => expect(matcherTur('Weekend 60', 'Kysten', 'kysten 60')).toBe(true));
  it('håndterer dansk og store bogstaver', () => expect(matcherTur('Øhavstur', 'Ærø', 'ØHAV ÆRØ')).toBe(true));
  it('ignorerer ekstra mellemrum', () => expect(matcherTur('Weekend 60', 'Kysten', '  kysten   60 ')).toBe(true));
  it('kræver at alle søgeord matcher', () => expect(matcherTur('Weekend 60', 'Kysten', 'kysten 61')).toBe(false));
});
