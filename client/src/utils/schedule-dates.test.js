import { buildDueDateUpdate, buildStartDateUpdate } from './schedule-dates';

const card = {
  startDate: new Date(2026, 9, 13, 9, 0),
  dueDate: new Date(2026, 9, 14, 21, 0),
};

describe('buildStartDateUpdate', () => {
  test('sets only the start when it stays before the due date', () => {
    const startDate = new Date(2026, 9, 14, 9, 0);

    expect(buildStartDateUpdate(card, startDate)).toEqual({ startDate });
  });

  test('takes the due date along when the start moves past it', () => {
    const startDate = new Date(2026, 9, 23, 9, 0);

    expect(buildStartDateUpdate(card, startDate)).toEqual({
      startDate,
      dueDate: new Date(2026, 9, 24, 21, 0),
    });
  });

  test('puts the due date on the start when the card had no start', () => {
    const startDate = new Date(2026, 9, 23, 9, 0);

    expect(buildStartDateUpdate({ ...card, startDate: null }, startDate)).toEqual({
      startDate,
      dueDate: startDate,
    });
  });

  test('sets only the start without a due date, or when clearing it', () => {
    const startDate = new Date(2026, 9, 23, 9, 0);

    expect(buildStartDateUpdate({ ...card, dueDate: null }, startDate)).toEqual({ startDate });
    expect(buildStartDateUpdate(card, null)).toEqual({ startDate: null });
  });
});

describe('buildDueDateUpdate', () => {
  test('sets only the due date when it stays after the start', () => {
    const dueDate = new Date(2026, 9, 24, 21, 0);

    expect(buildDueDateUpdate(card, dueDate)).toEqual({ dueDate });
  });

  test('takes the start along when the due date moves ahead of it', () => {
    const dueDate = new Date(2026, 9, 3, 21, 0);

    expect(buildDueDateUpdate(card, dueDate)).toEqual({
      startDate: new Date(2026, 9, 2, 9, 0),
      dueDate,
    });
  });

  test('sets only the due date without a start, or when clearing it', () => {
    const dueDate = new Date(2026, 9, 3, 21, 0);

    expect(buildDueDateUpdate({ ...card, startDate: null }, dueDate)).toEqual({ dueDate });
    expect(buildDueDateUpdate(card, null)).toEqual({ dueDate: null });
  });
});
