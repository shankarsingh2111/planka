/*!
 * Copyright (c) 2024 PLANKA Software GmbH
 * Licensed under the Fair Use License: https://github.com/plankanban/planka/blob/master/LICENSE.md
 */

/**
 * @swagger
 * /storage/export-to-s3:
 *   post:
 *     summary: Export local files to S3
 *     description: Starts copying the files stored on the local disk to S3 in the background, skipping files already there with the same size. Does nothing if an export is already running. Requires admin privileges and S3 to be enabled.
 *     tags:
 *       - Storage
 *     operationId: exportStorageToS3
 *     requestBody:
 *       required: false
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               deleteLocalFiles:
 *                 type: boolean
 *                 default: false
 *                 description: Delete each local file once its S3 copy is verified
 *     responses:
 *       200:
 *         description: Export started, or already running
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               required:
 *                 - item
 *               properties:
 *                 item:
 *                   $ref: '#/components/schemas/Storage'
 *       422:
 *         description: S3 is not enabled
 */

const Errors = {
  S3_NOT_ENABLED: {
    s3NotEnabled: 'S3 is not enabled',
  },
};

module.exports = {
  inputs: {
    deleteLocalFiles: {
      type: 'boolean',
      defaultsTo: false,
    },
  },

  exits: {
    s3NotEnabled: {
      responseType: 'unprocessableEntity',
    },
  },

  async fn(inputs) {
    if (!sails.hooks.s3.isEnabled()) {
      throw Errors.S3_NOT_ENABLED;
    }

    sails.hooks['s3-export'].start({
      deleteLocalFiles: inputs.deleteLocalFiles,
    });

    const config = await Config.qm.getOneMain();

    return {
      item: sails.helpers.storage.presentOne(config),
    };
  },
};
