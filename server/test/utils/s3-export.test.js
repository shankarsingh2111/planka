const fs = require('fs');
const os = require('os');
const path = require('path');
const { expect } = require('chai');
const {
  listLocalFiles,
  getUploadedFileId,
  exportFiles,
  removeEmptyDirectories,
} = require('../../utils/s3-export');

const writeFile = async (basePath, pathSegment, content) => {
  const filePath = path.join(basePath, pathSegment);
  await fs.promises.mkdir(path.dirname(filePath), { recursive: true });
  await fs.promises.writeFile(filePath, content);
  return filePath;
};

const exists = (filePath) =>
  fs.promises.stat(filePath).then(
    () => true,
    () => false,
  );

// Stands in for S3FileManager: getSize() returns null for missing objects, move() uploads
const createFakeS3FileManager = ({ failingPathSegments = [], sizeOverride } = {}) => {
  const sizeByPathSegment = new Map();

  return {
    sizeByPathSegment,
    async getSize(pathSegment) {
      return sizeByPathSegment.has(pathSegment) ? sizeByPathSegment.get(pathSegment) : null;
    },
    async move(sourceFilePath, pathSegment) {
      if (failingPathSegments.includes(pathSegment)) {
        throw new Error('Access Denied');
      }

      const { size } = await fs.promises.stat(sourceFilePath);
      sizeByPathSegment.set(pathSegment, sizeOverride === undefined ? size : sizeOverride);
      return null;
    },
  };
};

