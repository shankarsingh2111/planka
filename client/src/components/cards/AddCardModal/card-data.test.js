import { areDatesInOrder, buildCardData } from './card-data';

describe('buildCardData', () => {
  it('sends only the fields that were filled in, with the title trimmed', () => {
    expect(
      buildCardData({
        type: 'project',
        name: '  Fix login  ',
        description: null,
        startDate: null,
        dueDate: null,
      }),
    ).toEqual({
      type: 'project',
      name: 'Fix login',
    });
  });

  it('keeps the description and both dates when they are set', () => {
    expect(
      buildCardData({
        type: 'story',
        name: 'Fix login',
        description: 'Steps to reproduce',
        startDate: new Date(2026, 8, 24, 9),
        dueDate: new Date(2026, 8, 24, 21),
      }),
    ).toEqual({
      type: 'story',
      name: 'Fix login',
      description: 'Steps to reproduce',
      startDate: new Date(2026, 8, 24, 9),
      dueDate: new Date(2026, 8, 24, 21),
    });
  });

  it('keeps a lone due date without inventing a start date', () => {
    expect(
      buildCardData({
        type: 'project',
        name: 'Fix login',
        description: null,
        startDate: null,
        dueDate: new Date(2026, 8, 24, 21),
      }),
    ).toEqual({
      type: 'project',
      name: 'Fix login',
      dueDate: new Date(2026, 8, 24, 21),
    });
  });
});

describe('areDatesInOrder', () => {
  it.each([
    ['no dates at all', null, null, true],
    ['only a start date', new Date(2026, 8, 24, 9), null, true],
    ['only a due date', null, new Date(2026, 8, 24, 21), true],
    ['a start before the due date', new Date(2026, 8, 24, 9), new Date(2026, 8, 24, 21), true],
    ['a start equal to the due date', new Date(2026, 8, 24, 9), new Date(2026, 8, 24, 9), true],
    ['a start after the due date', new Date(2026, 8, 25, 9), new Date(2026, 8, 24, 21), false],
  ])('%s → %s', (_, startDate, dueDate, expected) => {
    expect(areDatesInOrder(startDate, dueDate)).toBe(expected);
  });
});
