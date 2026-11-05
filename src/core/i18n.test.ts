import { describe, expect, it } from 'vitest';
import { rich, ruPlural, setLang, strands } from './i18n';

describe('i18n', () => {
  it('picks Russian plural forms', () => {
    expect([1, 2, 5, 11, 12, 21, 22, 25, 101, 111].map(ruPlural)).toEqual([0, 1, 2, 2, 2, 0, 1, 2, 0, 2]);
  });

  it('formats strand counts', () => {
    setLang('ru');
    expect(strands(1)).toBe('1 травинку');
    expect(strands(3)).toBe('3 травинки');
    expect(strands(10)).toBe('10 травинок');
    setLang('en');
    expect(strands(1)).toBe('1 strand');
  });

  it('renders keycaps and escapes markup', () => {
    expect(rich('[E] <b>')).toBe('<kbd>E</kbd> &lt;b&gt;');
  });
});
