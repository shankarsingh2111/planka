/*!
 * Copyright (c) 2024 PLANKA Software GmbH
 * Licensed under the Fair Use License: https://github.com/plankanban/planka/blob/master/LICENSE.md
 */

import { call, put, select } from 'redux-saga/effects';

import request from '../request';
import selectors from '../../../selectors';
import actions from '../../../actions';
import api from '../../../api';
import { createLocalId } from '../../../utils/local-id';

export function* fetchCardDependencies(boardId) {
  yield put(actions.fetchCardDependencies(boardId));

  let cardDependencies;
  try {
    ({ items: cardDependencies } = yield call(request, api.getCardDependencies, boardId));
  } catch (error) {
    yield put(actions.fetchCardDependencies.failure(boardId, error));
    return;
  }

  yield put(actions.fetchCardDependencies.success(boardId, cardDependencies));
}

export function* fetchCardDependenciesInCurrentBoard() {
  const { boardId } = yield select(selectors.selectPath);

  if (boardId) {
    yield call(fetchCardDependencies, boardId);
  }
}

export function* createCardDependency(predecessorCardId, successorCardId) {
  const localId = yield call(createLocalId);
  const { boardId } = yield select(selectors.selectCardById, successorCardId);

  yield put(
    actions.createCardDependency({
      id: localId,
      boardId,
      predecessorCardId,
      successorCardId,
    }),
  );

  let cardDependency;
  try {
    ({ item: cardDependency } = yield call(request, api.createCardDependency, successorCardId, {
      predecessorCardId,
    }));
  } catch (error) {
    yield put(actions.createCardDependency.failure(localId, error));
    return;
  }

  yield put(actions.createCardDependency.success(localId, cardDependency));
}

export function* handleCardDependencyCreate(cardDependency) {
  yield put(actions.handleCardDependencyCreate(cardDependency));
}

export function* deleteCardDependency(id) {
  yield put(actions.deleteCardDependency(id));

  let cardDependency;
  try {
    ({ item: cardDependency } = yield call(request, api.deleteCardDependency, id));
  } catch (error) {
    yield put(actions.deleteCardDependency.failure(id, error));
    return;
  }

  yield put(actions.deleteCardDependency.success(cardDependency));
}

export function* handleCardDependencyDelete(cardDependency) {
  yield put(actions.handleCardDependencyDelete(cardDependency));
}

export default {
  fetchCardDependencies,
  fetchCardDependenciesInCurrentBoard,
  createCardDependency,
  handleCardDependencyCreate,
  deleteCardDependency,
  handleCardDependencyDelete,
};
