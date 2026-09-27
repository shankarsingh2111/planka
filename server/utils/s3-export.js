/*!
 * Copyright (c) 2024 PLANKA Software GmbH
 * Licensed under the Fair Use License: https://github.com/plankanban/planka/blob/master/LICENSE.md
 */

const fs = require('fs');
const path = require('path');
const mime = require('mime-types');

const DEFAULT_CONCURRENCY = 4;
const MAX_FAILURES_TO_KEEP = 20;

const listFilesInDirectory = async (dirPath) => {
  let dirents;
  try {
    dirents = await fs.promises.readdir(dirPath, {
      withFileTypes: true,
    });
  } catch (error) {
    return [];
  }

  const filePathsByDirent = await Promise.all(
    dirents.map((dirent) => {
      const direntPath = path.join(dirPath, dirent.name);

      if (dirent.isDirectory()) {
        return listFilesInDirectory(direntPath);
      }

      return dirent.isFile() ? [direntPath] : [];
    }),
  );

  return filePathsByDirent.flat();
};

/**
 * Lists the files stored locally under the given roots.
 * @param {string} basePath Local uploads base path
 * @param {string[]} rootPathSegments Top-level directories to list (missing ones are ignored)
 * @returns {Promise<{ absolutePath: string, pathSegment: string, size: number }[]>} Sorted by path,
 *   where pathSegment is the key the file has in any file manager (posix, relative to basePath)
 */
const listLocalFiles = async (basePath, rootPathSegments) => {
  const filePathsByRoot = await Promise.all(
    rootPathSegments.map((rootPathSegment) =>
      listFilesInDirectory(path.join(basePath, rootPathSegment)),
    ),
  );

  const files = await Promise.all(
    filePathsByRoot.flat().map(async (absolutePath) => {
      const { size } = await fs.promises.stat(absolutePath);

      return {
        absolutePath,
        size,
        pathSegment: path.relative(basePath, absolutePath).split(path.sep).join('/'),
      };
    }),
  );

  return files.sort((a, b) => a.pathSegment.localeCompare(b.pathSegment));
};

/**
 * Returns the id of the uploaded file a path belongs to, e.g. "private/attachments/<id>/...".
 * @param {string} pathSegment
 * @param {string[]} uploadedFilePathSegments Directories holding one subdirectory per uploaded file
 * @returns {string|null}
 */
const getUploadedFileId = (pathSegment, uploadedFilePathSegments) => {
  const uploadedFilePathSegment = uploadedFilePathSegments.find((segment) =>
    pathSegment.startsWith(`${segment}/`),
  );

  if (!uploadedFilePathSegment) {
    return null;
  }

  return pathSegment.slice(uploadedFilePathSegment.length + 1).split('/')[0];
};

/**
 * Uploads local files to S3, skipping those already there with the same size, and optionally
 * deletes each local file once its S3 copy is verified. Never throws for a single file.
 * @param {object} params
 * @param {object[]} params.files Result of listLocalFiles
 * @param {S3FileManager} params.fileManager Only getSize() and move() are used - getSize() reads
 *   S3 alone and never falls back to local storage, so a verified size is always the S3 copy's
 * @param {boolean} params.deleteLocalFiles
 * @param {function} [params.onProgress] Called with the running result after each file
 * @param {number} [params.concurrency]
 */
const exportFiles = async ({
  files,
  fileManager,
  deleteLocalFiles,
  onProgress,
  concurrency = DEFAULT_CONCURRENCY,
}) => {
  const result = {
    processed: 0,
    copied: 0,
    skipped: 0,
    deleted: 0,
    failed: 0,
    failures: [],
  };

  const exportFile = async ({ absolutePath, pathSegment, size }) => {
    let s3Size = await fileManager.getSize(pathSegment);

    let isCopied = false;
    if (s3Size !== size) {
      await fileManager.move(
        absolutePath,
        pathSegment,
        mime.lookup(pathSegment) || 'application/octet-stream',
      );

      isCopied = true;

      if (deleteLocalFiles) {
        s3Size = await fileManager.getSize(pathSegment);
      }
    }

    if (deleteLocalFiles) {
      if (s3Size !== size) {
        throw new Error(
          `S3 copy could not be verified (expected ${size} bytes, found ${s3Size === null ? 'none' : `${s3Size} bytes`})`,
        );
      }

      await fs.promises.unlink(absolutePath);
      result.deleted += 1;
    }

    if (isCopied) {
      result.copied += 1;
    } else {
      result.skipped += 1;
    }
  };

  let nextIndex = 0;
  const work = async () => {
    while (nextIndex < files.length) {
      const file = files[nextIndex];
      nextIndex += 1;

      try {
        await exportFile(file); // eslint-disable-line no-await-in-loop
      } catch (error) {
        result.failed += 1;

        if (result.failures.length < MAX_FAILURES_TO_KEEP) {
          result.failures.push({
            pathSegment: file.pathSegment,
            message: error.message,
          });
        }
      }

      result.processed += 1;

      if (onProgress) {
        onProgress(result);
      }
    }
  };

  await Promise.all(Array.from({ length: Math.min(concurrency, files.length) }, work));

  return result;
};

/**
 * Removes every empty directory below dirPath, keeping dirPath itself. Never removes files.
 * @param {string} dirPath
 */
const removeEmptyDirectories = async (dirPath) => {
  let dirents;
  try {
    dirents = await fs.promises.readdir(dirPath, {
      withFileTypes: true,
    });
  } catch (error) {
    return;
  }

  await Promise.all(
    dirents
      .filter((dirent) => dirent.isDirectory())
      .map(async (dirent) => {
        const subdirPath = path.join(dirPath, dirent.name);
        await removeEmptyDirectories(subdirPath);

        try {
          await fs.promises.rmdir(subdirPath); // Fails, as intended, while anything is left inside
        } catch (error) {
          /* empty */
        }
      }),
  );
};

module.exports = {
  listLocalFiles,
  getUploadedFileId,
  exportFiles,
  removeEmptyDirectories,
};
