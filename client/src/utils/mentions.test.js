import { markupToPlainIndex, plainToMarkupIndex } from './mentions';

// Shown as "hi @ann and @bob!" (17 chars)
const MARKUP = 'hi @[ann](1) and @[bob](22)!';

describe('plainToMarkupIndex', () => {
  test('is unchanged before any mention', () => {
    expect(plainToMarkupIndex(MARKUP, 2)).toBe(2);
  });

  test('lands on the start of a mention', () => {
    expect(plainToMarkupIndex(MARKUP, 3)).toBe(3);
  });

  test('snaps a position inside a mention to its end', () => {
    expect(plainToMarkupIndex(MARKUP, 5)).toBe(12);
    expect(plainToMarkupIndex(MARKUP, 7)).toBe(12);
  });

  test('skips the markup of earlier mentions', () => {
    // plain "hi @ann a" -> 9
    expect(plainToMarkupIndex(MARKUP, 9)).toBe(14);
    // just before the "!" at plain 16
    expect(plainToMarkupIndex(MARKUP, 16)).toBe(27);
    expect(plainToMarkupIndex(MARKUP, 17)).toBe(28);
  });

  test('works with no mentions', () => {
    expect(plainToMarkupIndex('plain', 3)).toBe(3);
  });
});

describe('markupToPlainIndex', () => {
  test('maps back at mention boundaries', () => {
    expect(markupToPlainIndex(MARKUP, 3)).toBe(3);
    expect(markupToPlainIndex(MARKUP, 12)).toBe(7);
    expect(markupToPlainIndex(MARKUP, 28)).toBe(17);
  });
});
