/*!
 * Copyright (c) 2024 PLANKA Software GmbH
 * Licensed under the Fair Use License: https://github.com/plankanban/planka/blob/master/LICENSE.md
 */

export const MarkdownFormats = {
  BOLD: 'bold',
  ITALIC: 'italic',
  STRIKETHROUGH: 'strikethrough',
  CODE: 'code',
  CODE_BLOCK: 'codeBlock',
  BULLETED_LIST: 'bulletedList',
  NUMBERED_LIST: 'numberedList',
  QUOTE: 'quote',
  LINK: 'link',
};

// With Ctrl (Cmd on Mac) held
export const FORMAT_BY_SHORTCUT_KEY = {
  b: MarkdownFormats.BOLD,
  i: MarkdownFormats.ITALIC,
};

const MARKER_BY_INLINE_FORMAT = {
  [MarkdownFormats.BOLD]: '**',
  [MarkdownFormats.ITALIC]: '_',
  [MarkdownFormats.STRIKETHROUGH]: '~~',
  [MarkdownFormats.CODE]: '`',
};

const LINK_URL = 'https://';

const wrap = (text, start, end, before, after) => ({
  text: text.slice(0, start) + before + text.slice(start, end) + after + text.slice(end),
  selectionStart: start + before.length,
  selectionEnd: end + before.length,
});

// Every line the selection touches gets a prefix. All inserted text lies before the selection end,
// so the end moves by the total inserted.
const prefixLines = (text, start, end, getPrefix) => {
  const blockStart = start === 0 ? 0 : text.lastIndexOf('\n', start - 1) + 1;
  let blockEnd = text.indexOf('\n', end);

  if (blockEnd === -1) {
    blockEnd = text.length;
  }

  const lines = text.slice(blockStart, blockEnd).split('\n');
  const prefixes = lines.map((_, index) => getPrefix(index));
  const block = lines.map((line, index) => prefixes[index] + line).join('\n');
  const insertedTotal = prefixes.reduce((total, prefix) => total + prefix.length, 0);

  return {
    text: text.slice(0, blockStart) + block + text.slice(blockEnd),
    selectionStart: start + prefixes[0].length,
    selectionEnd: start === end ? start + prefixes[0].length : end + insertedTotal,
  };
};

export const applyFormat = (text, start, end, format) => {
  const marker = MARKER_BY_INLINE_FORMAT[format];

  if (marker) {
    return wrap(text, start, end, marker, marker);
  }

  switch (format) {
    case MarkdownFormats.BULLETED_LIST:
      return prefixLines(text, start, end, () => '- ');
    case MarkdownFormats.NUMBERED_LIST:
      return prefixLines(text, start, end, (index) => `${index + 1}. `);
    case MarkdownFormats.QUOTE:
      return prefixLines(text, start, end, () => '> ');
    case MarkdownFormats.CODE_BLOCK: {
      const before = start > 0 && text[start - 1] !== '\n' ? '\n```\n' : '```\n';
      const after = end < text.length && text[end] !== '\n' ? '\n```\n' : '\n```';

      return wrap(text, start, end, before, after);
    }
    case MarkdownFormats.LINK: {
      const result = wrap(text, start, end, '[', `](${LINK_URL})`);

      if (start === end) {
        return result;
      }

      const urlStart = result.selectionEnd + 2;

      return {
        text: result.text,
        selectionStart: urlStart,
        selectionEnd: urlStart + LINK_URL.length,
      };
    }
    default:
      return {
        text,
        selectionStart: start,
        selectionEnd: end,
      };
  }
};
