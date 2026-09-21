/*!
 * Copyright (c) 2024 PLANKA Software GmbH
 * Licensed under the Fair Use License: https://github.com/plankanban/planka/blob/master/LICENSE.md
 */

import EntryActionTypes from '../constants/EntryActionTypes';

const fetchCardDependenciesInCurrentBoard = () => ({
  type: EntryActionTypes.CARD_DEPENDENCIES_IN_CURRENT_BOARD_FETCH,
  payload: {},
});

const createCardDependency = (predecessorCardId, successorCardId) => ({
  type: EntryActionTypes.CARD_DEPENDENCY_CREATE,
  payload: {
    predecessorCardId,
    successorCardId,
  },
});

const handleCardDependencyCreate = (cardDependency) => ({
  type: EntryActionTypes.CARD_DEPENDENCY_CREATE_HANDLE,
  payload: {
    cardDependency,
  },
});

const deleteCardDependency = (id) => ({
  type: EntryActionTypes.CARD_DEPENDENCY_DELETE,
  payload: {
    id,
  },
});

const handleCardDependencyDelete = (cardDependency) => ({
  type: EntryActionTypes.CARD_DEPENDENCY_DELETE_HANDLE,
  payload: {
    cardDependency,
  },
});

export default {
  fetchCardDependenciesInCurrentBoard,
  createCardDependency,
  handleCardDependencyCreate,
  deleteCardDependency,
  handleCardDependencyDelete,
};
