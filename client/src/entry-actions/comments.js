/*!
 * Copyright (c) 2024 PLANKA Software GmbH
 * Licensed under the Fair Use License: https://github.com/plankanban/planka/blob/master/LICENSE.md
 */

import EntryActionTypes from '../constants/EntryActionTypes';

const fetchCommentsInCurrentCard = () => ({
  type: EntryActionTypes.COMMENTS_IN_CURRENT_CARD_FETCH,
  payload: {},
});

const createCommentInCurrentCard = (data, { syncToHippo = false, attachments = [] } = {}) => ({
  type: EntryActionTypes.COMMENT_IN_CURRENT_CARD_CREATE,
  payload: {
    data,
    syncToHippo,
    attachments,
  },
});

const handleCommentCreate = (comment, users) => ({
  type: EntryActionTypes.COMMENT_CREATE_HANDLE,
  payload: {
    comment,
    users,
  },
});

// data is null when only the attachments change
const updateComment = (id, data, { addAttachments = [], removeAttachmentIds = [] } = {}) => ({
  type: EntryActionTypes.COMMENT_UPDATE,
  payload: {
    id,
    data,
    addAttachments,
    removeAttachmentIds,
  },
});

const handleCommentUpdate = (comment) => ({
  type: EntryActionTypes.COMMENT_UPDATE_HANDLE,
  payload: {
    comment,
  },
});

const deleteComment = (id) => ({
  type: EntryActionTypes.COMMENT_DELETE,
  payload: {
    id,
  },
});

const handleCommentDelete = (comment) => ({
  type: EntryActionTypes.COMMENT_DELETE_HANDLE,
  payload: {
    comment,
  },
});

export default {
  fetchCommentsInCurrentCard,
  createCommentInCurrentCard,
  handleCommentCreate,
  updateComment,
  handleCommentUpdate,
  deleteComment,
  handleCommentDelete,
};
