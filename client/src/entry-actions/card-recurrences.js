/*!
 * Copyright (c) 2024 PLANKA Software GmbH
 * Licensed under the Fair Use License: https://github.com/plankanban/planka/blob/master/LICENSE.md
 */

import EntryActionTypes from '../constants/EntryActionTypes';

const fetchCardRecurrencesInCurrentBoard = () => ({
  type: EntryActionTypes.CARD_RECURRENCES_IN_CURRENT_BOARD_FETCH,
  payload: {},
});

const createCardRecurrence = (cardId, data) => ({
  type: EntryActionTypes.CARD_RECURRENCE_CREATE,
  payload: {
    cardId,
    data,
  },
});

const handleCardRecurrenceCreate = (cardRecurrence) => ({
  type: EntryActionTypes.CARD_RECURRENCE_CREATE_HANDLE,
  payload: {
    cardRecurrence,
  },
});

const updateCardRecurrence = (cardId, scope, data) => ({
  type: EntryActionTypes.CARD_RECURRENCE_UPDATE,
  payload: {
    cardId,
    scope,
    data,
  },
});

const handleCardRecurrenceUpdate = (cardRecurrence) => ({
  type: EntryActionTypes.CARD_RECURRENCE_UPDATE_HANDLE,
  payload: {
    cardRecurrence,
  },
});

const deleteCardRecurrence = (cardId, scope) => ({
  type: EntryActionTypes.CARD_RECURRENCE_DELETE,
  payload: {
    cardId,
    scope,
  },
});

const handleCardRecurrenceDelete = (cardRecurrence) => ({
  type: EntryActionTypes.CARD_RECURRENCE_DELETE_HANDLE,
  payload: {
    cardRecurrence,
  },
});

const setCardRecurrenceScope = (cardId, scope) => ({
  type: EntryActionTypes.CARD_RECURRENCE_SCOPE_SET,
  payload: {
    cardId,
    scope,
  },
});

const toggleCardRecurrenceFoldInCurrentBoard = (recurrenceId) => ({
  type: EntryActionTypes.CARD_RECURRENCE_FOLD_IN_CURRENT_BOARD_TOGGLE,
  payload: {
    recurrenceId,
  },
});

export default {
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
