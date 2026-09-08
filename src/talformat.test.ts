import { describe, expect, it } from 'vitest';
import { beloeb, gram, kilo, tal } from './talformat';

describe('dansk talformat', () => {
  it('bruger komma i kilogram', () => {
    expect(kilo(13590)).toBe('13,59');
    expect(kilo(51900, 1)).toBe('51,9');
  });

  it('giver hele tal danske tusindtalsseparatorer', () => {
    expect(gram(2409)).toBe('2.409');
    expect(beloeb(105960.7)).toBe('105.961');
  });

  it('formaterer almindelige decimaltal', () => {
    expect(tal(3.3)).toBe('3,3');
  });
});
