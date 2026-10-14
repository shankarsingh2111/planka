import { applyFormat, MarkdownFormats } from './markdown-format';

describe('applyFormat', () => {
  test('wraps a selection in bold and keeps it selected', () => {
    expect(applyFormat('say hi now', 4, 6, MarkdownFormats.BOLD)).toEqual({
      text: 'say **hi** now',
      selectionStart: 6,
      selectionEnd: 8,
    });
  });

  test('puts the caret between markers when nothing is selected', () => {
    expect(applyFormat('ab', 1, 1, MarkdownFormats.ITALIC)).toEqual({
      text: 'a__b',
      selectionStart: 2,
      selectionEnd: 2,
    });
  });

  test('wraps strikethrough and inline code', () => {
    expect(applyFormat('x', 0, 1, MarkdownFormats.STRIKETHROUGH).text).toBe('~~x~~');
    expect(applyFormat('x', 0, 1, MarkdownFormats.CODE).text).toBe('`x`');
  });

  test('prefixes every selected line of a bulleted list', () => {
    expect(applyFormat('one\ntwo\nthree', 1, 6, MarkdownFormats.BULLETED_LIST)).toEqual({
      text: '- one\n- two\nthree',
      selectionStart: 3,
      selectionEnd: 10,
    });
  });

  test('numbers the selected lines', () => {
    expect(applyFormat('a\nb', 0, 3, MarkdownFormats.NUMBERED_LIST).text).toBe('1. a\n2. b');
  });

  test('quotes the line the caret is on, at the very start of the text', () => {
    expect(applyFormat('\nnext', 0, 0, MarkdownFormats.QUOTE)).toEqual({
      text: '> \nnext',
      selectionStart: 2,
      selectionEnd: 2,
    });
  });

  test('puts a code block on its own lines', () => {
    expect(applyFormat('see x now', 4, 5, MarkdownFormats.CODE_BLOCK).text).toBe(
      'see \n```\nx\n```\n now',
    );
    expect(applyFormat('x', 0, 1, MarkdownFormats.CODE_BLOCK).text).toBe('```\nx\n```');
  });

  test('turns a selection into a link and selects the address', () => {
    expect(applyFormat('docs', 0, 4, MarkdownFormats.LINK)).toEqual({
      text: '[docs](https://)',
      selectionStart: 7,
      selectionEnd: 15,
    });
  });

  test('leaves the caret inside the brackets of an empty link', () => {
    expect(applyFormat('', 0, 0, MarkdownFormats.LINK)).toEqual({
      text: '[](https://)',
      selectionStart: 1,
      selectionEnd: 1,
    });
  });
});
