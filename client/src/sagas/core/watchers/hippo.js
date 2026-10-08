/*!
 * Copyright (c) 2024 PLANKA Software GmbH
 * Licensed under the Fair Use License: https://github.com/plankanban/planka/blob/master/LICENSE.md
 */

import { all, takeEvery } from 'redux-saga/effects';

import services from '../services';
import EntryActionTypes from '../../../constants/EntryActionTypes';

export default function* hippoWatchers() {
  yield all([
    takeEvery(EntryActionTypes.HIPPO_SYNC_RETRY, ({ payload: { cardId, commentId } }) =>
      services.retryHippoSync(cardId, commentId),
    ),
  ]);
}
