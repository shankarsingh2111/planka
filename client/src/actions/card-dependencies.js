/*!
 * Copyright (c) 2024 PLANKA Software GmbH
 * Licensed under the Fair Use License: https://github.com/plankanban/planka/blob/master/LICENSE.md
 */

import ActionTypes from '../constants/ActionTypes';

const fetchCardDependencies = (boardId) => ({
  type: ActionTypes.CARD_DEPENDENCIES_FETCH,
  payload: {
    boardId,
  },
});

fetchCardDependencies.success = (boardId, cardDependencies) => ({
  type: ActionTypes.CARD_DEPENDENCIES_FETCH__SUCCESS,
  payload: {
    boardId,
    cardDependencies,
  },
});

fetchCardDependencies.failure = (boardId, error) => ({
  type: ActionTypes.CARD_DEPENDENCIES_FETCH__FAILURE,
  payload: {
    boardId,
    error,
  },
});

const createCardDependency = (cardDependency) => ({
  type: ActionTypes.CARD_DEPENDENCY_CREATE,
  payload: {
    cardDependency,
  },
});

createCardDependency.success = (localId, cardDependency) => ({
  type: ActionTypes.CARD_DEPENDENCY_CREATE__SUCCESS,
  payload: {
    localId,
    cardDependency,
  },
});

createCardDependency.failure = (localId, error) => ({
  type: ActionTypes.CARD_DEPENDENCY_CREATE__FAILURE,
  payload: {
    localId,
    error,
  },
});

const handleCardDependencyCreate = (cardDependency) => ({
  type: ActionTypes.CARD_DEPENDENCY_CREATE_HANDLE,
  payload: {
    cardDependency,
  },
});

const deleteCardDependency = (id) => ({
  type: ActionTypes.CARD_DEPENDENCY_DELETE,
  payload: {
    id,
  },
});

deleteCardDependency.success = (cardDependency) => ({
  type: ActionTypes.CARD_DEPENDENCY_DELETE__SUCCESS,
  payload: {
    cardDependency,
  },
});

deleteCardDependency.failure = (id, error) => ({
  type: ActionTypes.CARD_DEPENDENCY_DELETE__FAILURE,
  payload: {
    id,
    error,
  },
});

const handleCardDependencyDelete = (cardDependency) => ({
  type: ActionTypes.CARD_DEPENDENCY_DELETE_HANDLE,
  payload: {
    cardDependency,
  },
});

export default {
  fetchCardDependencies,
  createCardDependency,
  handleCardDependencyCreate,
  deleteCardDependency,
  handleCardDependencyDelete,
};