describe('s3-export', () => {
  let basePath;

  beforeEach(async () => {
    basePath = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'planka-s3-export-'));
  });

  afterEach(async () => {
    await fs.promises.rm(basePath, { recursive: true, force: true });
  });

  describe('#listLocalFiles(basePath, rootPathSegments)', () => {
    it('should list files under the given roots with posix path segments and sizes', async () => {
      await writeFile(basePath, 'private/attachments/11/report.pdf', 'pdf!');
      await writeFile(basePath, 'private/attachments/11/thumbnails/outside-360.jpg', 'jpg');
      await writeFile(basePath, 'protected/favicons/example.com.png', 'png!!');
      await writeFile(basePath, 'other/ignored.txt', 'ignored');

      const files = await listLocalFiles(basePath, ['private', 'protected', 'missing']);

      expect(files).to.deep.equal([
        {
          absolutePath: path.join(basePath, 'private/attachments/11/report.pdf'),
          pathSegment: 'private/attachments/11/report.pdf',
          size: 4,
        },
        {
          absolutePath: path.join(basePath, 'private/attachments/11/thumbnails/outside-360.jpg'),
          pathSegment: 'private/attachments/11/thumbnails/outside-360.jpg',
          size: 3,
        },
        {
          absolutePath: path.join(basePath, 'protected/favicons/example.com.png'),
          pathSegment: 'protected/favicons/example.com.png',
          size: 5,
        },
      ]);
    });
  });

  describe('#getUploadedFileId(pathSegment, uploadedFilePathSegments)', () => {
    const uploadedFilePathSegments = ['private/attachments', 'protected/user-avatars'];

    it('should return the uploaded file id for files of uploaded files', () => {
      expect(
        getUploadedFileId('private/attachments/123/thumbnails/x.jpg', uploadedFilePathSegments),
      ).to.equal('123');
      expect(
        getUploadedFileId('protected/user-avatars/45/original.png', uploadedFilePathSegments),
      ).to.equal('45');
    });

    it('should return null for other files', () => {
      expect(getUploadedFileId('protected/favicons/x.png', uploadedFilePathSegments)).to.equal(
        null,
      );
      expect(
        getUploadedFileId('private/attachments-old/1/x.png', uploadedFilePathSegments),
      ).to.equal(null);
    });
  });

  describe('#exportFiles({ files, fileManager, deleteLocalFiles, onProgress })', () => {
    it('should copy missing files, skip identical ones and re-copy ones that differ', async () => {
      await writeFile(basePath, 'private/a.pdf', 'aaaa');
      await writeFile(basePath, 'private/b.pdf', 'bb');
      await writeFile(basePath, 'private/c.pdf', 'cccccc');

      const fileManager = createFakeS3FileManager();
      fileManager.sizeByPathSegment.set('private/b.pdf', 2); // Already exported
      fileManager.sizeByPathSegment.set('private/c.pdf', 3); // Partial upload

      const files = await listLocalFiles(basePath, ['private']);
      const progressCalls = [];

      const result = await exportFiles({
        files,
        fileManager,
        deleteLocalFiles: false,
        onProgress: ({ processed }) => progressCalls.push(processed),
      });

      expect(result).to.deep.include({
        processed: 3,
        copied: 2,
        skipped: 1,
        deleted: 0,
        failed: 0,
      });
      expect(fileManager.sizeByPathSegment.get('private/c.pdf')).to.equal(6);
      expect(progressCalls.sort()).to.deep.equal([1, 2, 3]);

      expect(await exists(path.join(basePath, 'private/a.pdf'))).to.equal(true);
      expect(await exists(path.join(basePath, 'private/b.pdf'))).to.equal(true);
    });

    it('should delete local copies once their S3 copy is verified', async () => {
      await writeFile(basePath, 'private/new.pdf', 'new');
      await writeFile(basePath, 'private/old.pdf', 'old!');

      const fileManager = createFakeS3FileManager();
      fileManager.sizeByPathSegment.set('private/old.pdf', 4);

      const files = await listLocalFiles(basePath, ['private']);
      const result = await exportFiles({ files, fileManager, deleteLocalFiles: true });

      expect(result).to.deep.include({ copied: 1, skipped: 1, deleted: 2, failed: 0 });
      expect(await exists(path.join(basePath, 'private/new.pdf'))).to.equal(false);
      expect(await exists(path.join(basePath, 'private/old.pdf'))).to.equal(false);
    });

    it('should keep the local copy and report a failure when the upload fails', async () => {
      await writeFile(basePath, 'private/ok.pdf', 'ok');
      await writeFile(basePath, 'private/denied.pdf', 'denied');

      const fileManager = createFakeS3FileManager({
        failingPathSegments: ['private/denied.pdf'],
      });

      const files = await listLocalFiles(basePath, ['private']);
      const result = await exportFiles({ files, fileManager, deleteLocalFiles: true });

      expect(result).to.deep.include({ copied: 1, deleted: 1, failed: 1 });
      expect(result.failures).to.deep.equal([
        { pathSegment: 'private/denied.pdf', message: 'Access Denied' },
      ]);
      expect(await exists(path.join(basePath, 'private/denied.pdf'))).to.equal(true);
    });

    it('should keep the local copy when the S3 copy cannot be verified', async () => {
      await writeFile(basePath, 'private/a.pdf', 'aaaa');

      const fileManager = createFakeS3FileManager({ sizeOverride: 1 });

      const files = await listLocalFiles(basePath, ['private']);
      const result = await exportFiles({ files, fileManager, deleteLocalFiles: true });

      expect(result).to.deep.include({ copied: 0, deleted: 0, failed: 1 });
      expect(result.failures[0].pathSegment).to.equal('private/a.pdf');
      expect(await exists(path.join(basePath, 'private/a.pdf'))).to.equal(true);
    });
  });

  describe('#removeEmptyDirectories(dirPath)', () => {
    it('should remove empty subdirectories but keep non-empty ones and the root', async () => {
      await fs.promises.mkdir(path.join(basePath, 'private/attachments/1/thumbnails'), {
        recursive: true,
      });
      await writeFile(basePath, 'private/attachments/2/kept.pdf', 'kept');

      await removeEmptyDirectories(path.join(basePath, 'private'));

      expect(await exists(path.join(basePath, 'private'))).to.equal(true);
      expect(await exists(path.join(basePath, 'private/attachments/1'))).to.equal(false);
      expect(await exists(path.join(basePath, 'private/attachments/2/kept.pdf'))).to.equal(true);
    });

    it('should do nothing when the directory does not exist', async () => {
      await removeEmptyDirectories(path.join(basePath, 'missing'));
    });
  });
});
