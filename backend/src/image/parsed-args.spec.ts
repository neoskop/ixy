import { ParsedArgs } from './parsed-args.js';

describe('ParsedArgs', () => {
  it('defaults to avif and round-trips through the cache file name', () => {
    expect(`${new ParsedArgs(null)}`).toBe('.avif');

    for (const name of ['100-200.avif', '100-200-g-n.webp', '0-50-s-a.avif']) {
      const args = ParsedArgs.fromFileName(`/cache/target/foo.jpg/${name}`);
      expect(`${name.match(/^\d+-\d+/)[0]}${args}`).toBe(name);
    }

    const legacy = ParsedArgs.fromFileName('/x/100-200-s-e.webp');
    expect(legacy.format).toBe('webp');
    expect(legacy.strategy).toBe('entropy');
  });

  it('accepts URL flags in any order and rejects duplicates', () => {
    expect(`${ParsedArgs.fromUrlFlags('/f:webp/g:n')}`).toBe('-g-n.webp');
    expect(`${ParsedArgs.fromUrlFlags('/G:N/F:WEBP')}`).toBe('-g-n.webp');
    expect(`${ParsedArgs.fromUrlFlags('/s:a')}`).toBe('-s-a.avif');
    expect(`${ParsedArgs.fromUrlFlags(undefined)}`).toBe('.avif');
    expect(ParsedArgs.fromUrlFlags('/g:n/s:a')).toBeNull();
    expect(ParsedArgs.fromUrlFlags('/f:webp/f:avif')).toBeNull();
  });
});
