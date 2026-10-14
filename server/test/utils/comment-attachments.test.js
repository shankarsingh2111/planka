const { expect } = require('chai');

const { canManageAttachment } = require('../../utils/comment-attachments');

describe('comment-attachments', () => {
  describe('canManageAttachment', () => {
    const ownComment = { id: '1', userId: '10' };
    const otherComment = { id: '2', userId: '20' };

    it('lets an editor manage any attachment', () => {
      expect(
        canManageAttachment({ isEditor: true, canComment: false, comment: null, userId: '10' }),
      ).to.equal(true);
      expect(
        canManageAttachment({
          isEditor: true,
          canComment: false,
          comment: otherComment,
          userId: '10',
        }),
      ).to.equal(true);
    });

    it('lets a commenter manage attachments on their own comment', () => {
      expect(
        canManageAttachment({
          isEditor: false,
          canComment: true,
          comment: ownComment,
          userId: '10',
        }),
      ).to.equal(true);
    });

    it("stops a commenter on someone else's comment", () => {
      expect(
        canManageAttachment({
          isEditor: false,
          canComment: true,
          comment: otherComment,
          userId: '10',
        }),
      ).to.equal(false);
    });

    it('stops a commenter on a card attachment', () => {
      expect(
        canManageAttachment({ isEditor: false, canComment: true, comment: null, userId: '10' }),
      ).to.equal(false);
    });

    it('stops a viewer who may not comment, even on their own comment', () => {
      expect(
        canManageAttachment({
          isEditor: false,
          canComment: false,
          comment: ownComment,
          userId: '10',
        }),
      ).to.equal(false);
    });
  });
});
