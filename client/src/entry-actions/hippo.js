/*!
 * Copyright (c) 2024 PLANKA Software GmbH
 * Licensed under the Fair Use License: https://github.com/plankanban/planka/blob/master/LICENSE.md
 */

import EntryActionTypes from '../constants/EntryActionTypes';

// A comment push when commentId is given, a ticket state push otherwise
const retryHippoSync = (cardId, commentId) => ({
  type: EntryActionTypes.HIPPO_SYNC_RETRY,
  payload: {
    cardId,
    commentId,
  },
});

export default {
  retryHippoSync,
};
