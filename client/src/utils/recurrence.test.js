import {
  WORKING_DAYS,
  buildOccurrenceDates,
  fromDateString,
  getMaxEndDate,
  getSeriesStartDate,
  isSameWeekdays,
  sortWeekdays,
  toDateString,
} from './recurrence';

describe('recurrence', () => {
  describe('date strings', () => {
    it('round-trips a local date', () => {
      expect(toDateString(fromDateString('2026-11-30'))).toBe('2026-11-30');
      expect(toDateString(new Date(2026, 0, 5, 23, 59))).toBe('2026-01-05');
    });
  });

  describe('getSeriesStartDate', () => {
    const now = new Date(2026, 8, 29, 10, 0);

    it('starts on the day of the card', () => {
      expect(toDateString(getSeriesStartDate({ dueDate: new Date(2026, 9, 5, 18, 0) }, now))).toBe(
        '2026-10-05',
      );
    });

    it('prefers the start date over the due date', () => {
      expect(
        toDateString(
          getSeriesStartDate(
            {
              startDate: new Date(2026, 9, 5, 16, 0),
              dueDate: new Date(2026, 9, 6, 18, 0),
            },
            now,
          ),
        ),
      ).toBe('2026-10-05');
    });

    it('skips days already past', () => {
      expect(toDateString(getSeriesStartDate({ dueDate: new Date(2026, 8, 21, 18, 0) }, now))).toBe(
        '2026-09-29',
      );
    });
  });

  describe('getMaxEndDate', () => {
    it('reaches a year ahead', () => {
      expect(toDateString(getMaxEndDate(new Date(2026, 8, 29)))).toBe('2027-09-30');
    });
  });

  describe('buildOccurrenceDates', () => {
    it('lands on the weekdays between both dates, inclusive', () => {
      const dates = buildOccurrenceDates([1, 2], new Date(2026, 8, 28), new Date(2026, 10, 30));

      expect(dates).toHaveLength(19);
      expect(toDateString(dates[0])).toBe('2026-09-28');
      expect(toDateString(dates[dates.length - 1])).toBe('2026-11-30');
    });

    it('ignores the time of day of the end date', () => {
      const dates = buildOccurrenceDates(
        WORKING_DAYS,
        new Date(2026, 8, 28, 16, 0),
        new Date(2026, 9, 2, 9, 0),
      );

      expect(dates.map(toDateString)).toEqual([
        '2026-09-28',
        '2026-09-29',
        '2026-09-30',
        '2026-10-01',
        '2026-10-02',
      ]);
    });

    it('is empty when the end comes first', () => {
      expect(buildOccurrenceDates([1], new Date(2026, 8, 28), new Date(2026, 8, 27))).toEqual([]);
    });
  });

  describe('sortWeekdays', () => {
    it('orders from the first day of the week', () => {
      expect(sortWeekdays([0, 2, 1], 0)).toEqual([0, 1, 2]);
      expect(sortWeekdays([0, 2, 1], 1)).toEqual([1, 2, 0]);
    });
  });

  describe('isSameWeekdays', () => {
    it('ignores order', () => {
      expect(isSameWeekdays([1, 2], [2, 1])).toBe(true);
      expect(isSameWeekdays([1, 2], [1])).toBe(false);
    });
  });
});
