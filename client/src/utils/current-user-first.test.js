import { putCurrentUserFirst } from './current-user-first';

describe('putCurrentUserFirst', () => {
  test('moves the current user to the front and keeps the rest in order', () => {
    expect(putCurrentUserFirst(['a', 'b', 'c', 'd'], 'c')).toEqual(['c', 'a', 'b', 'd']);
  });

  test('returns the same array when the user is already first or absent', () => {
    const items = ['a', 'b'];

    expect(putCurrentUserFirst(items, 'a')).toBe(items);
    expect(putCurrentUserFirst(items, 'z')).toBe(items);
  });

  test('uses the given accessor', () => {
    const items = [{ user: { id: '1' } }, { user: { id: '2' } }];

    expect(putCurrentUserFirst(items, '2', ({ user }) => user.id)).toEqual([items[1], items[0]]);
  });
});
