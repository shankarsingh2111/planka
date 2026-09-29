/*!
 * Copyright (c) 2024 PLANKA Software GmbH
 * Licensed under the Fair Use License: https://github.com/plankanban/planka/blob/master/LICENSE.md
 */

/**
 * Folding recurring series in lists of cards. A series creates all of its cards up front, so a
 * list holding one would otherwise show every card of it. Folded, a series shows one card: the
 * first one not done yet (overdue ones come first, so none get buried behind later ones), or in a
 * list of done cards, the latest one.
 */

const getTime = (card) => {
  const date = card.dueDate || card.startDate;
  return date ? date.getTime() : Infinity;
};

const byDate = (a, b) =>
  getTime(a) - getTime(b) || (a.occurrenceDate || '').localeCompare(b.occurrenceDate || '');

const isOpen = (card) => !card.isDueCompleted && !card.isClosed;

/**
 * The card standing for each series with more than one card among the given ones, keyed by the
 * series id, along with all of its cards in date order.
 */
export const getSeriesRepresentatives = (cards, { isDoneList = false } = {}) => {
  const cardsBySeriesId = {};

  cards.forEach((card) => {
    if (card.recurrenceId) {
      cardsBySeriesId[card.recurrenceId] = [...(cardsBySeriesId[card.recurrenceId] || []), card];
    }
  });

  const representativeBySeriesId = {};

  Object.entries(cardsBySeriesId).forEach(([seriesId, seriesCards]) => {
    if (seriesCards.length < 2) {
      return;
    }

    const sortedCards = [...seriesCards].sort(byDate);
    const lastCard = sortedCards[sortedCards.length - 1];

    representativeBySeriesId[seriesId] = {
      card: isDoneList ? lastCard : sortedCards.find(isOpen) || lastCard,
      cards: sortedCards,
    };
  });

  return representativeBySeriesId;
};

// The cards to show, in their original order: every series folded to its representative
// unless it was unfolded
export const foldCardSeries = (cards, { isDoneList = false, unfoldedSeriesIds = [] } = {}) => {
  const representativeBySeriesId = getSeriesRepresentatives(cards, { isDoneList });

  return cards.filter((card) => {
    const representative = card.recurrenceId && representativeBySeriesId[card.recurrenceId];

    return (
      !representative ||
      representative.card.id === card.id ||
      unfoldedSeriesIds.includes(card.recurrenceId)
    );
  });
};

// What the folded cards of a series hold back: how many there are, and whether any is overdue
export const getFoldedSeriesSummary = (representative, now = new Date()) => {
  const hiddenCards = representative.cards.filter((card) => card.id !== representative.card.id);

  return {
    hiddenTotal: hiddenCards.length,
    hasOverdue: hiddenCards.some((card) => isOpen(card) && getTime(card) < now.getTime()),
  };
};
