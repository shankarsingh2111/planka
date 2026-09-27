/*!
 * Copyright (c) 2024 PLANKA Software GmbH
 * Licensed under the Fair Use License: https://github.com/plankanban/planka/blob/master/LICENSE.md
 */

import EntryActionTypes from '../constants/EntryActionTypes';

const fetchStorage = () => ({
  type: EntryActionTypes.STORAGE_FETCH,
  payload: {},
});

const exportStorageToS3 = (data) => ({
  type: EntryActionTypes.STORAGE_EXPORT_TO_S3,
  payload: {
    data,
  },
});

export default {
  fetchStorage,
  exportStorageToS3,
};
