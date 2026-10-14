/*!
 * Copyright (c) 2024 PLANKA Software GmbH
 * Licensed under the Fair Use License: https://github.com/plankanban/planka/blob/master/LICENSE.md
 */

import sortBy from 'lodash/sortBy';
import { createSelector } from 'redux-orm';

import orm from '../orm';
import { isLocalId } from '../utils/local-id';

export const makeSelectAttachmentById = () =>
  createSelector(
    orm,
    (_, id) => id,
    ({ Attachment }, id) => {
      const attachmentModel = Attachment.withId(id);

      if (!attachmentModel) {
        return attachmentModel;
      }

      return {
        ...attachmentModel.ref,
        isPersisted: !isLocalId(attachmentModel.id),
      };
    },
  );

export const selectAttachmentById = makeSelectAttachmentById();

export const selectIsAttachmentWithIdExists = createSelector(
  orm,
  (_, id) => id,
  ({ Attachment }, id) => Attachment.idExists(id),
);

// Images first, so their thumbnails sit together above the file and link chips
export const makeSelectAttachmentsByCommentId = () =>
  createSelector(
    orm,
    (_, commentId) => commentId,
    ({ Comment }, commentId) => {
      const commentModel = Comment.withId(commentId);

      if (!commentModel) {
        return [];
      }

      const attachments = commentModel.attachments.toRefArray().map((attachment) => ({
        ...attachment,
        isPersisted: !isLocalId(attachment.id),
      }));

      return sortBy(attachments, (attachment) => !(attachment.data && attachment.data.image));
    },
  );

export default {
  makeSelectAttachmentById,
  makeSelectAttachmentsByCommentId,
  selectAttachmentById,
  selectIsAttachmentWithIdExists,
};
