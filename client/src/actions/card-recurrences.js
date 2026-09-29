/*!
 * Copyright (c) 2024 PLANKA Software GmbH
 * Licensed under the Fair Use License: https://github.com/plankanban/planka/blob/master/LICENSE.md
 */

import ActionTypes from '../constants/ActionTypes';

const fetchCardRecurrences = (boardId) => ({
  type: ActionTypes.CARD_RECURRENCES_FETCH,
  payload: {
    boardId,
  },
});

fetchCardRecurrences.success = (boardId, cardRecurrences) => ({
  type: ActionTypes.CARD_RECURRENCES_FETCH__SUCCESS,
  payload: {
    boardId,
    cardRecurrences,
  },
});

fetchCardRecurrences.failure = (boardId, error) => ({
  type: ActionTypes.CARD_RECURRENCES_FETCH__FAILURE,
  payload: {
    boardId,
    error,
  },
});

const createCardRecurrence = (cardId, data) => ({
  type: ActionTypes.CARD_RECURRENCE_CREATE,
  payload: {
    cardId,
    data,
  },
});

createCardRecurrence.success = (cardRecurrence) => ({
  type: ActionTypes.CARD_RECURRENCE_CREATE__SUCCESS,
  payload: {
    cardRecurrence,
  },
});

createCardRecurrence.failure = (cardId, error) => ({
  type: ActionTypes.CARD_RECURRENCE_CREATE__FAILURE,
  payload: {
    cardId,
    error,
  },
});

const handleCardRecurrenceCreate = (cardRecurrence) => ({
  type: ActionTypes.CARD_RECURRENCE_CREATE_HANDLE,
  payload: {
    cardRecurrence,
  },
});

const updateCardRecurrence = (cardId, scope, data) => ({
  type: ActionTypes.CARD_RECURRENCE_UPDATE,
  payload: {
    cardId,
    scope,
    data,
  },
});

updateCardRecurrence.success = (cardRecurrence) => ({
  type: ActionTypes.CARD_RECURRENCE_UPDATE__SUCCESS,
  payload: {
    cardRecurrence,
  },
});

updateCardRecurrence.failure = (cardId, error) => ({
  type: ActionTypes.CARD_RECURRENCE_UPDATE__FAILURE,
  payload: {
    cardId,
    error,
  },
});

const handleCardRecurrenceUpdate = (cardRecurrence) => ({
  type: ActionTypes.CARD_RECURRENCE_UPDATE_HANDLE,
  payload: {
    cardRecurrence,
  },
});

const deleteCardRecurrence = (cardId, scope) => ({
  type: ActionTypes.CARD_RECURRENCE_DELETE,
  payload: {
    cardId,
    scope,
  },
});

deleteCardRecurrence.success = (cardRecurrence) => ({
  type: ActionTypes.CARD_RECURRENCE_DELETE__SUCCESS,
  payload: {
    cardRecurrence,
  },
});

deleteCardRecurrence.failure = (cardId, error) => ({
  type: ActionTypes.CARD_RECURRENCE_DELETE__FAILURE,
  payload: {
    cardId,
    error,
  },
});

const handleCardRecurrenceDelete = (cardRecurrence) => ({
  type: ActionTypes.CARD_RECURRENCE_DELETE_HANDLE,
  payload: {
    cardRecurrence,
  },
});

const setCardRecurrenceScope = (cardId, scope) => ({
  type: ActionTypes.CARD_RECURRENCE_SCOPE_SET,
  payload: {
    cardId,
    scope,
  },
});

const toggleCardRecurrenceFold = (boardId, recurrenceId) => ({
  type: ActionTypes.CARD_RECURRENCE_FOLD_TOGGLE,
  payload: {
    boardId,
    recurrenceId,
  },
});

export default {
  fetchCardRecurrences,
  createCardRecurrence,
  handleCardRecurrenceCreate,
  updateCardRecurrence,
  handleCardRecurrenceUpdate,
  deleteCardRecurrence,
  handleCardRecurrenceDelete,
  setCardRecurrenceScope,
  toggleCardRecurrenceFold,
};
