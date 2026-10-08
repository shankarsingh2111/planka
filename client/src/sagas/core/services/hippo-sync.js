/*!
 * Copyright (c) 2024 PLANKA Software GmbH
 * Licensed under the Fair Use License: https://github.com/plankanban/planka/blob/master/LICENSE.md
 */

import { call } from 'redux-saga/effects';
import toast from 'react-hot-toast';

import request from '../request';
import api from '../../../api';
import ToastTypes from '../../../constants/ToastTypes';

const FAILED_TOAST_DURATION = 10 * 1000;

// A failed push leaves the Planka change in place; the toast offers to push again
function* toastSyncFailure(cardId, commentId, error) {
  yield call(
    toast,
    {
      type: ToastTypes.HIPPO_SYNC_FAILED,
      params: {
        cardId,
        commentId,
        error: {
          message: error.message,
        },
      },
    },
    {
      duration: FAILED_TOAST_DURATION,
    },
  );
}

export function* syncCommentToHippo(cardId, commentId) {
  try {
    yield call(request, api.syncHippoNote, cardId, {
      commentId,
    });
  } catch (error) {
    yield call(toastSyncFailure, cardId, commentId, error);
  }
}

export function* syncTicketStateToHippo(cardId) {
  try {
    yield call(request, api.syncHippoStatus, cardId);
  } catch (error) {
    yield call(toastSyncFailure, cardId, null, error);
  }
}

export function* retryHippoSync(cardId, commentId) {
  if (commentId) {
    yield call(syncCommentToHippo, cardId, commentId);
  } else {
    yield call(syncTicketStateToHippo, cardId);
  }
}

export default {
  syncCommentToHippo,
  syncTicketStateToHippo,
  retryHippoSync,
};
