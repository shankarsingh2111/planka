const { expect } = require('chai');
const {
  isDate,
  isTime,
  isTimeZone,
  isWeekdays,
  addDays,
  diffDays,
  getWeekday,
  shiftWeekdays,
  toInstant,
  getToday,
  getTimePattern,
  getOccurrenceCardDates,
  buildOccurrenceDates,
} = require('../../utils/recurrence');

describe('recurrence', () => {
  describe('validators', () => {
    it('accepts only dates that exist', () => {
      expect(isDate('2026-11-30')).to.equal(true);
      expect(isDate('2028-02-29')).to.equal(true);
      expect(isDate('2026-02-30')).to.equal(false);
      expect(isDate('2026-9-1')).to.equal(false);
      expect(isDate(null)).to.equal(false);
    });

    it('accepts 24-hour times', () => {
      expect(isTime('16:00')).to.equal(true);
      expect(isTime('00:00')).to.equal(true);
      expect(isTime('24:00')).to.equal(false);
      expect(isTime('4:00')).to.equal(false);
    });

    it('accepts IANA time zones', () => {
      expect(isTimeZone('Asia/Kolkata')).to.equal(true);
      expect(isTimeZone('UTC')).to.equal(true);
      expect(isTimeZone('Mars/Olympus_Mons')).to.equal(false);
      expect(isTimeZone('')).to.equal(false);
    });

    it('accepts a non-empty set of weekdays', () => {
      expect(isWeekdays([1, 2])).to.equal(true);
      expect(isWeekdays([0, 1, 2, 3, 4, 5, 6])).to.equal(true);
      expect(isWeekdays([])).to.equal(false);
      expect(isWeekdays([7])).to.equal(false);
      expect(isWeekdays([1, 1])).to.equal(false);
      expect(isWeekdays(['1'])).to.equal(false);
    });
  });

  describe('date arithmetic', () => {
    it('adds days across month and year ends', () => {
      expect(addDays('2026-11-30', 1)).to.equal('2026-12-01');
      expect(addDays('2026-12-31', 1)).to.equal('2027-01-01');
      expect(addDays('2026-03-01', -1)).to.equal('2026-02-28');
    });

    it('counts days between dates', () => {
      expect(diffDays('2026-09-28', '2026-11-30')).to.equal(63);
      expect(diffDays('2026-11-30', '2026-09-28')).to.equal(-63);
    });

    it('knows the weekday of a date', () => {
      expect(getWeekday('2026-09-28')).to.equal(1);
      expect(getWeekday('2026-10-04')).to.equal(0);
    });

    it('shifts weekdays around the week', () => {
      expect(shiftWeekdays([1, 2], 2)).to.deep.equal([3, 4]);
      expect(shiftWeekdays([5, 6], 2)).to.deep.equal([0, 1]);
      expect(shiftWeekdays([0, 1], -1)).to.deep.equal([0, 6]);
    });
  });

  describe('toInstant', () => {
    it('converts a wall-clock time in a fixed-offset zone', () => {
      expect(toInstant('2026-09-28', '16:00', 'Asia/Kolkata').toISOString()).to.equal(
        '2026-09-28T10:30:00.000Z',
      );
    });

    it('keeps the wall-clock time across a daylight saving change', () => {
      expect(toInstant('2026-10-26', '16:00', 'America/New_York').toISOString()).to.equal(
        '2026-10-26T20:00:00.000Z',
      );
      expect(toInstant('2026-11-02', '16:00', 'America/New_York').toISOString()).to.equal(
        '2026-11-02T21:00:00.000Z',
      );
    });

    it('moves a skipped time forward', () => {
      expect(toInstant('2026-03-08', '02:30', 'America/New_York').toISOString()).to.equal(
        '2026-03-08T07:30:00.000Z',
      );
      expect(toInstant('2026-03-29', '02:30', 'Europe/Berlin').toISOString()).to.equal(
        '2026-03-29T01:30:00.000Z',
      );
    });

    it('takes the first of a repeated time', () => {
      expect(toInstant('2026-11-01', '01:30', 'America/New_York').toISOString()).to.equal(
        '2026-11-01T05:30:00.000Z',
      );
      expect(toInstant('2026-10-25', '02:30', 'Europe/Berlin').toISOString()).to.equal(
        '2026-10-25T00:30:00.000Z',
      );
    });
  });

  describe('getToday', () => {
    it('is the date in the time zone, not in UTC', () => {
      const now = new Date('2026-09-28T20:00:00.000Z');

      expect(getToday('Asia/Kolkata', now)).to.equal('2026-09-29');
      expect(getToday('America/New_York', now)).to.equal('2026-09-28');
    });
  });

  describe('getTimePattern', () => {
    it('reads the date, times and span of a card', () => {
      expect(
        getTimePattern(
          {
            startDate: new Date('2026-09-29T10:30:00.000Z'),
            dueDate: new Date('2026-09-29T12:30:00.000Z'),
          },
          'Asia/Kolkata',
        ),
      ).to.deep.equal({
        occurrenceDate: '2026-09-29',
        startTime: '16:00',
        dueTime: '18:00',
        dueDayOffset: 0,
      });
    });

    it('counts the days an overnight card spans', () => {
      expect(
        getTimePattern(
          {
            startDate: new Date('2026-09-29T16:30:00.000Z'),
            dueDate: new Date('2026-09-29T19:30:00.000Z'),
          },
          'Asia/Kolkata',
        ),
      ).to.deep.equal({
        occurrenceDate: '2026-09-29',
        startTime: '22:00',
        dueTime: '01:00',
        dueDayOffset: 1,
      });
    });

    it('uses the due date of a card without a start date', () => {
      expect(
        getTimePattern(
          {
            startDate: null,
            dueDate: new Date('2026-09-29T12:30:00.000Z'),
          },
          'Asia/Kolkata',
        ),
      ).to.deep.equal({
        occurrenceDate: '2026-09-29',
        startTime: null,
        dueTime: '18:00',
        dueDayOffset: 0,
      });
    });
  });

  describe('getOccurrenceCardDates', () => {
    it('builds the card dates of an occurrence', () => {
      const { startDate, dueDate } = getOccurrenceCardDates(
        {
          startTime: '22:00',
          dueTime: '01:00',
          dueDayOffset: 1,
          timezone: 'Asia/Kolkata',
        },
        '2026-10-05',
      );

      expect(startDate.toISOString()).to.equal('2026-10-05T16:30:00.000Z');
      expect(dueDate.toISOString()).to.equal('2026-10-05T19:30:00.000Z');
    });

    it('leaves the start date empty when the series has no start time', () => {
      const { startDate, dueDate } = getOccurrenceCardDates(
        {
          startTime: null,
          dueTime: '18:00',
          dueDayOffset: 0,
          timezone: 'Asia/Kolkata',
        },
        '2026-10-05',
      );

      expect(startDate).to.equal(null);
      expect(dueDate.toISOString()).to.equal('2026-10-05T12:30:00.000Z');
    });
  });

  describe('buildOccurrenceDates', () => {
    const series = {
      weekdays: [1, 2],
      startsOn: '2026-09-28',
      endsOn: '2026-11-30',
    };

    it('lands on the weekdays between both ends, inclusive', () => {
      const dates = buildOccurrenceDates(series);

      expect(dates).to.have.length(19);
      expect(dates[0]).to.equal('2026-09-28');
      expect(dates[1]).to.equal('2026-09-29');
      expect(dates[dates.length - 1]).to.equal('2026-11-30');
      expect(dates.every((date) => [1, 2].includes(getWeekday(date)))).to.equal(true);
    });

    it('skips excluded dates', () => {
      const dates = buildOccurrenceDates({
        ...series,
        excludedDates: ['2026-10-05'],
      });

      expect(dates).to.have.length(18);
      expect(dates).to.not.include('2026-10-05');
    });

    it('starts from a later date when given one', () => {
      const dates = buildOccurrenceDates(series, {
        from: '2026-11-24',
      });

      expect(dates).to.deep.equal(['2026-11-24', '2026-11-30']);
    });

    it('is empty when the series ends before it starts', () => {
      expect(
        buildOccurrenceDates({
          ...series,
          endsOn: '2026-09-27',
        }),
      ).to.deep.equal([]);
    });
  });
});
