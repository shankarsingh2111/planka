import { foldCardSeries, getFoldedSeriesSummary, getSeriesRepresentatives } from './card-series';

const card = (id, dueDate, extra = {}) => ({
  id,
  recurrenceId: 's1',
  dueDate: new Date(dueDate),
  isDueCompleted: false,
  isClosed: false,
  ...extra,
});

const other = { id: 'x', recurrenceId: null, dueDate: new Date('2026-10-02T12:00:00Z') };

describe('card-series', () => {
  describe('getSeriesRepresentatives', () => {
    it('picks the first card not done yet', () => {
      const cards = [
        card('b', '2026-10-07T12:00:00Z'),
        card('a', '2026-09-30T12:00:00Z', { isDueCompleted: true }),
        card('c', '2026-10-01T12:00:00Z'),
      ];

      const { s1 } = getSeriesRepresentatives(cards);

      expect(s1.card.id).toBe('c');
      expect(s1.cards.map(({ id }) => id)).toEqual(['a', 'c', 'b']);
    });

    it('picks the latest card in a list of done cards', () => {
      const cards = [card('a', '2026-09-30T12:00:00Z'), card('b', '2026-10-07T12:00:00Z')];

      expect(getSeriesRepresentatives(cards, { isDoneList: true }).s1.card.id).toBe('b');
    });

    it('leaves a series with a single card alone', () => {
      expect(getSeriesRepresentatives([card('a', '2026-09-30T12:00:00Z'), other])).toEqual({});
    });
  });

  describe('foldCardSeries', () => {
    const cards = [
      other,
      card('a', '2026-09-30T12:00:00Z'),
      card('b', '2026-10-01T12:00:00Z'),
      card('c', '2026-10-07T12:00:00Z'),
    ];

    it('keeps other cards and one card of the series, in order', () => {
      expect(foldCardSeries(cards).map(({ id }) => id)).toEqual(['x', 'a']);
    });

    it('shows every card of an unfolded series', () => {
      expect(foldCardSeries(cards, { unfoldedSeriesIds: ['s1'] }).map(({ id }) => id)).toEqual([
        'x',
        'a',
        'b',
        'c',
      ]);
    });
  });

  describe('getFoldedSeriesSummary', () => {
    it('counts the folded cards and flags overdue ones', () => {
      const now = new Date('2026-10-05T00:00:00Z');
      const representative = getSeriesRepresentatives([
        card('a', '2026-09-30T12:00:00Z'),
        card('b', '2026-10-01T12:00:00Z'),
        card('c', '2026-10-07T12:00:00Z'),
      ]).s1;

      expect(getFoldedSeriesSummary(representative, now)).toEqual({
        hiddenTotal: 2,
        hasOverdue: true,
      });
    });

    it('ignores done cards when looking for overdue ones', () => {
      const now = new Date('2026-10-05T00:00:00Z');
      const representative = getSeriesRepresentatives([
        card('a', '2026-09-30T12:00:00Z', { isDueCompleted: true }),
        card('b', '2026-10-07T12:00:00Z'),
        card('c', '2026-10-08T12:00:00Z'),
      ]).s1;

      expect(representative.card.id).toBe('b');
      expect(getFoldedSeriesSummary(representative, now).hasOverdue).toBe(false);
    });
  });
});
