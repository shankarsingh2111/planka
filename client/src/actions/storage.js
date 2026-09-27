/*!
 * Copyright (c) 2024 PLANKA Software GmbH
 * Licensed under the Fair Use License: https://github.com/plankanban/planka/blob/master/LICENSE.md
 */

import ActionTypes from '../constants/ActionTypes';

const fetchStorage = () => ({
  type: ActionTypes.STORAGE_FETCH,
  payload: {},
});

fetchStorage.success = (storage) => ({
  type: ActionTypes.STORAGE_FETCH__SUCCESS,
  payload: {
    storage,
  },
});

fetchStorage.failure = (error) => ({
  type: ActionTypes.STORAGE_FETCH__FAILURE,
  payload: {
    error,
  },
});

const exportStorageToS3 = (data) => ({
  type: ActionTypes.STORAGE_EXPORT_TO_S3,
  payload: {
    data,
  },
});

exportStorageToS3.success = (storage) => ({
  type: ActionTypes.STORAGE_EXPORT_TO_S3__SUCCESS,
  payload: {
    storage,
  },
});

exportStorageToS3.failure = (error) => ({
  type: ActionTypes.STORAGE_EXPORT_TO_S3__FAILURE,
  payload: {
    error,
  },
});

export default {
  fetchStorage,
  exportStorageToS3,
};
