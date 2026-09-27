/*!
 * Copyright (c) 2024 PLANKA Software GmbH
 * Licensed under the Fair Use License: https://github.com/plankanban/planka/blob/master/LICENSE.md
 */

/**
 * @swagger
 * components:
 *   schemas:
 *     Storage:
 *       type: object
 *       required:
 *         - isS3Enabled
 *         - s3Bucket
 *         - s3Region
 *         - s3Export
 *         - s3LastExportedAt
 *         - s3LastExportResult
 *       properties:
 *         isS3Enabled:
 *           type: boolean
 *           description: Whether uploaded files are stored in S3 (otherwise on the local disk)
 *           example: true
 *         s3Bucket:
 *           type: string
 *           nullable: true
 *           description: S3 bucket uploaded files are stored in
 *           example: planka
 *         s3Region:
 *           type: string
 *           nullable: true
 *           description: Region of the S3 bucket
 *           example: ap-south-1
 *         s3Export:
 *           type: object
 *           nullable: true
 *           description: Progress of the current or last export of local files to S3 since the server started
 *           properties:
 *             status:
 *               type: string
 *               enum: [running, completed, failed]
 *             deleteLocalFiles:
 *               type: boolean
 *             startedAt:
 *               type: string
 *               format: date-time
 *             finishedAt:
 *               type: string
 *               format: date-time
 *               nullable: true
 *             total:
 *               type: number
 *               nullable: true
 *               description: Files to export (null while local files are being listed)
 *             processed:
 *               type: number
 *             copied:
 *               type: number
 *             skipped:
 *               type: number
 *               description: Files already in S3 with the same size
 *             deleted:
 *               type: number
 *               description: Local copies deleted after their S3 copy was verified
 *             orphaned:
 *               type: number
 *               description: Local files of deleted uploads, which are not exported
 *             failed:
 *               type: number
 *             failures:
 *               type: array
 *               description: First failures, with the reason
 *               items:
 *                 type: object
 *                 properties:
 *                   pathSegment:
 *                     type: string
 *                   message:
 *                     type: string
 *             error:
 *               type: string
 *               nullable: true
 *               description: Why the whole export failed
 *         s3LastExportedAt:
 *           type: string
 *           format: date-time
 *           nullable: true
 *           description: When the last export that completed without failures finished
 *           example: 2024-01-01T00:00:00.000Z
 *         s3LastExportResult:
 *           type: object
 *           nullable: true
 *           description: Counts of the last export that completed without failures
 */

/**
 * @swagger
 * /storage:
 *   get:
 *     summary: Get file storage status
 *     description: Retrieves where uploaded files are stored and the progress of the export of local files to S3. Requires admin privileges.
 *     tags:
 *       - Storage
 *     operationId: getStorage
 *     responses:
 *       200:
 *         description: Storage status retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               required:
 *                 - item
 *               properties:
 *                 item:
 *                   $ref: '#/components/schemas/Storage'
 */

module.exports = {
  async fn() {
    const config = await Config.qm.getOneMain();

    return {
      item: sails.helpers.storage.presentOne(config),
    };
  },
};
