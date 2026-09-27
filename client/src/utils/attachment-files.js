/*!
 * Copyright (c) 2024 PLANKA Software GmbH
 * Licensed under the Fair Use License: https://github.com/plankanban/planka/blob/master/LICENSE.md
 */

import getFilenameAndExtension from './get-filename-and-extension';

export const AttachmentFileProblems = {
  TYPE_NOT_ALLOWED: 'typeNotAllowed',
  TOO_BIG: 'tooBig',
};

/**
 * Checks a file against the server's upload limits before it is uploaded.
 * The server enforces the same limits, this only saves uploading a file that would be rejected.
 * @param {File} file
 * @param {{ allowedExtensions?: string[]|null, maxFileSize?: number|null }} policy
 *   From bootstrap, null or missing means no limit
 * @returns {string|null} One of AttachmentFileProblems, or null if the file can be uploaded
 */
export const getAttachmentFileProblem = (file, { allowedExtensions, maxFileSize }) => {
  if (allowedExtensions) {
    const { extension } = getFilenameAndExtension(file.name);

    if (!extension || !allowedExtensions.includes(extension)) {
      return AttachmentFileProblems.TYPE_NOT_ALLOWED;
    }
  }

  if (maxFileSize && file.size > maxFileSize) {
    return AttachmentFileProblems.TOO_BIG;
  }

  return null;
};

export const buildAcceptAttribute = (allowedExtensions) =>
  allowedExtensions ? allowedExtensions.map((extension) => `.${extension}`).join(',') : undefined;
