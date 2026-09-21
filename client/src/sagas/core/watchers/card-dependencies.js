/*!
 * Copyright (c) 2024 PLANKA Software GmbH
 * Licensed under the Fair Use License: https://github.com/plankanban/planka/blob/master/LICENSE.md
 */

import { all, takeEvery } from 'redux-saga/effects';

import services from '../services';
import EntryActionTypes from '../../../constants/EntryActionTypes';

export default function* cardDependenciesWatchers() {
  yield all([
    takeEvery(EntryActionTypes.CARD_DEPENDENCIES_IN_CURRENT_BOARD_FETCH, () =>
      services.fetchCardDependenciesInCurrentBoard(),
    ),
    takeEvery(
      EntryActionTypes.CARD_DEPENDENCY_CREATE,
      ({ payload: { predecessorCardId, successorCardId } }) =>
        services.createCardDependency(predecessorCardId, successorCardId),
    ),
    takeEvery(EntryActionTypes.CARD_DEPENDENCY_CREATE_HANDLE, ({ payload: { cardDependency } }) =>
      services.handleCardDependencyCreate(cardDependency),
    ),
    takeEvery(EntryActionTypes.CARD_DEPENDENCY_DELETE, ({ payload: { id } }) =>
      services.deleteCardDependency(id),
    ),
    takeEvery(EntryActionTypes.CARD_DEPENDENCY_DELETE_HANDLE, ({ payload: { cardDependency } }) =>
      services.handleCardDependencyDelete(cardDependency),
    ),
  ]);
}
