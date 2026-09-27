/*!
 * Copyright (c) 2024 PLANKA Software GmbH
 * Licensed under the Fair Use License: https://github.com/plankanban/planka/blob/master/LICENSE.md
 */

/**
 * s3-export hook
 *
 * @description :: Copies files stored on the local disk to S3 in the background, and keeps the
 *                 progress of the current (or last) run since the server started.
 * @docs        :: https://sailsjs.com/docs/concepts/extending-sails/hooks
 */

const path = require('path');

const {
  listLocalFiles,
  getUploadedFileId,
  exportFiles,
  removeEmptyDirectories,
} = require('../../../utils/s3-export');

const Statuses = {
  RUNNING: 'running',
  COMPLETED: 'completed',
  FAILED: 'failed',
};

module.exports = function defineS3ExportHook(sails) {
  let state = null;

  const run = async (currentState) => {
    const {
      uploadsBasePath,
      faviconsPathSegment,
      userAvatarsPathSegment,
      backgroundImagesPathSegment,
      attachmentsPathSegment,
    } = sails.config.custom;

    const uploadedFilePathSegments = [
      userAvatarsPathSegment,
      backgroundImagesPathSegment,
      attachmentsPathSegment,
    ];

    const pathSegments = [faviconsPathSegment, ...uploadedFilePathSegments];

    const localFiles = await listLocalFiles(uploadsBasePath, pathSegments);
    const uploadedFileIds = new Set(await UploadedFile.qm.getAllIds());

    // Files of deleted uploads can be left behind locally, there is no need to carry them over
    const files = localFiles.filter((file) => {
      const uploadedFileId = getUploadedFileId(file.pathSegment, uploadedFilePathSegments);
      return uploadedFileId === null || uploadedFileIds.has(uploadedFileId);
    });

    Object.assign(currentState, {
      total: files.length,
      orphaned: localFiles.length - files.length,
    });

    const result = await exportFiles({
      files,
      deleteLocalFiles: currentState.deleteLocalFiles,
      fileManager: sails.hooks['file-manager'].getInstance(),
      onProgress: (progress) => Object.assign(currentState, progress),
    });

    if (currentState.deleteLocalFiles) {
      await Promise.all(
        pathSegments.map((pathSegment) =>
          removeEmptyDirectories(path.join(uploadsBasePath, pathSegment)),
        ),
      );
    }

    const finishedAt = new Date().toISOString();

    if (result.failed === 0) {
      await Config.qm.updateOneMain({
        s3LastExportedAt: finishedAt,
        s3LastExportResult: _.pick(currentState, [
          'startedAt',
          'deleteLocalFiles',
          'total',
          'copied',
          'skipped',
          'deleted',
          'orphaned',
        ]),
      });
    }

    Object.assign(currentState, result, {
      finishedAt,
      status: Statuses.COMPLETED,
    });

    sails.log.info(
      `S3 export completed: ${result.copied} copied, ${result.skipped} skipped, ${result.deleted} local copies deleted, ${result.failed} failed`,
    );
  };

  return {
    /**
     * Runs when this Sails app loads/lifts.
     */

    async initialize() {
      sails.log.info('Initializing custom hook (`s3-export`)');
    },

    /**
     * @returns {object|null} Progress of the current or last run, null if none since startup
     */
    getState() {
      return (
        state && {
          ...state,
          failures: [...state.failures],
        }
      );
    },

    isRunning() {
      return !!state && state.status === Statuses.RUNNING;
    },

    /**
     * Starts an export in the background unless one is already running.
     * @param {object} options
     * @param {boolean} options.deleteLocalFiles Delete each local file once its S3 copy is verified
     * @returns {boolean} Whether a new export was started
     */
    start({ deleteLocalFiles }) {
      if (this.isRunning()) {
        return false;
      }

      const currentState = {
        deleteLocalFiles,
        status: Statuses.RUNNING,
        startedAt: new Date().toISOString(),
        finishedAt: null,
        total: null,
        processed: 0,
        copied: 0,
        skipped: 0,
        deleted: 0,
        orphaned: 0,
        failed: 0,
        failures: [],
        error: null,
      };

      state = currentState;

      sails.log.info(`S3 export started (deleteLocalFiles: ${deleteLocalFiles})`);

      run(currentState).catch((error) => {
        sails.log.error(`S3 export failed: ${error.stack}`);

        Object.assign(currentState, {
          status: Statuses.FAILED,
          finishedAt: new Date().toISOString(),
          error: error.message,
        });
      });

      return true;
    },
  };
};
