import {
  AttachmentFileProblems,
  buildAcceptAttribute,
  getAttachmentFileProblem,
} from './attachment-files';

const MB = 1024 * 1024;

const policy = {
  allowedExtensions: ['pdf', 'docx', 'png'],
  maxFileSize: 100 * MB,
};

describe('getAttachmentFileProblem', () => {
  test.each([
    ['an allowed type', { name: 'Report.PDF', size: MB }, null],
    ['a disallowed type', { name: 'setup.exe', size: MB }, AttachmentFileProblems.TYPE_NOT_ALLOWED],
    [
      'a file without extension',
      { name: 'Makefile', size: 1 },
      AttachmentFileProblems.TYPE_NOT_ALLOWED,
    ],
    [
      'a file over the size limit',
      { name: 'big.pdf', size: 101 * MB },
      AttachmentFileProblems.TOO_BIG,
    ],
    ['a file exactly at the size limit', { name: 'ok.pdf', size: 100 * MB }, null],
  ])('checks %s', (_, file, expected) => {
    expect(getAttachmentFileProblem(file, policy)).toBe(expected);
  });

  test('allows any type and size when the server sends no limits', () => {
    expect(getAttachmentFileProblem({ name: 'setup.exe', size: 500 * MB }, {})).toBeNull();
    expect(
      getAttachmentFileProblem(
        { name: 'setup.exe', size: 500 * MB },
        { allowedExtensions: null, maxFileSize: null },
      ),
    ).toBeNull();
  });
});

describe('buildAcceptAttribute', () => {
  test('lists the allowed extensions for a file input', () => {
    expect(buildAcceptAttribute(['pdf', 'png'])).toBe('.pdf,.png');
  });

  test('accepts anything when any type is allowed', () => {
    expect(buildAcceptAttribute(null)).toBeUndefined();
    expect(buildAcceptAttribute(undefined)).toBeUndefined();
  });
});
