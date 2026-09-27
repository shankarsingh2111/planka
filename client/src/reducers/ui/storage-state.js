/*!
 * Copyright (c) 2024 PLANKA Software GmbH
 * Licensed under the Fair Use License: https://github.com/plankanban/planka/blob/master/LICENSE.md
 */

import ActionTypes from '../../constants/ActionTypes';

const initialState = {
  storage: null,
  isExportSubmitting: false,
  error: null,
};

// eslint-disable-next-line default-param-last
export default (state = initialState, { type, payload }) => {
  switch (type) {
    case ActionTypes.STORAGE_FETCH__SUCCESS:
      return {
        ...state,
        storage: payload.storage,
        error: null,
      };
    case ActionTypes.STORAGE_FETCH__FAILURE:
      return {
        ...state,
        error: payload.error,
      };
    case ActionTypes.STORAGE_EXPORT_TO_S3:
      return {
        ...state,
        isExportSubmitting: true,
        error: null,
      };
    case ActionTypes.STORAGE_EXPORT_TO_S3__SUCCESS:
      return {
        ...state,
        storage: payload.storage,
        isExportSubmitting: false,
      };
    case ActionTypes.STORAGE_EXPORT_TO_S3__FAILURE:
      return {
        ...state,
        isExportSubmitting: false,
        error: payload.error,
      };
    default:
      return state;
  }
};
