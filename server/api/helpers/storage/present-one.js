/*!
 * Copyright (c) 2024 PLANKA Software GmbH
 * Licensed under the Fair Use License: https://github.com/plankanban/planka/blob/master/LICENSE.md
 */

module.exports = {
  sync: true,

  inputs: {
    config: {
      type: 'ref',
      required: true,
    },
  },

  fn(inputs) {
    return {
      isS3Enabled: sails.hooks.s3.isEnabled(),
      s3Bucket: sails.config.custom.s3Bucket || null,
      s3Region: sails.config.custom.s3Region || null,
      s3Export: sails.hooks['s3-export'].getState(),
      s3LastExportedAt: inputs.config.s3LastExportedAt,
      s3LastExportResult: inputs.config.s3LastExportResult,
    };
  },
};
