/*!
 * Copyright (c) 2024 PLANKA Software GmbH
 * Licensed under the Fair Use License: https://github.com/plankanban/planka/blob/master/LICENSE.md
 */

const path = require('path');
const mime = require('mime-types');

const DEFAULT_ALLOWED_ATTACHMENT_EXTENSIONS = [
  // Images
  'jpg',
  'jpeg',
  'png',
  'gif',
  'webp',
  'heic',
  'heif',
  'svg',
  'bmp',
  // Video
  'mp4',
  'mov',
  'webm',
  'mkv',
  'avi',
  'm4v',
  // Audio
  'mp3',
  'wav',
  'm4a',
  'ogg',
  // PDF
  'pdf',
  // Documents
  'doc',
  'docx',
  'odt',
  'rtf',
  'txt',
  'md',
  // Spreadsheets
  'xls',
  'xlsx',
  'ods',
  'csv',
  // Presentations
  'ppt',
  'pptx',
  'odp',
  // Archives
  'zip',
];

// Content detection reports some formats only by their generic container
const EXTENSIONS_BY_CONTAINER_TYPE = {
  cfb: ['doc', 'xls', 'ppt'], // Legacy Office (Compound File Binary)
  zip: ['docx', 'xlsx', 'pptx', 'odt', 'ods', 'odp', 'zip'],
  xml: ['svg'],
};

const MEDIA_FAMILIES = ['image', 'video', 'audio'];

const NAMED_CHARACTER_REFERENCES = {
  colon: ':',
  tab: '\t',
  newline: '\n',
  sol: '/',
  lpar: '(',
  rpar: ')',
  period: '.',
  quot: '"',
  apos: "'",
};

// Checked against the lowercased SVG with character references decoded ("decoded"),
// or additionally with all whitespace and control characters removed ("compact"),
// since browsers ignore those inside URL schemes (e.g. "java\tscript:")
const SVG_ACTIVE_CONTENT_RULES = [
  ['script element', 'decoded', /<(?:[\w.-]+:)?script\b/],
  [
    'embedded document',
    'decoded',
    /<(?:[\w.-]+:)?(?:foreignobject|iframe|embed|object|handler|listener)\b/,
  ],
  ['entity declaration', 'decoded', /<!entity\b/],
  ['stylesheet processing instruction', 'decoded', /<\?xml-stylesheet\b/],
  ['event handler attribute', 'decoded', /[\s"'/]on[a-z]+\s*=/],
  ['script URL', 'compact', /(?:java|vb|live)script:/],
  [
    'unsafe data URL',
    'compact',
    /data:(?:text\/(?:html|javascript|xml)|application\/(?:xhtml|xml|javascript|ecmascript|x-javascript)|image\/svg)/,
  ],
  ['external reference', 'compact', /(?:href|src)=["']?(?!data:)(?:[a-z][a-z\d+.-]*:|\/\/)/],
  ['CSS import', 'compact', /@import/],
  ['external CSS reference', 'compact', /url\(["']?(?!data:|#)(?:[a-z][a-z\d+.-]*:|\/\/)/],
];

/**
 * Parses the ALLOWED_ATTACHMENT_EXTENSIONS env value.
 * @param {string} [value] Comma-separated extensions, or "*" to allow any file type
 * @returns {string[]|null} Normalized extensions, the default list when unset, or null for "*"
 */
const parseAllowedExtensions = (value) => {
  const trimmedValue = (value || '').trim();

  if (trimmedValue === '*') {
    return null;
  }

  const extensions = trimmedValue
    .split(',')
    .map((extension) => extension.trim().toLowerCase().replace(/^\.+/, ''))
    .filter((extension) => extension);

  return extensions.length > 0 ? [...new Set(extensions)] : DEFAULT_ALLOWED_ATTACHMENT_EXTENSIONS;
};

const getFileExtension = (filename) => {
  const extension = path.extname(filename || '').slice(1);
  return extension ? extension.toLowerCase() : null;
};

const isAllowedExtension = (filename, allowedExtensions) => {
  if (!allowedExtensions) {
    return true;
  }

  const extension = getFileExtension(filename);
  return !!extension && allowedExtensions.includes(extension);
};

const getMediaFamily = (mimeType) => {
  const family = mimeType ? mimeType.split('/')[0] : null;
  return MEDIA_FAMILIES.includes(family) ? family : null;
};

/**
 * Whether the type detected from the file content is acceptable for the file's extension.
 * @param {string} extension File name extension (lowercased, without dot)
 * @param {{ ext: string, mime: string }} [fileType] Result of file-type detection (none for text)
 * @param {string[]|null} allowedExtensions Allowed extensions, or null to allow any file type
 */
const isDetectedTypeAllowed = (extension, fileType, allowedExtensions) => {
  if (!allowedExtensions || !fileType) {
    return true;
  }

  if (allowedExtensions.includes(fileType.ext)) {
    return true;
  }

  const containerExtensions = EXTENSIONS_BY_CONTAINER_TYPE[fileType.ext];
  if (containerExtensions) {
    return containerExtensions.includes(extension);
  }

  const family = getMediaFamily(fileType.mime);
  return !!family && family === getMediaFamily(mime.lookup(extension) || null);
};

const codePointToString = (codePoint, fallback) =>
  Number.isInteger(codePoint) && codePoint >= 0 && codePoint <= 0x10ffff
    ? String.fromCodePoint(codePoint)
    : fallback;

const decodeCharacterReferences = (text) =>
  text
    .replace(/&#x([\da-f]+);?/gi, (match, hex) => codePointToString(parseInt(hex, 16), match))
    .replace(/&#(\d+);?/g, (match, decimal) => codePointToString(parseInt(decimal, 10), match))
    .replace(
      /&(colon|tab|newline|sol|lpar|rpar|period|quot|apos);/gi,
      (match, name) => NAMED_CHARACTER_REFERENCES[name.toLowerCase()],
    );

/**
 * Looks for SVG content that can run scripts or load outside resources.
 * @param {string} text SVG file content
 * @returns {string|null} Description of the first problem found, or null if the SVG is clean
 */
const findSvgActiveContent = (text) => {
  const decoded = decodeCharacterReferences(text).toLowerCase();

  const textByTarget = {
    decoded,
    compact: decoded.replace(/[\u0000- \u007f]+/g, ''), // eslint-disable-line no-control-regex
  };

  const rule = SVG_ACTIVE_CONTENT_RULES.find(([, target, regex]) =>
    regex.test(textByTarget[target]),
  );

  return rule ? rule[0] : null;
};

module.exports = {
  DEFAULT_ALLOWED_ATTACHMENT_EXTENSIONS,
  parseAllowedExtensions,
  getFileExtension,
  isAllowedExtension,
  isDetectedTypeAllowed,
  findSvgActiveContent,
};
