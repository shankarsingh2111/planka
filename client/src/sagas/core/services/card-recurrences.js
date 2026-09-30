/*!
 * Copyright (c) 2024 PLANKA Software GmbH
 * Licensed under the Fair Use License: https://github.com/plankanban/planka/blob/master/LICENSE.md
 */

import pick from 'lodash/pick';
import { call, put, select } from 'redux-saga/effects';

import { goToBoard } from './router';
import request from '../request';
import selectors from '../../../selectors';
import actions from '../../../actions';
import api from '../../../api';
import { getTimeZone } from '../../../utils/recurrence';
import { CardRecurrenceScopes } from '../../../constants/Enums';

// What an edit can carry over to the other cards of a series. The rest of a card - its list,
// completion, stopwatch - is its own.
export const CARD_RECURRENCE_FIELD_NAMES = ['name', 'description', 'startDate', 'dueDate'];

// The other cards an edit of the card reaches, or null when it concerns the card alone
export function* getCardRecurrenceScope(cardId) {
  const card = yield select(selectors.selectCardById, cardId);

  if (!card || !card.recurrenceId) {
    return null;
  }

  const scope = yield select(selectors.selectCardRecurrenceScopeByCardId, cardId);
  return scope === CardRecurrenceScopes.THIS ? null : scope;
}

export function* fetchCardRecurrences(boardId) {
  yield put(actions.fetchCardRecurrences(boardId));

  let cardRecurrences;
  try {
    ({ items: cardRecurrences } = yield call(request, api.getCardRecurrences, boardId));
  } catch (error) {
    yield put(actions.fetchCardRecurrences.failure(boardId, error));
    return;
  }

  yield put(actions.fetchCardRecurrences.success(boardId, cardRecurrences));
}

export function* fetchCardRecurrencesInCurrentBoard() {
  const { boardId } = yield select(selectors.selectPath);

  if (boardId) {
    yield call(fetchCardRecurrences, boardId);
  }
}

/**
 * The server creates every card of the series right away. The card itself comes back moved to
 * the first date; the others arrive through socket events, like cards anyone else creates.
 */
export function* createCardRecurrence(cardId, data) {
  yield put(actions.createCardRecurrence(cardId, data));

  let cardRecurrence;
  let cards;

  try {
    ({
      item: cardRecurrence,
      included: { cards },
    } = yield call(request, api.createCardRecurrence, cardId, {
      ...data,
      timezone: getTimeZone(),
    }));
  } catch (error) {
    yield put(actions.createCardRecurrence.failure(cardId, error));
    return;
  }

  yield put(actions.createCardRecurrence.success(cardRecurrence));
  yield put(actions.updateCard.success(cards[0]));
}

export function* handleCardRecurrenceCreate(cardRecurrence) {
  yield put(actions.handleCardRecurrenceCreate(cardRecurrence));
}

/**
 * Only the edited card changes on the spot. The other cards, and members and labels on any of
 * them, follow through socket events: the server sends those to the requester too.
 */
export function* updateCardRecurrence(cardId, scope, data) {
  const cardData = pick(data, CARD_RECURRENCE_FIELD_NAMES);

  if (Object.keys(cardData).length > 0) {
    yield put(actions.updateCard(cardId, cardData));
  }

  yield put(actions.updateCardRecurrence(cardId, scope, data));

  let cardRecurrence;
  let cards;

  try {
    ({
      item: cardRecurrence,
      included: { cards },
    } = yield call(request, api.updateCardRecurrence, cardId, {
      ...data,
      scope,
    }));
  } catch (error) {
    yield put(actions.updateCardRecurrence.failure(cardId, error));
    return;
  }

  yield put(actions.updateCardRecurrence.success(cardRecurrence));

  // A new repeat rule may have left no day for the card, in which case it's gone
  if (cards.length > 0) {
    yield put(actions.updateCard.success(cards[0]));
  }
}

export function* handleCardRecurrenceUpdate(cardRecurrence) {
  yield put(actions.handleCardRecurrenceUpdate(cardRecurrence));
}

export function* deleteCardRecurrence(cardId, scope) {
  const { cardId: currentCardId, boardId } = yield select(selectors.selectPath);

  yield put(actions.deleteCardRecurrence(cardId, scope));

  if (cardId === currentCardId) {
    yield call(goToBoard, boardId);
  }

  let cardRecurrence;
  try {
    ({ item: cardRecurrence } = yield call(request, api.deleteCardRecurrence, cardId, {
      scope,
    }));
  } catch (error) {
    yield put(actions.deleteCardRecurrence.failure(cardId, error));
    return;
  }

  yield put(actions.deleteCardRecurrence.success(cardRecurrence));
}

export function* handleCardRecurrenceDelete(cardRecurrence) {
  yield put(actions.handleCardRecurrenceDelete(cardRecurrence));
}

export function* setCardRecurrenceScope(cardId, scope) {
  yield put(actions.setCardRecurrenceScope(cardId, scope));
}

export function* toggleCardRecurrenceFoldInCurrentBoard(recurrenceId) {
  const { boardId } = yield select(selectors.selectPath);

  if (boardId) {
    yield put(actions.toggleCardRecurrenceFold(boardId, recurrenceId));
  }
}

export default {
  fetchCardRecurrences,
  fetchCardRecurrencesInCurrentBoard,
  createCardRecurrence,
  handleCardRecurrenceCreate,
  updateCardRecurrence,
  handleCardRecurrenceUpdate,
  deleteCardRecurrence,
  handleCardRecurrenceDelete,
  setCardRecurrenceScope,
  toggleCardRecurrenceFoldInCurrentBoard,
};
