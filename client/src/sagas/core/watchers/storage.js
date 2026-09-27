/*!
 * Copyright (c) 2024 PLANKA Software GmbH
 * Licensed under the Fair Use License: https://github.com/plankanban/planka/blob/master/LICENSE.md
 */

import { all, takeEvery, takeLeading } from 'redux-saga/effects';

import services from '../services';
import EntryActionTypes from '../../../constants/EntryActionTypes';

export default function* storageWatchers() {
  yield all([
    // Polling while an export runs must not pile up requests
    takeLeading(EntryActionTypes.STORAGE_FETCH, () => services.fetchStorage()),
    takeEvery(EntryActionTypes.STORAGE_EXPORT_TO_S3, ({ payload: { data } }) =>
      services.exportStorageToS3(data),
    ),
  ]);
}
