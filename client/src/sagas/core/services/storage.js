/*!
 * Copyright (c) 2024 PLANKA Software GmbH
 * Licensed under the Fair Use License: https://github.com/plankanban/planka/blob/master/LICENSE.md
 */

import { call, put } from 'redux-saga/effects';

import request from '../request';
import actions from '../../../actions';
import api from '../../../api';

export function* fetchStorage() {
  yield put(actions.fetchStorage());

  let storage;
  try {
    ({ item: storage } = yield call(request, api.getStorage));
  } catch (error) {
    yield put(actions.fetchStorage.failure(error));
    return;
  }

  yield put(actions.fetchStorage.success(storage));
}

export function* exportStorageToS3(data) {
  yield put(actions.exportStorageToS3(data));

  let storage;
  try {
    ({ item: storage } = yield call(request, api.exportStorageToS3, data));
  } catch (error) {
    yield put(actions.exportStorageToS3.failure(error));
    return;
  }

  yield put(actions.exportStorageToS3.success(storage));
}

export default {
  fetchStorage,
  exportStorageToS3,
};
