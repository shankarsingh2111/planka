/*!
 * Copyright (c) 2024 PLANKA Software GmbH
 * Licensed under the Fair Use License: https://github.com/plankanban/planka/blob/master/LICENSE.md
 */

// Editors manage every attachment. A member who may only comment manages the attachments of their
// own comments, and nothing on the card itself.
const canManageAttachment = ({ isEditor, canComment, comment, userId }) => {
  if (isEditor) {
    return true;
  }

  return !!comment && !!canComment && comment.userId === userId;
};

module.exports = {
  canManageAttachment,
};
