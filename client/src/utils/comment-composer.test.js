import { getPastedFiles, isCommentLeftEmpty, isOtherTextFieldFocused } from './comment-composer';

const png = { name: 'image.png' };

describe('getPastedFiles', () => {
  test('takes a pasted screenshot', () => {
    expect(getPastedFiles({ types: ['Files'], files: [png] })).toEqual([png]);
  });

  test('leaves spreadsheet cells as text even though an image comes along', () => {
    expect(getPastedFiles({ types: ['text/plain', 'text/html', 'Files'], files: [png] })).toEqual(
      [],
    );
  });

  test('has nothing for plain text or a missing clipboard', () => {
    expect(getPastedFiles({ types: ['text/plain'], files: [] })).toEqual([]);
    expect(getPastedFiles(null)).toEqual([]);
  });
});

describe('isOtherTextFieldFocused', () => {
  const textarea = { tagName: 'TEXTAREA' };
  const linkField = { tagName: 'INPUT' };
  const button = { tagName: 'BUTTON' };
  const container = { contains: (element) => [textarea, linkField, button].includes(element) };

  test('is true for the link field inside the comment box', () => {
    expect(isOtherTextFieldFocused(container, textarea, linkField)).toBe(true);
  });

  test('is false for the comment textarea itself, a button, or a field outside', () => {
    expect(isOtherTextFieldFocused(container, textarea, textarea)).toBe(false);
    expect(isOtherTextFieldFocused(container, textarea, button)).toBe(false);
    expect(isOtherTextFieldFocused(container, textarea, { tagName: 'INPUT' })).toBe(false);
    expect(isOtherTextFieldFocused(container, textarea, null)).toBe(false);
  });
});

describe('isCommentLeftEmpty', () => {
  test('is true when a comment without text got none of its attachments', () => {
    expect(isCommentLeftEmpty('', 0)).toBe(true);
  });

  test('is false when it has text or kept an attachment', () => {
    expect(isCommentLeftEmpty('hi', 0)).toBe(false);
    expect(isCommentLeftEmpty('', 1)).toBe(false);
  });
});
