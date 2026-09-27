/*!
 * Copyright (c) 2024 PLANKA Software GmbH
 * Licensed under the Fair Use License: https://github.com/plankanban/planka/blob/master/LICENSE.md
 */

const fsPromises = require('fs').promises;
const { fileTypeFromFile } = require('file-type');

const filenamify = require('../../../utils/filenamify');
const {
  getFileExtension,
  isAllowedExtension,
  isDetectedTypeAllowed,
  findSvgActiveContent,
} = require('../../../utils/attachment-files');

module.exports = {
  inputs: {
    file: {
      type: 'json',
      required: true,
    },
  },

  exits: {
    fileTypeNotAllowed: {},
    svgContainsActiveContent: {},
  },

  async fn(inputs) {
    const { allowedAttachmentExtensions } = sails.config.custom;

    // The name the file is stored and served with
    const filename = filenamify(inputs.file.filename);
    const extension = getFileExtension(filename);

    if (!isAllowedExtension(filename, allowedAttachmentExtensions)) {
      throw 'fileTypeNotAllowed';
    }

    const fileType = await fileTypeFromFile(inputs.file.fd);

    if (!isDetectedTypeAllowed(extension, fileType, allowedAttachmentExtensions)) {
      sails.log.warn(
        `Attachment "${filename}" rejected: content detected as ${fileType.ext} (${fileType.mime})`,
      );

      throw 'fileTypeNotAllowed';
    }

    // Checked even when any file type is allowed, since browsers run scripts in SVGs
    if (extension === 'svg') {
      const problem = findSvgActiveContent(await fsPromises.readFile(inputs.file.fd, 'utf8'));

      if (problem) {
        sails.log.warn(`Attachment "${filename}" rejected: SVG contains ${problem}`);
        throw 'svgContainsActiveContent';
      }
    }
  },
};
