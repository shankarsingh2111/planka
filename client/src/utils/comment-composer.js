/*!
 * Copyright (c) 2024 PLANKA Software GmbH
 * Licensed under the Fair Use License: https://github.com/plankanban/planka/blob/master/LICENSE.md
 */

// Spreadsheets and documents put an image of the copied cells next to their text, so a paste that
// carries text stays text and only a paste of files alone becomes attachments
export const getPastedFiles = (clipboardData) => {
  if (!clipboardData || [...clipboardData.types].includes('text/plain')) {
    return [];
  }

  return [...clipboardData.files];
};

// A click into a field of the comment box, such as the link row, keeps its focus
export const isOtherTextFieldFocused = (container, mainInput, activeElement) =>
  !!activeElement &&
  activeElement !== mainInput &&
  ['input', 'textarea'].includes(activeElement.tagName.toLowerCase()) &&
  container.contains(activeElement);

// A comment posted only for its attachments has nothing left when none of them made it
export const isCommentLeftEmpty = (text, createdAttachmentsTotal) =>
  !text && createdAttachmentsTotal === 0;
