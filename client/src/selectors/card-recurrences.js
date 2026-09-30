/*!
 * Copyright (c) 2024 PLANKA Software GmbH
 * Licensed under the Fair Use License: https://github.com/plankanban/planka/blob/master/LICENSE.md
 */

import { createSelector } from 'redux-orm';

import orm from '../orm';
import { selectPath } from './router';
import { getFoldedSeriesSummary, getSeriesRepresentatives } from '../utils/card-series';
import { isListKanban } from '../utils/record-helpers';
import { CardRecurrenceScopes, ListTypes } from '../constants/Enums';

export const makeSelectCardRecurrenceById = () =>
  createSelector(
    orm,
    (_, id) => id,
    ({ CardRecurrence }, id) => {
      if (!id) {
        return null;
      }

      const cardRecurrenceModel = CardRecurrence.withId(id);

      if (!cardRecurrenceModel) {
        return null;
      }

      return cardRecurrenceModel.ref;
    },
  );

export const selectCardRecurrenceById = makeSelectCardRecurrenceById();

export const selectCardRecurrenceForCurrentCard = createSelector(
  orm,
  (state) => selectPath(state).cardId,
  ({ Card, CardRecurrence }, cardId) => {
    if (!cardId) {
      return null;
    }

    const cardModel = Card.withId(cardId);

    if (!cardModel || !cardModel.recurrenceId) {
      return null;
    }

    const cardRecurrenceModel = CardRecurrence.withId(cardModel.recurrenceId);

    if (!cardRecurrenceModel) {
      return null;
    }

    return cardRecurrenceModel.ref;
  },
);

/**
 * Where the card stands in its series, counting the cards of the series loaded on the board:
 * cards in the archive or trash only count once their list has been opened.
 */
export const makeSelectCardRecurrencePositionByCardId = () =>
  createSelector(
    orm,
    (_, cardId) => cardId,
    ({ Card }, cardId) => {
      const cardModel = Card.withId(cardId);

      if (!cardModel || !cardModel.recurrenceId) {
        return null;
      }

      const occurrenceDates = Card.filter({
        recurrenceId: cardModel.recurrenceId,
        boardId: cardModel.boardId,
      })
        .toRefArray()
        .map(({ id, occurrenceDate }) => `${occurrenceDate}:${id}`)
        .sort();

      return {
        index: occurrenceDates.indexOf(`${cardModel.occurrenceDate}:${cardModel.id}`) + 1,
        total: occurrenceDates.length,
      };
    },
  );

export const selectCardRecurrencePositionByCardId = makeSelectCardRecurrencePositionByCardId();

/**
 * What the chip of a card standing for its series in a list shows: how many cards the list folds
 * behind it, whether any of them is overdue, and whether the series is unfolded. Null for every
 * other card, and while a search shows everything.
 */
export const makeSelectCardSeriesFoldByCardId = () =>
  createSelector(
    orm,
    (_, cardId) => cardId,
    ({ Card }, cardId) => {
      const cardModel = Card.withId(cardId);

      if (!cardModel || !cardModel.recurrenceId) {
        return null;
      }

      const listModel = cardModel.list;

      if (!listModel || !isListKanban(listModel) || listModel.board.search) {
        return null;
      }

      const representative = getSeriesRepresentatives(
        listModel.getCardsModelArrayMatchingFilters(),
        {
          isDoneList: listModel.type === ListTypes.CLOSED,
        },
      )[cardModel.recurrenceId];

      if (!representative || representative.card.id !== cardModel.id) {
        return null;
      }

      return {
        ...getFoldedSeriesSummary(representative),
        isUnfolded: (listModel.board.unfoldedRecurrenceIds || []).includes(cardModel.recurrenceId),
      };
    },
  );

// An edit reaches other cards of the series only while the card it was picked for is open
export const selectCardRecurrenceScopeByCardId = ({ core: { cardRecurrenceScope } }, cardId) =>
  cardRecurrenceScope && cardRecurrenceScope.cardId === cardId
    ? cardRecurrenceScope.value
    : CardRecurrenceScopes.THIS;

export default {
  makeSelectCardRecurrenceById,
  selectCardRecurrenceById,
  selectCardRecurrenceForCurrentCard,
  makeSelectCardRecurrencePositionByCardId,
  selectCardRecurrencePositionByCardId,
  makeSelectCardSeriesFoldByCardId,
  selectCardRecurrenceScopeByCardId,
};
