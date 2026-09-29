/*!
 * Copyright (c) 2024 PLANKA Software GmbH
 * Licensed under the Fair Use License: https://github.com/plankanban/planka/blob/master/LICENSE.md
 */

import { all, takeEvery } from 'redux-saga/effects';

import services from '../services';
import EntryActionTypes from '../../../constants/EntryActionTypes';

export default function* cardRecurrencesWatchers() {
  yield all([
    takeEvery(EntryActionTypes.CARD_RECURRENCES_IN_CURRENT_BOARD_FETCH, () =>
      services.fetchCardRecurrencesInCurrentBoard(),
    ),
    takeEvery(EntryActionTypes.CARD_RECURRENCE_CREATE, ({ payload: { cardId, data } }) =>
      services.createCardRecurrence(cardId, data),
    ),
    takeEvery(EntryActionTypes.CARD_RECURRENCE_CREATE_HANDLE, ({ payload: { cardRecurrence } }) =>
      services.handleCardRecurrenceCreate(cardRecurrence),
    ),
    takeEvery(EntryActionTypes.CARD_RECURRENCE_UPDATE, ({ payload: { cardId, scope, data } }) =>
      services.updateCardRecurrence(cardId, scope, data),
    ),
    takeEvery(EntryActionTypes.CARD_RECURRENCE_UPDATE_HANDLE, ({ payload: { cardRecurrence } }) =>
      services.handleCardRecurrenceUpdate(cardRecurrence),
    ),
    takeEvery(EntryActionTypes.CARD_RECURRENCE_DELETE, ({ payload: { cardId, scope } }) =>
      services.deleteCardRecurrence(cardId, scope),
    ),
    takeEvery(EntryActionTypes.CARD_RECURRENCE_DELETE_HANDLE, ({ payload: { cardRecurrence } }) =>
      services.handleCardRecurrenceDelete(cardRecurrence),
    ),
    takeEvery(EntryActionTypes.CARD_RECURRENCE_SCOPE_SET, ({ payload: { cardId, scope } }) =>
      services.setCardRecurrenceScope(cardId, scope),
    ),
    takeEvery(
      EntryActionTypes.CARD_RECURRENCE_FOLD_IN_CURRENT_BOARD_TOGGLE,
      ({ payload: { recurrenceId } }) =>
        services.toggleCardRecurrenceFoldInCurrentBoard(recurrenceId),
    ),
  ]);
}
