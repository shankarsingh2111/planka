# Comment Attachments and Formatting Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Users can attach files, images, PDFs and links to card comments and format comment text
with a toolbar. Pending attachments show in the comment box as icon + name + ✕.

**Architecture:** Comment attachments are ordinary card `Attachment` rows with a new nullable
`commentId`. The client keeps picked files in component state until Post or Save. The saga then
creates or updates the comment and uploads each attachment with `commentId`. If the user chose
Hippo, the saga posts the Hippo note last, so the note can list all attachments. Formatting is a
toolbar over the existing `react-mentions` textarea that inserts Markdown. Caret positions are
mapped between what the textarea shows (`@name`) and the stored mention markup (`@[name](id)`).

**Tech Stack:**
- Server: Sails.js (Waterline + knex migrations, PostgreSQL), mocha/chai for `test/utils`.
- Client: React 18, redux-orm, redux-saga, semantic-ui-react, react-mentions, react-dropzone,
  react-photoswipe-gallery, jest.

**Spec:** `docs/superpowers/specs/2026-10-13-comment-attachments-design.md`

## Global Constraints

- Work on branch `comment-attachments`, created from `timeline-drag-fluidity` (master lacks the Hippo work this builds on).
- Checks are light only:
  - allowed: `npm run lint` (server and client), the named unit tests, and the client build;
  - not allowed: starting servers, databases or browsers, running migrations, e2e tests.
- Before editing any existing function or component, run `gitnexus_impact({target: "<name>", direction: "upstream"})`. Report the blast radius. If it is HIGH or CRITICAL, stop and tell the user.
- Server helpers must not reference model globals (`Attachment`, `Comment`, …) at module level. Use them only inside `fn` (helpers load before models).
- No database foreign keys. New columns are a `bigInteger` plus an index (repository convention).
- Comment text max length stays `1048576`. Attachment name max is 128 (the saga truncates), and URL max is 2048.
- New UI strings go in `client/src/locales/en-US/core.js` only, sorted alphabetically inside their block. Other locales fall back to English.
- Every new source file starts with the PLANKA copyright header used in the repo:
  ```js
  /*!
   * Copyright (c) 2024 PLANKA Software GmbH
   * Licensed under the Fair Use License: https://github.com/plankanban/planka/blob/master/LICENSE.md
   */
  ```
- Lint enforces Prettier. Before each lint step, run `npx eslint --fix <changed files>` in that package, so the code snippets in this plan get formatted the repo's way.
- Commit after each task. End every commit message with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.

**Deviations from the spec, decided while planning:**
- Adding an attachment to a comment is limited to the comment's author, the same rule the comment Edit button follows. Editors keep their full card-attachment rights.
- An image attached to a comment never becomes the card cover automatically.
- The link form is an inline row inside the comment box, not a popup. A popup portal would count as a "click away", which submits Edit and closes Add.

## Review Focus

1. **A comment with @mentions, then a toolbar button.** The format must land where the caret shows, not shifted by mention markup length. Pinned by the `plainToMarkupIndex` / `markupToPlainIndex` tests in Task 5.
2. **A commenter (non-editor) acting on another person's comment, or on a card-level attachment.** Expect a 403. Pinned by the `canManageAttachment` tests in Task 2.
3. **An attachment name or URL containing `<`, `&` or `"` in a Hippo note.** It must be escaped. Pinned by the `buildNoteHtml` tests in Task 4.
4. **Selection at the very start of the text, or across several lines, for list and quote formats.** Expect the correct line prefixes and no stray characters. Pinned by the `applyFormat` tests in Task 5.
5. **Pasting plain text or a URL into the comment box.** It must stay normal text paste, with no attachment and no card-level link attachment. Only pasted files become pending attachments. Pinned by the manual test list (Task 10) and the paste handler's early return in Task 7.

---

### Task 1: Branch, migration, model fields, empty comment text

**Files:**
- Create: `server/db/migrations/20261013000000_add_comment_id_to_attachment.js`
- Modify: `server/api/models/Attachment.js` (swagger block + attributes)
- Modify: `server/api/models/Comment.js` (`text` attribute)
- Modify: `server/api/controllers/comments/create.js` (`text` input + swagger `required`)
- Modify: `server/api/controllers/comments/update.js` (`text` input)

**Interfaces:**
- Produces: the `attachment.comment_id` column; `Attachment.commentId` (Waterline association to `Comment`, column `comment_id`); and comments can now have `text: ''`.

- [ ] **Step 1: Create the branch**

```bash
cd /Users/shankar/Documents/node/planka
git checkout -b comment-attachments
```

- [ ] **Step 2: Write the migration**

`server/db/migrations/20261013000000_add_comment_id_to_attachment.js`:

```js
/*!
 * Copyright (c) 2024 PLANKA Software GmbH
 * Licensed under the Fair Use License: https://github.com/plankanban/planka/blob/master/LICENSE.md
 */

// An attachment added from a comment points at it, so the comment can show it and take it along
// when deleted. Card attachments keep it empty.
module.exports.up = (knex) =>
  knex.schema.alterTable('attachment', (table) => {
    table.bigInteger('comment_id');

    table.index('comment_id');
  });

module.exports.down = (knex) =>
  knex.schema.alterTable('attachment', (table) => {
    table.dropIndex('comment_id');
    table.dropColumn('comment_id');
  });
```

- [ ] **Step 3: Add `commentId` to the Attachment model**

In `server/api/models/Attachment.js`, after the `creatorUserId` swagger property, add:

```js
 *         commentId:
 *           type: string
 *           nullable: true
 *           description: ID of the comment the attachment was added with
 *           example: "1357158568008091267"
```

After the `creatorUserId` attribute, add:

```js
    commentId: {
      model: 'Comment',
      columnName: 'comment_id',
    },
```

- [ ] **Step 4: Allow empty comment text**

In `server/api/models/Comment.js`, replace the `text` attribute with:

```js
    text: {
      type: 'string',
      defaultsTo: '',
    },
```

In `server/api/controllers/comments/create.js`:
- Remove `- text` from the swagger `required:` list of the request body.
- Replace the `text` input with:

```js
    text: {
      type: 'string',
      maxLength: 1048576,
      defaultsTo: '',
    },
```

In `server/api/controllers/comments/update.js`, replace the `text` input with:

```js
    text: {
      type: 'string',
      maxLength: 1048576,
    },
```

- [ ] **Step 5: Lint**

Run: `cd server && npm run lint`
Expected: `✔  Your .js files look good.`

- [ ] **Step 6: Commit**

```bash
git add server/db/migrations/20261013000000_add_comment_id_to_attachment.js server/api/models/Attachment.js server/api/models/Comment.js server/api/controllers/comments/create.js server/api/controllers/comments/update.js
git commit -m "comment attachments: comment_id on attachment, comments may have empty text

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 2: Attachment create/delete with `commentId` and the commenter rule

**Files:**
- Create: `server/utils/comment-attachments.js`
- Test: `server/test/utils/comment-attachments.test.js`
- Modify: `server/api/hooks/query-methods/models/Attachment.js` (add `getByCommentId`)
- Modify: `server/api/controllers/attachments/create.js`
- Modify: `server/api/controllers/attachments/delete.js`
- Modify: `server/api/helpers/attachments/create-one.js`

**Interfaces:**
- Consumes: `Attachment.commentId` (Task 1).
- Produces:
  - `canManageAttachment({ isEditor, canComment, comment, userId }) → boolean`.
  - `Attachment.qm.getByCommentId(commentId) → Promise<Attachment[]>`.
  - `POST /cards/:cardId/attachments` accepts optional `commentId`.
  - `attachments.createOne` accepts `values.comment`.

- [ ] **Step 1: Write the failing test**

`server/test/utils/comment-attachments.test.js`:

```js
const { expect } = require('chai');

const { canManageAttachment } = require('../../utils/comment-attachments');

describe('comment-attachments', () => {
  describe('canManageAttachment', () => {
    const ownComment = { id: '1', userId: '10' };
    const otherComment = { id: '2', userId: '20' };

    it('lets an editor manage any attachment', () => {
      expect(canManageAttachment({ isEditor: true, canComment: false, comment: null, userId: '10' })).to.equal(true);
      expect(
        canManageAttachment({ isEditor: true, canComment: false, comment: otherComment, userId: '10' }),
      ).to.equal(true);
    });

    it('lets a commenter manage attachments on their own comment', () => {
      expect(
        canManageAttachment({ isEditor: false, canComment: true, comment: ownComment, userId: '10' }),
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
      expect(canManageAttachment({ isEditor: false, canComment: true, comment: null, userId: '10' })).to.equal(false);
    });

    it('stops a viewer who may not comment, even on their own comment', () => {
      expect(
        canManageAttachment({ isEditor: false, canComment: false, comment: ownComment, userId: '10' }),
      ).to.equal(false);
    });
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd server && npx mocha test/utils/comment-attachments.test.js`
Expected: FAIL, `Cannot find module '../../utils/comment-attachments'`.

- [ ] **Step 3: Write the util**

`server/utils/comment-attachments.js`:

```js
/*!
 * Copyright (c) 2024 PLANKA Software GmbH
 * Licensed under the Fair Use License: https://github.com/plankanban/planka/blob/master/LICENSE.md
 */

// Editors manage every attachment. A member who may only comment manages the attachments of their
// own comments, and nothing on the card itself.
const canManageAttachment = ({ isEditor, canComment, comment, userId }) => {
  if (isEditor) {
    return true;
  }

  return !!comment && !!canComment && comment.userId === userId;
};

module.exports = {
  canManageAttachment,
};
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `cd server && npx mocha test/utils/comment-attachments.test.js`
Expected: 5 passing.

- [ ] **Step 5: Add `getByCommentId` to the query methods**

In `server/api/hooks/query-methods/models/Attachment.js`, after `getByCardIds`, add:

```js
const getByCommentId = (commentId) =>
  defaultFind({
    commentId,
  });
```

Then add `getByCommentId,` to `module.exports` after `getByCardIds,`.

- [ ] **Step 6: Accept `commentId` in `attachments/create`**

Run impact on the `create` attachments controller and on `createOne` (attachments) first.

In `server/api/controllers/attachments/create.js`:

Add a require under the existing ones:

```js
const { canManageAttachment } = require('../../../utils/comment-attachments');
```

Add the error to `Errors`:

```js
  COMMENT_NOT_FOUND: {
    commentNotFound: 'Comment not found',
  },
```

Add the input after `name`:

```js
    commentId: idInput,
```

Add the exit after `cardNotFound`:

```js
    commentNotFound: {
      responseType: 'notFound',
    },
```

In the swagger request-body properties (both the JSON and the multipart schema, next to `name`), add:

```js
 *               commentId:
 *                 type: string
 *                 description: ID of a comment on this card to add the attachment to
 *                 example: "1357158568008091267"
```

Replace this block:

```js
    if (boardMembership.role !== BoardMembership.Roles.EDITOR) {
      throw Errors.NOT_ENOUGH_RIGHTS;
    }
```

with:

```js
    let comment = null;
    if (inputs.commentId) {
      comment = await Comment.qm.getOneById(inputs.commentId);

      if (!comment || comment.cardId !== card.id) {
        throw Errors.COMMENT_NOT_FOUND;
      }
    }

    const canManage = canManageAttachment({
      isEditor: boardMembership.role === BoardMembership.Roles.EDITOR,
      canComment: boardMembership.canComment,
      comment,
      userId: currentUser.id,
    });

    if (!canManage) {
      throw Errors.NOT_ENOUGH_RIGHTS;
    }
```

In the `sails.helpers.attachments.createOne.with({...})` call, change `values` to:

```js
      values: {
        ...values,
        card,
        comment,
        creatorUser: currentUser,
      },
```

- [ ] **Step 7: Store `commentId`, and keep comment images off the cover**

In `server/api/helpers/attachments/create-one.js`, replace the `Attachment.qm.createOne` call with:

```js
    const attachment = await Attachment.qm.createOne({
      ...values,
      cardId: values.card.id,
      commentId: values.comment ? values.comment.id : null,
      creatorUserId: values.creatorUser.id,
    });
```

Replace `if (!values.card.coverAttachmentId) {` with:

```js
    // An image added with a comment stays in the comment and never becomes the cover on its own
    if (!values.card.coverAttachmentId && !values.comment) {
```

- [ ] **Step 8: Let commenters delete attachments on their own comments**

In `server/api/controllers/attachments/delete.js`, add the require:

```js
const { canManageAttachment } = require('../../../utils/comment-attachments');
```

Replace:

```js
    if (boardMembership.role !== BoardMembership.Roles.EDITOR) {
      throw Errors.NOT_ENOUGH_RIGHTS;
    }
```

with:

```js
    const comment = attachment.commentId
      ? await Comment.qm.getOneById(attachment.commentId)
      : null;

    const canManage = canManageAttachment({
      isEditor: boardMembership.role === BoardMembership.Roles.EDITOR,
      canComment: boardMembership.canComment,
      comment,
      userId: currentUser.id,
    });

    if (!canManage) {
      throw Errors.NOT_ENOUGH_RIGHTS;
    }
```

Update the swagger description of the delete endpoint, which says "Requires board editor permissions", to:
`Requires board editor permissions, or comment permission for an attachment on your own comment.`

- [ ] **Step 9: Lint and run the unit test**

Run: `cd server && npm run lint && npx mocha test/utils/comment-attachments.test.js`
Expected: the lint passes and 5 tests pass.

- [ ] **Step 10: Commit**

```bash
git add server/utils/comment-attachments.js server/test/utils/comment-attachments.test.js server/api/hooks/query-methods/models/Attachment.js server/api/controllers/attachments/create.js server/api/controllers/attachments/delete.js server/api/helpers/attachments/create-one.js
git commit -m "comment attachments: attach to a comment; commenters manage their own

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 3: Deleting a comment deletes its attachments

**Files:**
- Modify: `server/api/helpers/comments/delete-one.js`

**Interfaces:**
- Consumes: `Attachment.qm.getByCommentId` (Task 2); `sails.helpers.attachments.deleteOne.with({ record, project, board, list, card, actorUser, request })` (existing).

- [ ] **Step 1: Run impact on the `deleteOne` comments helper**

- [ ] **Step 2: Delete the attachments first**

In `server/api/helpers/comments/delete-one.js`, at the start of `async fn(inputs) {`, before `const comment = await Comment.qm.deleteOne(inputs.record.id);`, insert:

```js
    // The comment's attachments go with it, each through the usual path so its file is cleaned
    // up and open boards and webhooks hear about it
    const attachments = await Attachment.qm.getByCommentId(inputs.record.id);

    // eslint-disable-next-line no-restricted-syntax
    for (const attachment of attachments) {
      // eslint-disable-next-line no-await-in-loop
      await sails.helpers.attachments.deleteOne.with({
        record: attachment,
        project: inputs.project,
        board: inputs.board,
        list: inputs.list,
        card: inputs.card,
        actorUser: inputs.actorUser,
        request: inputs.request,
      });
    }
```

- [ ] **Step 3: Lint**

Run: `cd server && npm run lint`
Expected: it passes.

- [ ] **Step 4: Commit**

```bash
git add server/api/helpers/comments/delete-one.js
git commit -m "comment attachments: deleting a comment deletes its attachments

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 4: The Hippo note lists the comment's attachments

**Files:**
- Modify: `server/utils/hippo.js` (`buildNoteHtml`)
- Test: `server/test/utils/hippo.test.js` (the `describe('buildNoteHtml')` block)
- Modify: `server/api/controllers/hippo/sync-note.js` (Step 3)

**Interfaces:**
- Consumes: `Attachment.qm.getByCommentId` (Task 2); `sails.helpers.attachments.presentOne(record).data.url` (existing; gives the file download URL or the link URL).
- Produces: `buildNoteHtml(authorName, text, links = [])`, where `links` is `[{ name, url }]`.

- [ ] **Step 1: Write the failing tests**

In `server/test/utils/hippo.test.js`, inside `describe('buildNoteHtml', () => {`, after the last `it`, add:

```js
    it('lists attachments as links after the text', () => {
      expect(
        buildNoteHtml('Divya', 'See files', [
          { name: 'log.txt', url: 'https://planka.example/attachments/1/download/log.txt' },
          { name: 'Docs', url: 'https://docs.example/page' },
        ]),
      ).to.equal(
        '<p>Divya (via Planka): See files</p>' +
          '<p>Attachments:<br>' +
          '<a href="https://planka.example/attachments/1/download/log.txt">log.txt</a><br>' +
          '<a href="https://docs.example/page">Docs</a></p>',
      );
    });

    it('escapes attachment names and urls', () => {
      expect(
        buildNoteHtml('Divya', '', [{ name: 'a <b> & "c"', url: 'https://x.example/?q="1"&r=2' }]),
      ).to.equal(
        '<p>Divya (via Planka): </p>' +
          '<p>Attachments:<br>' +
          '<a href="https://x.example/?q=&quot;1&quot;&amp;r=2">a &lt;b&gt; &amp; &quot;c&quot;</a></p>',
      );
    });

    it('adds nothing when there are no attachments', () => {
      expect(buildNoteHtml('Divya', 'Hi', [])).to.equal('<p>Divya (via Planka): Hi</p>');
    });
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `cd server && npx mocha test/utils/hippo.test.js`
Expected: FAIL on "lists attachments as links after the text" and "escapes attachment names and urls".

- [ ] **Step 3: Implement**

In `server/utils/hippo.js`, replace `buildNoteHtml` with:

```js
// Attachments follow the text as links: files by their Planka download address, links as they are
const buildNoteHtml = (authorName, text, links = []) => {
  const body = escapeHtml(text.trim()).replace(/\r?\n/g, '<br>');
  const note = `<p>${escapeHtml(authorName)} (via Planka): ${body}</p>`;

  if (links.length === 0) {
    return note;
  }

  const items = links
    .map(({ name, url }) => `<a href="${escapeHtml(url)}">${escapeHtml(name)}</a>`)
    .join('<br>');

  return `${note}<p>Attachments:<br>${items}</p>`;
};
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `cd server && npx mocha test/utils/hippo.test.js`
Expected: all pass.

- [ ] **Step 5: Pass the links from `sync-note`**

Run impact on `buildNoteHtml` first (its only callers are `sync-note.js` and the test).

In `server/api/controllers/hippo/sync-note.js`, Step 3, replace:

```js
    // ---- Step 3: Post the comment as a note, led by its author ----
    const author =
      comment.userId === currentUser.id ? currentUser : await User.qm.getOneById(comment.userId);
```

with:

```js
    // ---- Step 3: Post the comment as a note, led by its author and followed by its attachments ----
    const author =
      comment.userId === currentUser.id ? currentUser : await User.qm.getOneById(comment.userId);

    const attachments = await Attachment.qm.getByCommentId(comment.id);

    const attachmentLinks = attachments.map((attachment) => ({
      name: attachment.name,
      url: sails.helpers.attachments.presentOne(attachment).data.url,
    }));
```

and change the `buildNoteHtml(` call to:

```js
        note: buildNoteHtml(
          author ? author.name : 'Unknown user',
          mentionMarkupToText(comment.text),
          attachmentLinks,
        ),
```

- [ ] **Step 6: Lint**

Run: `cd server && npm run lint`
Expected: it passes.

- [ ] **Step 7: Commit**

```bash
git add server/utils/hippo.js server/test/utils/hippo.test.js server/api/controllers/hippo/sync-note.js
git commit -m "comment attachments: Hippo note lists the comment's attachments

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 5: Client formatting and caret-mapping utils (TDD)

**Files:**
- Create: `client/src/utils/markdown-format.js`
- Test: `client/src/utils/markdown-format.test.js`
- Modify: `client/src/utils/mentions.js` (add two exports)
- Test: `client/src/utils/mentions.test.js` (new)

**Interfaces:**
- Produces:
  - `MarkdownFormats` (enum of format names).
  - `FORMAT_BY_SHORTCUT_KEY` (`{ b: 'bold', i: 'italic' }`).
  - `applyFormat(text, start, end, format) → { text, selectionStart, selectionEnd }`.
  - `plainToMarkupIndex(markup, plainIndex) → number`.
  - `markupToPlainIndex(markup, markupIndex) → number`.

- [ ] **Step 1: Write the failing tests**

`client/src/utils/markdown-format.test.js`:

```js
import { applyFormat, MarkdownFormats } from './markdown-format';

describe('applyFormat', () => {
  test('wraps a selection in bold and keeps it selected', () => {
    expect(applyFormat('say hi now', 4, 6, MarkdownFormats.BOLD)).toEqual({
      text: 'say **hi** now',
      selectionStart: 6,
      selectionEnd: 8,
    });
  });

  test('puts the caret between markers when nothing is selected', () => {
    expect(applyFormat('ab', 1, 1, MarkdownFormats.ITALIC)).toEqual({
      text: 'a__b',
      selectionStart: 2,
      selectionEnd: 2,
    });
  });

  test('wraps strikethrough and inline code', () => {
    expect(applyFormat('x', 0, 1, MarkdownFormats.STRIKETHROUGH).text).toBe('~~x~~');
    expect(applyFormat('x', 0, 1, MarkdownFormats.CODE).text).toBe('`x`');
  });

  test('prefixes every selected line of a bulleted list', () => {
    expect(applyFormat('one\ntwo\nthree', 1, 6, MarkdownFormats.BULLETED_LIST)).toEqual({
      text: '- one\n- two\nthree',
      selectionStart: 3,
      selectionEnd: 10,
    });
  });

  test('numbers the selected lines', () => {
    expect(applyFormat('a\nb', 0, 3, MarkdownFormats.NUMBERED_LIST).text).toBe('1. a\n2. b');
  });

  test('quotes the line the caret is on, at the very start of the text', () => {
    expect(applyFormat('\nnext', 0, 0, MarkdownFormats.QUOTE)).toEqual({
      text: '> \nnext',
      selectionStart: 2,
      selectionEnd: 2,
    });
  });

  test('puts a code block on its own lines', () => {
    expect(applyFormat('see x now', 4, 5, MarkdownFormats.CODE_BLOCK).text).toBe(
      'see \n```\nx\n```\n now',
    );
    expect(applyFormat('x', 0, 1, MarkdownFormats.CODE_BLOCK).text).toBe('```\nx\n```');
  });

  test('turns a selection into a link and selects the address', () => {
    expect(applyFormat('docs', 0, 4, MarkdownFormats.LINK)).toEqual({
      text: '[docs](https://)',
      selectionStart: 7,
      selectionEnd: 15,
    });
  });

  test('leaves the caret inside the brackets of an empty link', () => {
    expect(applyFormat('', 0, 0, MarkdownFormats.LINK)).toEqual({
      text: '[](https://)',
      selectionStart: 1,
      selectionEnd: 1,
    });
  });
});
```

`client/src/utils/mentions.test.js`:

```js
import { markupToPlainIndex, plainToMarkupIndex } from './mentions';

// Shown as "hi @ann and @bob!" (17 chars)
const MARKUP = 'hi @[ann](1) and @[bob](22)!';

describe('plainToMarkupIndex', () => {
  test('is unchanged before any mention', () => {
    expect(plainToMarkupIndex(MARKUP, 2)).toBe(2);
  });

  test('lands on the start of a mention', () => {
    expect(plainToMarkupIndex(MARKUP, 3)).toBe(3);
  });

  test('snaps a position inside a mention to its end', () => {
    expect(plainToMarkupIndex(MARKUP, 5)).toBe(12);
    expect(plainToMarkupIndex(MARKUP, 7)).toBe(12);
  });

  test('skips the markup of earlier mentions', () => {
    // plain "hi @ann a" -> 9
    expect(plainToMarkupIndex(MARKUP, 9)).toBe(14);
    // the "!" at plain 16
    expect(plainToMarkupIndex(MARKUP, 16)).toBe(27);
    expect(plainToMarkupIndex(MARKUP, 17)).toBe(28);
  });

  test('works with no mentions', () => {
    expect(plainToMarkupIndex('plain', 3)).toBe(3);
  });
});

describe('markupToPlainIndex', () => {
  test('maps back at mention boundaries', () => {
    expect(markupToPlainIndex(MARKUP, 3)).toBe(3);
    expect(markupToPlainIndex(MARKUP, 12)).toBe(7);
    expect(markupToPlainIndex(MARKUP, 28)).toBe(17);
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `cd client && npx jest src/utils/markdown-format.test.js src/utils/mentions.test.js`
Expected: FAIL. Either `Cannot find module './markdown-format'`, or `plainToMarkupIndex is not a function`.

- [ ] **Step 3: Implement `markdown-format.js`**

`client/src/utils/markdown-format.js`:

```js
/*!
 * Copyright (c) 2024 PLANKA Software GmbH
 * Licensed under the Fair Use License: https://github.com/plankanban/planka/blob/master/LICENSE.md
 */

export const MarkdownFormats = {
  BOLD: 'bold',
  ITALIC: 'italic',
  STRIKETHROUGH: 'strikethrough',
  CODE: 'code',
  CODE_BLOCK: 'codeBlock',
  BULLETED_LIST: 'bulletedList',
  NUMBERED_LIST: 'numberedList',
  QUOTE: 'quote',
  LINK: 'link',
};

// With Ctrl (Cmd on Mac) held
export const FORMAT_BY_SHORTCUT_KEY = {
  b: MarkdownFormats.BOLD,
  i: MarkdownFormats.ITALIC,
};

const MARKER_BY_INLINE_FORMAT = {
  [MarkdownFormats.BOLD]: '**',
  [MarkdownFormats.ITALIC]: '_',
  [MarkdownFormats.STRIKETHROUGH]: '~~',
  [MarkdownFormats.CODE]: '`',
};

const LINK_URL = 'https://';

const wrap = (text, start, end, before, after) => ({
  text: text.slice(0, start) + before + text.slice(start, end) + after + text.slice(end),
  selectionStart: start + before.length,
  selectionEnd: end + before.length,
});

// Every line the selection touches gets a prefix. All inserted text lies before the selection end,
// so the end moves by the total inserted.
const prefixLines = (text, start, end, getPrefix) => {
  const blockStart = start === 0 ? 0 : text.lastIndexOf('\n', start - 1) + 1;
  let blockEnd = text.indexOf('\n', end);

  if (blockEnd === -1) {
    blockEnd = text.length;
  }

  const lines = text.slice(blockStart, blockEnd).split('\n');
  const prefixes = lines.map((_, index) => getPrefix(index));
  const block = lines.map((line, index) => prefixes[index] + line).join('\n');
  const insertedTotal = prefixes.reduce((total, prefix) => total + prefix.length, 0);

  return {
    text: text.slice(0, blockStart) + block + text.slice(blockEnd),
    selectionStart: start + prefixes[0].length,
    selectionEnd: start === end ? start + prefixes[0].length : end + insertedTotal,
  };
};

export const applyFormat = (text, start, end, format) => {
  const marker = MARKER_BY_INLINE_FORMAT[format];

  if (marker) {
    return wrap(text, start, end, marker, marker);
  }

  switch (format) {
    case MarkdownFormats.BULLETED_LIST:
      return prefixLines(text, start, end, () => '- ');
    case MarkdownFormats.NUMBERED_LIST:
      return prefixLines(text, start, end, (index) => `${index + 1}. `);
    case MarkdownFormats.QUOTE:
      return prefixLines(text, start, end, () => '> ');
    case MarkdownFormats.CODE_BLOCK: {
      const before = start > 0 && text[start - 1] !== '\n' ? '\n```\n' : '```\n';
      const after = end < text.length && text[end] !== '\n' ? '\n```\n' : '\n```';

      return wrap(text, start, end, before, after);
    }
    case MarkdownFormats.LINK: {
      const result = wrap(text, start, end, '[', `](${LINK_URL})`);

      if (start === end) {
        return result;
      }

      const urlStart = result.selectionEnd + 2;

      return {
        text: result.text,
        selectionStart: urlStart,
        selectionEnd: urlStart + LINK_URL.length,
      };
    }
    default:
      return {
        text,
        selectionStart: start,
        selectionEnd: end,
      };
  }
};
```

- [ ] **Step 4: Implement the mention index mapping**

In `client/src/utils/mentions.js`, append:

```js
// The input shows "@name" where the text holds "@[name](id)", so a caret position in one is not
// the same in the other. A position inside a mention snaps to its end.
export const plainToMarkupIndex = (markup, plainIndex) => {
  const matches = [...markup.matchAll(MENTION_MARKUP_REGEX)];

  let plainPosition = 0;
  let markupPosition = 0;

  for (let index = 0; index < matches.length; index += 1) {
    const match = matches[index];
    const gap = match.index - markupPosition;

    if (plainIndex <= plainPosition + gap) {
      break;
    }

    plainPosition += gap;
    markupPosition = match.index;

    const plainLength = match[1].length + 1;

    if (plainIndex <= plainPosition + plainLength) {
      return markupPosition + match[0].length;
    }

    plainPosition += plainLength;
    markupPosition += match[0].length;
  }

  return markupPosition + (plainIndex - plainPosition);
};

// Only meant for positions outside mention markup, which is all the formatting toolbar produces
export const markupToPlainIndex = (markup, markupIndex) =>
  mentionMarkupToText(markup.slice(0, markupIndex)).length;
```

- [ ] **Step 5: Run the tests to verify they pass**

Run: `cd client && npx jest src/utils/markdown-format.test.js src/utils/mentions.test.js`
Expected: all pass.

- [ ] **Step 6: Commit**

```bash
git add client/src/utils/markdown-format.js client/src/utils/markdown-format.test.js client/src/utils/mentions.js client/src/utils/mentions.test.js
git commit -m "comment formatting: markdown insertion and mention-aware caret mapping

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 6: Client data layer (model, selector, entry actions, sagas)

**Files:**
- Modify: `client/src/models/Attachment.js`
- Modify: `client/src/selectors/attachments.js`
- Modify: `client/src/entry-actions/comments.js`
- Modify: `client/src/sagas/core/watchers/comments.js`
- Modify: `client/src/sagas/core/services/comments.js`

**Interfaces:**
- Consumes: the server accepts `commentId` (Task 2).
- Produces:
  - The `Attachment.commentId` fk, with `relatedName: 'attachments'` on `Comment`.
  - `selectors.makeSelectAttachmentsByCommentId() → (state, commentId) → Array<attachment & { isPersisted }>`, with images first.
  - `entryActions.createCommentInCurrentCard(data, { syncToHippo, attachments })`.
  - `entryActions.updateComment(id, data | null, { addAttachments, removeAttachmentIds })`.
  - An attachment payload item is `{ type: 'file', file, name }` or `{ type: 'link', url, name }`.

- [ ] **Step 1: Run impact on `createComment`, `updateComment` (the sagas and entry actions) and the Attachment model**

- [ ] **Step 2: Model**

In `client/src/models/Attachment.js`, after the `creatorUserId` field, add:

```js
    commentId: fk({
      to: 'Comment',
      as: 'comment',
      relatedName: 'attachments',
    }),
```

In the reducer `switch`, before `default:`, add:

```js
      // A deleted comment takes its attachments along
      case ActionTypes.COMMENT_DELETE:
        Attachment.filter({
          commentId: payload.id,
        }).delete();

        break;
      case ActionTypes.COMMENT_DELETE__SUCCESS:
      case ActionTypes.COMMENT_DELETE_HANDLE:
        Attachment.filter({
          commentId: payload.comment.id,
        }).delete();

        break;
```

- [ ] **Step 3: Selector**

In `client/src/selectors/attachments.js`, add `import sortBy from 'lodash/sortBy';` at the top. Before `export default`, add:

```js
// Images first, so their thumbnails sit together above the file and link chips
export const makeSelectAttachmentsByCommentId = () =>
  createSelector(
    orm,
    (_, commentId) => commentId,
    ({ Comment }, commentId) => {
      const commentModel = Comment.withId(commentId);

      if (!commentModel) {
        return [];
      }

      const attachments = commentModel.attachments.toRefArray().map((attachment) => ({
        ...attachment,
        isPersisted: !isLocalId(attachment.id),
      }));

      return sortBy(attachments, (attachment) => !(attachment.data && attachment.data.image));
    },
  );
```

Add `makeSelectAttachmentsByCommentId,` to the default export object.

- [ ] **Step 4: Entry actions**

In `client/src/entry-actions/comments.js`, replace `createCommentInCurrentCard` and `updateComment` with:

```js
const createCommentInCurrentCard = (data, { syncToHippo = false, attachments = [] } = {}) => ({
  type: EntryActionTypes.COMMENT_IN_CURRENT_CARD_CREATE,
  payload: {
    data,
    syncToHippo,
    attachments,
  },
});
```

```js
// data is null when only the attachments change
const updateComment = (id, data, { addAttachments = [], removeAttachmentIds = [] } = {}) => ({
  type: EntryActionTypes.COMMENT_UPDATE,
  payload: {
    id,
    data,
    addAttachments,
    removeAttachmentIds,
  },
});
```

- [ ] **Step 5: Watchers**

In `client/src/sagas/core/watchers/comments.js`, replace the create and update watchers with:

```js
    takeEvery(
      EntryActionTypes.COMMENT_IN_CURRENT_CARD_CREATE,
      ({ payload: { data, syncToHippo, attachments } }) =>
        services.createCommentInCurrentCard(data, { syncToHippo, attachments }),
    ),
```

```js
    takeEvery(
      EntryActionTypes.COMMENT_UPDATE,
      ({ payload: { id, data, addAttachments, removeAttachmentIds } }) =>
        services.updateComment(id, data, { addAttachments, removeAttachmentIds }),
    ),
```

- [ ] **Step 6: Services**

In `client/src/sagas/core/services/comments.js`, add the import:

```js
import { createAttachment, deleteAttachment } from './attachments';
```

Replace the comment above `createComment`, and its signature, with:

```js
// Returns the comment the server created, or null when it refused. Its attachments go up once it
// exists, one at a time. On a ticket card the user may also have chosen to post it to Hippo, which
// happens last so the note can list them.
export function* createComment(cardId, data, { syncToHippo = false, attachments = [] } = {}) {
```

Between `yield put(actions.createComment.success(localId, comment));` and `if (syncToHippo) {`, insert:

```js
  for (let index = 0; index < attachments.length; index += 1) {
    yield call(createAttachment, cardId, {
      ...attachments[index],
      commentId: comment.id,
    });
  }
```

Replace `updateComment` with:

```js
export function* updateComment(id, data, { addAttachments = [], removeAttachmentIds = [] } = {}) {
  if (data) {
    yield put(actions.updateComment(id, data));

    let comment;
    try {
      ({ item: comment } = yield call(request, api.updateComment, id, data));
    } catch (error) {
      yield put(actions.updateComment.failure(id, error));
      return;
    }

    yield put(actions.updateComment.success(comment));
  }

  for (let index = 0; index < removeAttachmentIds.length; index += 1) {
    yield call(deleteAttachment, removeAttachmentIds[index]);
  }

  if (addAttachments.length > 0) {
    const { cardId } = yield select(selectors.selectCommentById, id);

    for (let index = 0; index < addAttachments.length; index += 1) {
      yield call(createAttachment, cardId, {
        ...addAttachments[index],
        commentId: id,
      });
    }
  }
}
```

- [ ] **Step 7: Lint**

Run: `cd client && npm run lint`
Expected: it passes.

- [ ] **Step 8: Commit**

```bash
git add client/src/models/Attachment.js client/src/selectors/attachments.js client/src/entry-actions/comments.js client/src/sagas/core/watchers/comments.js client/src/sagas/core/services/comments.js
git commit -m "comment attachments: client model, selector and sagas

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 7: Composer building blocks (toolbar, chips, pending list, paste and drop)

**Files:**
- Create: `client/src/components/attachments/AttachmentChip/AttachmentChip.jsx`
- Create: `client/src/components/attachments/AttachmentChip/AttachmentChip.module.scss`
- Create: `client/src/components/attachments/AttachmentChip/index.js`
- Create: `client/src/components/comments/CommentComposer/FormattingToolbar.jsx`
- Create: `client/src/components/comments/CommentComposer/FormattingToolbar.module.scss`
- Create: `client/src/components/comments/CommentComposer/ComposerAttachments.jsx`
- Create: `client/src/components/comments/CommentComposer/ComposerAttachments.module.scss`
- Create: `client/src/components/comments/CommentComposer/use-pending-attachments.js`
- Create: `client/src/components/comments/CommentComposer/use-markdown-formatting.js`
- Create: `client/src/components/comments/CommentComposer/use-attachment-drop-target.js`
- Create: `client/src/components/comments/CommentComposer/index.js`
- Create: `client/src/contexts/AttachmentDropContext.js`
- Modify: `client/src/contexts/index.js`
- Modify: `client/src/components/cards/CardModal/AddAttachmentZone/AddAttachmentZone.jsx`
- Modify: `client/src/locales/en-US/core.js`

**Interfaces:**
- Consumes: `applyFormat`, `FORMAT_BY_SHORTCUT_KEY`, `MarkdownFormats`, `plainToMarkupIndex`, `markupToPlainIndex` (Task 5).
- Produces:
  - `AttachmentChip` props: `{ kind: 'image'|'pdf'|'file'|'link', name, previewUrl?, isSubmitting?, isMarked?, onClick?, onRemove? }`. It forwards a ref to its root.
  - `getAttachmentKind({ type, mimeType, isImage })` → kind.
  - `getStoredAttachmentChipProps(attachment)` → `{ kind, name, previewUrl }`.
  - `FormattingToolbar` props: `{ onFormat(format) }`.
  - `ComposerAttachments` props: `{ items: [{ key, kind, name, previewUrl?, isMarked? }], onFilesAdd(files), onLinkAdd({ url, name }), onRemove(key) }`.
  - `usePendingAttachments()` returns `{ items, addFiles(files), addLink({ url, name }), remove(localId), clear(), toData(), handlePaste(event) }`. Each item is `{ localId, type, file?, url?, name, kind, previewUrl }`.
  - `useMarkdownFormatting(inputRef, text, onTextChange)` returns `applyFormat(format)`.
  - `useAttachmentDropTarget(elementRef, onFiles)`.
  - `AttachmentDropContext` value: `registerDropTarget(elementRef, onFiles) → unregister`.

- [ ] **Step 1: Add the i18n keys**

In `client/src/locales/en-US/core.js`, add to `common:`, each in its alphabetical place:

```js
      areYouSureYouWantToDeleteThisCommentAndItsAttachments:
        'Are you sure you want to delete this comment? Its attachments will be deleted too.',
      attachedToComment: 'Attached to a comment',
      formatBold: 'Bold',
      formatBulletedList: 'Bulleted list',
      formatCode: 'Code',
      formatCodeBlock: 'Code block',
      formatItalic: 'Italic',
      formatLink: 'Link',
      formatNumberedList: 'Numbered list',
      formatQuote: 'Quote',
      formatStrikethrough: 'Strikethrough',
      linkNameOptional: 'Name (optional)',
```

Add to `action:`, each in its alphabetical place:

```js
      addLink: 'Add link',
      attachFile: 'Attach file',
      removeAttachment: 'Remove attachment',
```

First grep for each key (`grep -n "addLink:\|attachFile:\|removeAttachment:" client/src/locales/en-US/core.js`). If one already exists, reuse it instead of adding a duplicate.

- [ ] **Step 2: AttachmentChip**

`client/src/components/attachments/AttachmentChip/AttachmentChip.jsx`:

```jsx
/*!
 * Copyright (c) 2024 PLANKA Software GmbH
 * Licensed under the Fair Use License: https://github.com/plankanban/planka/blob/master/LICENSE.md
 */

import React, { useCallback } from 'react';
import PropTypes from 'prop-types';
import classNames from 'classnames';
import { useTranslation } from 'react-i18next';
import { Icon, Loader } from 'semantic-ui-react';

import { AttachmentTypes } from '../../../constants/Enums';

import styles from './AttachmentChip.module.scss';

export const AttachmentKinds = {
  IMAGE: 'image',
  PDF: 'pdf',
  FILE: 'file',
  LINK: 'link',
};

const ICON_BY_KIND = {
  [AttachmentKinds.IMAGE]: 'file image outline',
  [AttachmentKinds.PDF]: 'file pdf outline',
  [AttachmentKinds.FILE]: 'file outline',
  [AttachmentKinds.LINK]: 'linkify',
};

export const getAttachmentKind = ({ type, mimeType, isImage }) => {
  if (type === AttachmentTypes.LINK) {
    return AttachmentKinds.LINK;
  }

  if (isImage) {
    return AttachmentKinds.IMAGE;
  }

  return mimeType === 'application/pdf' ? AttachmentKinds.PDF : AttachmentKinds.FILE;
};

// For an attachment from the store; one still uploading has no data yet
export const getStoredAttachmentChipProps = (attachment) => ({
  kind: getAttachmentKind({
    type: attachment.type,
    mimeType: attachment.data && attachment.data.mimeType,
    isImage: !!(attachment.data && attachment.data.image),
  }),
  name: attachment.name,
  previewUrl:
    attachment.data && attachment.data.thumbnailUrls
      ? attachment.data.thumbnailUrls.outside360
      : undefined,
});

const AttachmentChip = React.forwardRef(
  ({ kind, name, previewUrl, isSubmitting, isMarked, onClick, onRemove }, ref) => {
    const [t] = useTranslation();

    const handleRemoveClick = useCallback(
      (event) => {
        event.stopPropagation();
        onRemove();
      },
      [onRemove],
    );

    const Wrapper = onClick ? 'button' : 'span';

    return (
      <Wrapper
        ref={ref}
        type={onClick ? 'button' : undefined}
        title={name}
        className={classNames(styles.wrapper, isMarked && styles.wrapperMarked)}
        onClick={onClick}
      >
        {previewUrl ? (
          <img src={previewUrl} alt="" className={styles.preview} />
        ) : (
          <Icon name={ICON_BY_KIND[kind]} className={styles.icon} />
        )}
        <span className={styles.name}>{name}</span>
        {isSubmitting && <Loader active inline size="mini" className={styles.loader} />}
        {onRemove && (
          <span
            role="button"
            tabIndex={0}
            title={t('action.removeAttachment')}
            className={styles.remove}
            onClick={handleRemoveClick}
            onKeyDown={(event) => event.key === 'Enter' && handleRemoveClick(event)}
          >
            <Icon fitted name={isMarked ? 'undo' : 'close'} size="small" />
          </span>
        )}
      </Wrapper>
    );
  },
);

AttachmentChip.propTypes = {
  kind: PropTypes.oneOf(Object.values(AttachmentKinds)).isRequired,
  name: PropTypes.string.isRequired,
  previewUrl: PropTypes.string,
  isSubmitting: PropTypes.bool,
  isMarked: PropTypes.bool,
  onClick: PropTypes.func,
  onRemove: PropTypes.func,
};

AttachmentChip.defaultProps = {
  previewUrl: undefined,
  isSubmitting: false,
  isMarked: false,
  onClick: undefined,
  onRemove: undefined,
};

export default React.memo(AttachmentChip);
```

`client/src/components/attachments/AttachmentChip/AttachmentChip.module.scss`:

```scss
/*!
 * Copyright (c) 2024 PLANKA Software GmbH
 * Licensed under the Fair Use License: https://github.com/plankanban/planka/blob/master/LICENSE.md
 */

:global(#app) {
  .icon {
    color: #6b808c;
    margin: 0;
  }

  .loader {
    margin-left: 2px;
  }

  .name {
    color: #17394d;
    max-width: 160px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .preview {
    border-radius: 2px;
    height: 20px;
    object-fit: cover;
    width: 20px;
  }

  .remove {
    border-radius: 3px;
    color: #6b808c;
    cursor: pointer;
    line-height: 1;
    padding: 2px;

    &:hover {
      background: rgba(9, 30, 66, 0.08);
      color: #17394d;
    }
  }

  .wrapper {
    align-items: center;
    background: rgba(9, 30, 66, 0.04);
    border: 1px solid rgba(9, 30, 66, 0.13);
    border-radius: 3px;
    display: inline-flex;
    font-size: 12px;
    gap: 6px;
    line-height: 20px;
    max-width: 100%;
    padding: 2px 6px;
    text-align: left;
  }

  button.wrapper {
    cursor: pointer;

    &:hover {
      background: rgba(9, 30, 66, 0.08);
    }
  }

  .wrapperMarked {
    opacity: 0.5;
    text-decoration: line-through;
  }
}
```

`client/src/components/attachments/AttachmentChip/index.js`:

```js
/*!
 * Copyright (c) 2024 PLANKA Software GmbH
 * Licensed under the Fair Use License: https://github.com/plankanban/planka/blob/master/LICENSE.md
 */

import AttachmentChip, {
  AttachmentKinds,
  getAttachmentKind,
  getStoredAttachmentChipProps,
} from './AttachmentChip';

export { AttachmentKinds, getAttachmentKind, getStoredAttachmentChipProps };

export default AttachmentChip;
```

- [ ] **Step 3: Pending-attachments hook**

`client/src/components/comments/CommentComposer/use-pending-attachments.js`:

```js
/*!
 * Copyright (c) 2024 PLANKA Software GmbH
 * Licensed under the Fair Use License: https://github.com/plankanban/planka/blob/master/LICENSE.md
 */

import { useCallback, useEffect, useRef, useState } from 'react';

import { createLocalId } from '../../../utils/local-id';
import { AttachmentTypes } from '../../../constants/Enums';
import { getAttachmentKind } from '../../attachments/AttachmentChip';

const revokePreview = ({ previewUrl }) => {
  if (previewUrl) {
    URL.revokeObjectURL(previewUrl);
  }
};

// Files and links picked for a comment, held in the browser until it is posted or saved
export default () => {
  const [items, setItems] = useState([]);
  const itemsRef = useRef(items);
  itemsRef.current = items;

  const addFiles = useCallback((files) => {
    setItems((prevItems) => [
      ...prevItems,
      ...files.map((file) => {
        const isImage = file.type.startsWith('image/');

        return {
          localId: createLocalId(),
          type: AttachmentTypes.FILE,
          file,
          name: file.name,
          kind: getAttachmentKind({
            type: AttachmentTypes.FILE,
            mimeType: file.type,
            isImage,
          }),
          previewUrl: isImage ? URL.createObjectURL(file) : undefined,
        };
      }),
    ]);
  }, []);

  const addLink = useCallback(({ url, name }) => {
    setItems((prevItems) => [
      ...prevItems,
      {
        localId: createLocalId(),
        type: AttachmentTypes.LINK,
        url,
        name,
        kind: getAttachmentKind({
          type: AttachmentTypes.LINK,
        }),
      },
    ]);
  }, []);

  const remove = useCallback((localId) => {
    setItems((prevItems) =>
      prevItems.filter((item) => {
        if (item.localId === localId) {
          revokePreview(item);
          return false;
        }

        return true;
      }),
    );
  }, []);

  const clear = useCallback(() => {
    itemsRef.current.forEach(revokePreview);
    setItems([]);
  }, []);

  // What the sagas send to the server
  const toData = useCallback(
    () =>
      itemsRef.current.map(({ type, file, url, name }) =>
        type === AttachmentTypes.FILE ? { type, file, name } : { type, url, name },
      ),
    [],
  );

  // Only pasted files become attachments; a text paste, links included, stays text. Stopping the
  // event keeps the card's own paste-to-attach from taking the files as well.
  const handlePaste = useCallback(
    (event) => {
      const files = event.clipboardData ? [...event.clipboardData.files] : [];

      if (files.length === 0) {
        return;
      }

      event.preventDefault();
      event.stopPropagation();

      addFiles(files);
    },
    [addFiles],
  );

  useEffect(
    () => () => {
      itemsRef.current.forEach(revokePreview);
    },
    [],
  );

  return {
    items,
    addFiles,
    addLink,
    remove,
    clear,
    toData,
    handlePaste,
  };
};
```

- [ ] **Step 4: Formatting hook**

`client/src/components/comments/CommentComposer/use-markdown-formatting.js`:

```js
/*!
 * Copyright (c) 2024 PLANKA Software GmbH
 * Licensed under the Fair Use License: https://github.com/plankanban/planka/blob/master/LICENSE.md
 */

import { useCallback } from 'react';

import { applyFormat } from '../../../utils/markdown-format';
import { markupToPlainIndex, plainToMarkupIndex } from '../../../utils/mentions';

// The textarea's selection is in shown text ("@name"); the format applies to the stored text
// ("@[name](id)"), and the new selection is mapped back
export default (inputRef, text, onTextChange) =>
  useCallback(
    (format) => {
      const input = inputRef.current;

      if (!input) {
        return;
      }

      const start = plainToMarkupIndex(text, input.selectionStart);
      const end = plainToMarkupIndex(text, input.selectionEnd);
      const result = applyFormat(text, start, end, format);

      onTextChange(result.text);

      const nextStart = markupToPlainIndex(result.text, result.selectionStart);
      const nextEnd = markupToPlainIndex(result.text, result.selectionEnd);

      requestAnimationFrame(() => {
        input.focus();
        input.setSelectionRange(nextStart, nextEnd);
      });
    },
    [inputRef, text, onTextChange],
  );
```

- [ ] **Step 5: FormattingToolbar**

`client/src/components/comments/CommentComposer/FormattingToolbar.jsx`:

```jsx
/*!
 * Copyright (c) 2024 PLANKA Software GmbH
 * Licensed under the Fair Use License: https://github.com/plankanban/planka/blob/master/LICENSE.md
 */

import React, { useCallback } from 'react';
import PropTypes from 'prop-types';
import { useTranslation } from 'react-i18next';
import { Icon } from 'semantic-ui-react';

import { MarkdownFormats } from '../../../utils/markdown-format';

import styles from './FormattingToolbar.module.scss';

const BUTTONS = [
  { format: MarkdownFormats.BOLD, icon: 'bold', titleKey: 'common.formatBold' },
  { format: MarkdownFormats.ITALIC, icon: 'italic', titleKey: 'common.formatItalic' },
  {
    format: MarkdownFormats.STRIKETHROUGH,
    icon: 'strikethrough',
    titleKey: 'common.formatStrikethrough',
  },
  { format: MarkdownFormats.CODE, icon: 'code', titleKey: 'common.formatCode' },
  {
    format: MarkdownFormats.CODE_BLOCK,
    icon: 'file code outline',
    titleKey: 'common.formatCodeBlock',
  },
  { format: MarkdownFormats.BULLETED_LIST, icon: 'list ul', titleKey: 'common.formatBulletedList' },
  {
    format: MarkdownFormats.NUMBERED_LIST,
    icon: 'list ol',
    titleKey: 'common.formatNumberedList',
  },
  { format: MarkdownFormats.QUOTE, icon: 'quote left', titleKey: 'common.formatQuote' },
  { format: MarkdownFormats.LINK, icon: 'linkify', titleKey: 'common.formatLink' },
];

// Pressing a button must not take focus or the selection away from the textarea
const preventFocusLoss = (event) => {
  event.preventDefault();
};

const FormattingToolbar = React.memo(({ onFormat }) => {
  const [t] = useTranslation();

  const handleClick = useCallback(
    (event) => {
      onFormat(event.currentTarget.dataset.format);
    },
    [onFormat],
  );

  return (
    <div className={styles.wrapper}>
      {BUTTONS.map(({ format, icon, titleKey }) => (
        <button
          key={format}
          type="button"
          title={t(titleKey)}
          data-format={format}
          className={styles.button}
          onMouseDown={preventFocusLoss}
          onClick={handleClick}
        >
          <Icon fitted name={icon} size="small" />
        </button>
      ))}
    </div>
  );
});

FormattingToolbar.propTypes = {
  onFormat: PropTypes.func.isRequired,
};

export default FormattingToolbar;
```

`client/src/components/comments/CommentComposer/FormattingToolbar.module.scss`:

```scss
/*!
 * Copyright (c) 2024 PLANKA Software GmbH
 * Licensed under the Fair Use License: https://github.com/plankanban/planka/blob/master/LICENSE.md
 */

:global(#app) {
  .button {
    background: transparent;
    border: none;
    border-radius: 3px;
    color: #6b808c;
    cursor: pointer;
    padding: 4px 6px;

    &:hover {
      background: rgba(9, 30, 66, 0.08);
      color: #17394d;
    }
  }

  .wrapper {
    display: flex;
    flex-wrap: wrap;
    gap: 2px;
    margin-bottom: 4px;
  }
}
```

- [ ] **Step 6: ComposerAttachments (chips, paperclip, inline link row)**

`client/src/components/comments/CommentComposer/ComposerAttachments.jsx`:

```jsx
/*!
 * Copyright (c) 2024 PLANKA Software GmbH
 * Licensed under the Fair Use License: https://github.com/plankanban/planka/blob/master/LICENSE.md
 */

import React, { useCallback, useRef, useState } from 'react';
import PropTypes from 'prop-types';
import { useSelector } from 'react-redux';
import { useTranslation } from 'react-i18next';
import { Button, Icon } from 'semantic-ui-react';
import { FilePicker } from '../../../lib/custom-ui';

import selectors from '../../../selectors';
import { buildAcceptAttribute } from '../../../utils/attachment-files';
import { isUrl } from '../../../utils/validator';
import AttachmentChip from '../../attachments/AttachmentChip';

import styles from './ComposerAttachments.module.scss';

const ComposerAttachments = React.memo(({ items, onFilesAdd, onLinkAdd, onRemove }) => {
  const allowedExtensions = useSelector(selectors.selectAllowedAttachmentExtensions);

  const [t] = useTranslation();
  const [isLinkFormOpened, setIsLinkFormOpened] = useState(false);
  const [linkUrl, setLinkUrl] = useState('');
  const [linkName, setLinkName] = useState('');
  const linkUrlRef = useRef(null);

  const closeLinkForm = useCallback(() => {
    setIsLinkFormOpened(false);
    setLinkUrl('');
    setLinkName('');
  }, []);

  const submitLink = useCallback(() => {
    const url = linkUrl.trim();

    if (!isUrl(url)) {
      linkUrlRef.current.focus();
      return;
    }

    onLinkAdd({
      url,
      name: linkName.trim() || url,
    });

    closeLinkForm();
  }, [linkUrl, linkName, onLinkAdd, closeLinkForm]);

  const handleLinkButtonClick = useCallback(() => {
    setIsLinkFormOpened((prevIsOpened) => !prevIsOpened);
  }, []);

  // Enter would submit the comment form; Escape only closes this row
  const handleLinkFieldKeyDown = useCallback(
    (event) => {
      if (event.key === 'Enter') {
        event.preventDefault();
        submitLink();
      } else if (event.key === 'Escape') {
        event.stopPropagation();
        closeLinkForm();
      }
    },
    [submitLink, closeLinkForm],
  );

  return (
    <div className={styles.wrapper}>
      {items.length > 0 && (
        <div className={styles.chips}>
          {items.map(({ key, kind, name, previewUrl, isMarked }) => (
            <AttachmentChip
              key={key}
              kind={kind}
              name={name}
              previewUrl={previewUrl}
              isMarked={isMarked}
              onRemove={() => onRemove(key)}
            />
          ))}
        </div>
      )}
      {isLinkFormOpened && (
        <div className={styles.linkForm}>
          <input
            ref={linkUrlRef}
            // eslint-disable-next-line jsx-a11y/no-autofocus
            autoFocus
            value={linkUrl}
            placeholder={t('common.url')}
            maxLength={2048}
            className={styles.linkField}
            onChange={(event) => setLinkUrl(event.target.value)}
            onKeyDown={handleLinkFieldKeyDown}
          />
          <input
            value={linkName}
            placeholder={t('common.linkNameOptional')}
            maxLength={128}
            className={styles.linkField}
            onChange={(event) => setLinkName(event.target.value)}
            onKeyDown={handleLinkFieldKeyDown}
          />
          <Button type="button" size="mini" content={t('action.addLink')} onClick={submitLink} />
        </div>
      )}
      <div className={styles.actions}>
        <FilePicker multiple accept={buildAcceptAttribute(allowedExtensions)} onSelect={onFilesAdd}>
          <button type="button" title={t('action.attachFile')} className={styles.action}>
            <Icon fitted name="attach" />
          </button>
        </FilePicker>
        <button
          type="button"
          title={t('action.addLink')}
          className={styles.action}
          onClick={handleLinkButtonClick}
        >
          <Icon fitted name="linkify" />
        </button>
      </div>
    </div>
  );
});

ComposerAttachments.propTypes = {
  items: PropTypes.arrayOf(
    PropTypes.shape({
      key: PropTypes.string.isRequired,
      kind: PropTypes.string.isRequired,
      name: PropTypes.string.isRequired,
      previewUrl: PropTypes.string,
      isMarked: PropTypes.bool,
    }),
  ).isRequired,
  onFilesAdd: PropTypes.func.isRequired,
  onLinkAdd: PropTypes.func.isRequired,
  onRemove: PropTypes.func.isRequired,
};

export default ComposerAttachments;
```

`client/src/components/comments/CommentComposer/ComposerAttachments.module.scss`:

```scss
/*!
 * Copyright (c) 2024 PLANKA Software GmbH
 * Licensed under the Fair Use License: https://github.com/plankanban/planka/blob/master/LICENSE.md
 */

:global(#app) {
  .action {
    background: transparent;
    border: none;
    border-radius: 3px;
    color: #6b808c;
    cursor: pointer;
    padding: 4px 6px;

    &:hover {
      background: rgba(9, 30, 66, 0.08);
      color: #17394d;
    }
  }

  .actions {
    display: flex;
    gap: 2px;
  }

  .chips {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
  }

  .linkField {
    border: 1px solid rgba(9, 30, 66, 0.13);
    border-radius: 3px;
    flex: 1 1 140px;
    font-size: 12px;
    min-width: 0;
    padding: 4px 8px;
  }

  .linkForm {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
  }

  .wrapper {
    display: flex;
    flex-direction: column;
    gap: 6px;
    margin-top: 6px;
  }
}
```

- [ ] **Step 7: Drop-target context, and routing in AddAttachmentZone**

`client/src/contexts/AttachmentDropContext.js`:

```js
/*!
 * Copyright (c) 2024 PLANKA Software GmbH
 * Licensed under the Fair Use License: https://github.com/plankanban/planka/blob/master/LICENSE.md
 */

import { createContext } from 'react';

// registerDropTarget(elementRef, onFiles) -> unregister. Files dropped over a registered element go
// to it instead of becoming card attachments.
export default createContext(null);
```

`client/src/contexts/index.js`:

```js
import ClosableContext from './ClosableContext';
import BoardShortcutsContext from './BoardShortcutsContext';
import AttachmentDropContext from './AttachmentDropContext';

export { ClosableContext, BoardShortcutsContext, AttachmentDropContext };
```

Run impact on `AddAttachmentZone` first. Then in `client/src/components/cards/CardModal/AddAttachmentZone/AddAttachmentZone.jsx`:
- Change the React import to include `useRef`.
- Add `import { AttachmentDropContext } from '../../../../contexts';`.

Inside the component, before `handleDropAccepted`, add:

```js
  const dropTargetsRef = useRef(new Set());

  const registerDropTarget = useCallback((elementRef, onFiles) => {
    const target = {
      elementRef,
      onFiles,
    };

    dropTargetsRef.current.add(target);

    return () => {
      dropTargetsRef.current.delete(target);
    };
  }, []);
```

Replace `handleDropAccepted` with:

```js
  // The drop overlay covers the whole modal, so a target is found by where the pointer was
  const handleDropAccepted = useCallback(
    (files, event) => {
      const target =
        event &&
        [...dropTargetsRef.current].find(({ elementRef }) => {
          if (!elementRef.current) {
            return false;
          }

          const rect = elementRef.current.getBoundingClientRect();

          return (
            event.clientX >= rect.left &&
            event.clientX <= rect.right &&
            event.clientY >= rect.top &&
            event.clientY <= rect.bottom
          );
        });

      if (target) {
        target.onFiles(files);
        return;
      }

      files.forEach((file) => {
        submitFile(file);
      });
    },
    [submitFile],
  );
```

Wrap the returned tree in the provider. Replace the outer `<>`…`</>` with
`<AttachmentDropContext.Provider value={registerDropTarget}>` … `</AttachmentDropContext.Provider>`. Keep the inner contents unchanged.

- [ ] **Step 8: Drop-target hook, plus the folder index**

Create `client/src/components/comments/CommentComposer/use-attachment-drop-target.js`:

```js
/*!
 * Copyright (c) 2024 PLANKA Software GmbH
 * Licensed under the Fair Use License: https://github.com/plankanban/planka/blob/master/LICENSE.md
 */

import { useContext, useEffect } from 'react';

import { AttachmentDropContext } from '../../../contexts';

export default (elementRef, onFiles) => {
  const registerDropTarget = useContext(AttachmentDropContext);

  useEffect(
    () => (registerDropTarget ? registerDropTarget(elementRef, onFiles) : undefined),
    [registerDropTarget, elementRef, onFiles],
  );
};
```

`client/src/components/comments/CommentComposer/index.js`:

```js
/*!
 * Copyright (c) 2024 PLANKA Software GmbH
 * Licensed under the Fair Use License: https://github.com/plankanban/planka/blob/master/LICENSE.md
 */

import FormattingToolbar from './FormattingToolbar';
import ComposerAttachments from './ComposerAttachments';
import usePendingAttachments from './use-pending-attachments';
import useMarkdownFormatting from './use-markdown-formatting';
import useAttachmentDropTarget from './use-attachment-drop-target';

export {
  FormattingToolbar,
  ComposerAttachments,
  usePendingAttachments,
  useMarkdownFormatting,
  useAttachmentDropTarget,
};
```

- [ ] **Step 9: Lint**

Run: `cd client && npm run lint`
Expected: it passes. Unused-export warnings don't apply; the components are wired in Task 8.

- [ ] **Step 10: Commit**

```bash
git add client/src/components/attachments/AttachmentChip client/src/components/comments/CommentComposer client/src/contexts client/src/components/cards/CardModal/AddAttachmentZone/AddAttachmentZone.jsx client/src/locales/en-US/core.js
git commit -m "comment composer: formatting toolbar, attachment chips, paste and drop

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 8: Wire the composer into Add and Edit

**Files:**
- Modify: `client/src/components/comments/Comments/Add.jsx`
- Modify: `client/src/components/comments/Comments/Edit.jsx`

**Interfaces:**
- Consumes:
  - Everything from Task 7.
  - `entryActions.createCommentInCurrentCard(data, { syncToHippo, attachments })` and `entryActions.updateComment(id, data|null, { addAttachments, removeAttachmentIds })` (Task 6).
  - `selectors.makeSelectAttachmentsByCommentId` (Task 6).
  - `getStoredAttachmentChipProps` (Task 7).

- [ ] **Step 1: Run impact on `Add` and `Edit` (comments)**

- [ ] **Step 2: Add.jsx**

Imports to add:

```js
import { FORMAT_BY_SHORTCUT_KEY } from '../../../utils/markdown-format';
import {
  ComposerAttachments,
  FormattingToolbar,
  useAttachmentDropTarget,
  useMarkdownFormatting,
  usePendingAttachments,
} from '../CommentComposer';
```

After `const [buttonRef, handleButtonRef] = useNestedRef();`, add:

```js
  const pendingAttachments = usePendingAttachments();

  const setText = useCallback(
    (text) => {
      setData({
        text,
      });
    },
    [setData],
  );

  const applyFormat = useMarkdownFormatting(textInputRef, data.text, setText);

  useAttachmentDropTarget(textFieldRef, pendingAttachments.addFiles);
```

Replace `createComment` with:

```js
  const createComment = useCallback(
    (cleanData, syncToHippo) => {
      dispatch(
        entryActions.createCommentInCurrentCard(cleanData, {
          syncToHippo,
          attachments: pendingAttachments.toData(),
        }),
      );

      setData(DEFAULT_DATA);
      pendingAttachments.clear();
      selectTextField();
    },
    [dispatch, setData, selectTextField, pendingAttachments],
  );
```

In `submit`, replace:

```js
    if (!cleanData.text) {
```

with:

```js
    if (!cleanData.text && pendingAttachments.items.length === 0) {
```

and add `pendingAttachments` to `submit`'s dependency array.

Replace `handleFieldKeyDown` with:

```js
  const handleFieldKeyDown = useCallback(
    (event) => {
      if (!isModifierKeyPressed(event)) {
        return;
      }

      if (event.key === 'Enter') {
        submit();
        return;
      }

      const format = FORMAT_BY_SHORTCUT_KEY[event.key.toLowerCase()];

      if (format) {
        event.preventDefault();
        applyFormat(format);
      }
    },
    [submit, applyFormat],
  );
```

Before `return (`, add:

```js
  const isExpanded = isOpened || data.text.length > 0 || pendingAttachments.items.length > 0;
```

In the JSX:
- Change `<div ref={textFieldRef} className={styles.field}>` to `<div ref={textFieldRef} className={styles.field} onPaste={pendingAttachments.handlePaste}>`.
- Insert `{isExpanded && <FormattingToolbar onFormat={applyFormat} />}` as its first child.
- After `</MentionsInput>`, still inside that div, insert:

```jsx
          {isExpanded && (
            <ComposerAttachments
              items={pendingAttachments.items.map(({ localId, kind, name, previewUrl }) => ({
                key: localId,
                kind,
                name,
                previewUrl,
              }))}
              onFilesAdd={pendingAttachments.addFiles}
              onLinkAdd={pendingAttachments.addLink}
              onRemove={pendingAttachments.remove}
            />
          )}
```

Replace `{(isOpened || data.text.length > 0) && (` (around the controls) with `{isExpanded && (`.

Keep `rows={isOpened ? 3 : 1}` and `minHeight` as they are.

- [ ] **Step 3: Edit.jsx**

Imports: add `useState` to the React import, and add:

```js
import { FORMAT_BY_SHORTCUT_KEY } from '../../../utils/markdown-format';
import { getStoredAttachmentChipProps } from '../../attachments/AttachmentChip';
import {
  ComposerAttachments,
  FormattingToolbar,
  useAttachmentDropTarget,
  useMarkdownFormatting,
  usePendingAttachments,
} from '../CommentComposer';
```

After `const selectCommentById = ...`, add:

```js
  const selectAttachmentsByCommentId = useMemo(
    () => selectors.makeSelectAttachmentsByCommentId(),
    [],
  );
```

After the `boardMemberships` selector, add:

```js
  const attachments = useSelector((state) => selectAttachmentsByCommentId(state, commentId));
```

After `const [cancelButtonRef, handleCancelButtonRef] = useNestedRef();`, add:

```js
  const pendingAttachments = usePendingAttachments();
  const [removedAttachmentIds, setRemovedAttachmentIds] = useState(() => new Set());

  const setText = useCallback(
    (text) => {
      setData({
        text,
      });
    },
    [setData],
  );

  const applyFormat = useMarkdownFormatting(textInputRef, data.text, setText);

  useAttachmentDropTarget(textFieldRef, pendingAttachments.addFiles);
```

Replace `submit` with:

```js
  const submit = useCallback(() => {
    const cleanData = {
      ...data,
      text: mentionTextToMarkup(data.text.trim(), userByUsername),
    };

    const isTextChanged = !dequal(cleanData, defaultData);
    const removeAttachmentIds = [...removedAttachmentIds];
    const addAttachments = pendingAttachments.toData();

    const attachmentsTotal =
      attachments.length - removeAttachmentIds.length + addAttachments.length;

    // A comment left with neither text nor attachments keeps what it had
    if (cleanData.text || attachmentsTotal > 0) {
      if (isTextChanged || removeAttachmentIds.length > 0 || addAttachments.length > 0) {
        dispatch(
          entryActions.updateComment(commentId, isTextChanged ? cleanData : null, {
            addAttachments,
            removeAttachmentIds,
          }),
        );
      }
    }

    pendingAttachments.clear();
    onClose();
  }, [
    commentId,
    onClose,
    dispatch,
    defaultData,
    data,
    userByUsername,
    attachments,
    removedAttachmentIds,
    pendingAttachments,
  ]);
```

Replace the `event.key === 'Enter'` branch of `handleFieldKeyDown` with:

```js
      if (isModifierKeyPressed(event)) {
        if (event.key === 'Enter') {
          submit();
          return;
        }

        const format = FORMAT_BY_SHORTCUT_KEY[event.key.toLowerCase()];

        if (format) {
          event.preventDefault();
          applyFormat(format);
        }
      } else if (event.key === 'Escape') {
```

Keep the existing Escape body. Add `applyFormat` to the dependency array.

Before `return (`, add:

```js
  const handleAttachmentRemove = useCallback(
    (key) => {
      if (attachments.some(({ id }) => id === key)) {
        setRemovedAttachmentIds((prevIds) => {
          const nextIds = new Set(prevIds);

          if (nextIds.has(key)) {
            nextIds.delete(key);
          } else {
            nextIds.add(key);
          }

          return nextIds;
        });
      } else {
        pendingAttachments.remove(key);
      }
    },
    [attachments, pendingAttachments],
  );

  const attachmentItems = [
    ...attachments
      .filter(({ isPersisted }) => isPersisted)
      .map((attachment) => ({
        key: attachment.id,
        ...getStoredAttachmentChipProps(attachment),
        isMarked: removedAttachmentIds.has(attachment.id),
      })),
    ...pendingAttachments.items.map(({ localId, kind, name, previewUrl }) => ({
      key: localId,
      kind,
      name,
      previewUrl,
    })),
  ];
```

Note: hooks must stay above any early return. Edit has none, so placing these before `return (` is fine.

In the JSX:
- Change `<div ref={textFieldRef} className={styles.field}>` to `<div ref={textFieldRef} className={styles.field} onPaste={pendingAttachments.handlePaste}>`.
- Insert `<FormattingToolbar onFormat={applyFormat} />` as its first child.
- After `</MentionsInput>`, inside the same div, insert:

```jsx
        <ComposerAttachments
          items={attachmentItems}
          onFilesAdd={pendingAttachments.addFiles}
          onLinkAdd={pendingAttachments.addLink}
          onRemove={handleAttachmentRemove}
        />
```

- [ ] **Step 4: Lint and build**

Run: `cd client && npm run lint && npm run build`
Expected: the lint passes and the build finishes without errors.

- [ ] **Step 5: Commit**

```bash
git add client/src/components/comments/Comments/Add.jsx client/src/components/comments/Comments/Edit.jsx
git commit -m "comment composer: attachments and formatting in add and edit

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 9: Show attachments on posted comments; card-section marker; delete confirmation

**Files:**
- Create: `client/src/components/attachments/Attachments/gallery.jsx` (shared gallery options and per-attachment viewer props)
- Modify: `client/src/components/attachments/Attachments/Attachments.jsx`
- Modify: `client/src/components/attachments/Attachments/Item.jsx`
- Modify: `client/src/components/attachments/Attachments/ItemContent.jsx`
- Modify: `client/src/components/attachments/Attachments/index.js`
- Create: `client/src/components/comments/Comments/CommentAttachments.jsx`
- Create: `client/src/components/comments/Comments/CommentAttachments.module.scss`
- Modify: `client/src/components/comments/Comments/Item.jsx`

**Interfaces:**
- Consumes: `makeSelectAttachmentsByCommentId` (Task 6); `AttachmentChip`, `getStoredAttachmentChipProps` (Task 7).
- Produces: `GALLERY_OPTIONS`, and `buildGalleryItemProps(attachment, t) → props for <GalleryItem>`. Both are exported from `components/attachments/Attachments`.

- [ ] **Step 1: Run impact on `Item` (attachments), `Attachments`, `ItemContent` and `Item` (comments)**

- [ ] **Step 2: Extract the gallery helpers**

Create `client/src/components/attachments/Attachments/gallery.jsx`:
- Move into it the `options={{ ... }}` object literal from `Attachments.jsx`, as `export const GALLERY_OPTIONS = { ... };`.
- Move into it the whole `galleryItemProps` computation from `Item.jsx` (the `if (attachment.type === AttachmentTypes.FILE) { ... } else if (attachment.type === AttachmentTypes.LINK) { ... }` block, unchanged), as:

```jsx
/*!
 * Copyright (c) 2024 PLANKA Software GmbH
 * Licensed under the Fair Use License: https://github.com/plankanban/planka/blob/master/LICENSE.md
 */

import React from 'react';
import classNames from 'classnames';

import Config from '../../../constants/Config';
import Encodings from '../../../constants/Encodings';
import { AttachmentTypes } from '../../../constants/Enums';
import ContentViewer from './ContentViewer';
import PdfViewer from './PdfViewer';
import CsvViewer from './CsvViewer';

import styles from './Item.module.scss';

export const GALLERY_OPTIONS = {
  // moved unchanged from Attachments.jsx
};

// What the gallery shows when an attachment opens: the image itself, or a viewer for its content
export const buildGalleryItemProps = (attachment, t) => {
  let galleryItemProps;

  // moved unchanged from Item.jsx

  return galleryItemProps;
};
```

The two `// moved unchanged` comments mark where the existing code goes. Paste the exact existing code there, then delete the comments.

In `Item.jsx`:
- Remove the moved block, and the imports only it used (`classNames`, `Config`, `Encodings`, `ContentViewer`, `PdfViewer`, `CsvViewer`).
- Add `import { buildGalleryItemProps } from './gallery';`.
- Use `const galleryItemProps = buildGalleryItemProps(attachment, t);` after the `isPersisted` early return.

In `Attachments.jsx`, add `import { GALLERY_OPTIONS } from './gallery';` and use `options={GALLERY_OPTIONS}`.

In `client/src/components/attachments/Attachments/index.js`, also export:

```js
export { GALLERY_OPTIONS, buildGalleryItemProps } from './gallery';
```

- [ ] **Step 3: Lint to confirm the extraction is clean**

Run: `cd client && npm run lint`
Expected: it passes.

- [ ] **Step 4: CommentAttachments**

`client/src/components/comments/Comments/CommentAttachments.jsx`:

```jsx
/*!
 * Copyright (c) 2024 PLANKA Software GmbH
 * Licensed under the Fair Use License: https://github.com/plankanban/planka/blob/master/LICENSE.md
 */

import React, { useCallback, useContext, useMemo } from 'react';
import PropTypes from 'prop-types';
import { useSelector } from 'react-redux';
import { useTranslation } from 'react-i18next';
import { Gallery, Item as GalleryItem } from 'react-photoswipe-gallery';

import selectors from '../../../selectors';
import { ClosableContext } from '../../../contexts';
import { AttachmentTypes } from '../../../constants/Enums';
import { GALLERY_OPTIONS, buildGalleryItemProps } from '../../attachments/Attachments';
import AttachmentChip, { getStoredAttachmentChipProps } from '../../attachments/AttachmentChip';

import styles from './CommentAttachments.module.scss';

const CommentAttachments = React.memo(({ commentId }) => {
  const selectAttachmentsByCommentId = useMemo(
    () => selectors.makeSelectAttachmentsByCommentId(),
    [],
  );

  const attachments = useSelector((state) => selectAttachmentsByCommentId(state, commentId));

  const [t] = useTranslation();
  const [activateClosable, deactivateClosable] = useContext(ClosableContext);

  const handleBeforeGalleryOpen = useCallback(
    (gallery) => {
      activateClosable();

      gallery.on('destroy', () => {
        deactivateClosable();
      });
    },
    [activateClosable, deactivateClosable],
  );

  if (attachments.length === 0) {
    return null;
  }

  return (
    <div className={styles.wrapper}>
      <Gallery
        withCaption
        withDownloadButton
        options={GALLERY_OPTIONS}
        onBeforeOpen={handleBeforeGalleryOpen}
      >
        {attachments.map((attachment) => {
          const chipProps = getStoredAttachmentChipProps(attachment);

          if (!attachment.isPersisted) {
            return (
              <AttachmentChip
                key={attachment.id}
                kind={chipProps.kind}
                name={chipProps.name}
                isSubmitting
              />
            );
          }

          if (attachment.type === AttachmentTypes.LINK) {
            return (
              <AttachmentChip
                key={attachment.id}
                kind={chipProps.kind}
                name={chipProps.name}
                onClick={() => window.open(attachment.data.url, '_blank')}
              />
            );
          }

          return (
            <GalleryItem
              key={attachment.id}
              {...buildGalleryItemProps(attachment, t)} // eslint-disable-line react/jsx-props-no-spreading
              original={attachment.data.url}
              caption={attachment.name}
            >
              {({ ref, open }) =>
                attachment.data.image ? (
                  <button
                    ref={ref}
                    type="button"
                    title={attachment.name}
                    className={styles.thumbnail}
                    onClick={open}
                  >
                    <img src={chipProps.previewUrl} alt={attachment.name} />
                  </button>
                ) : (
                  <AttachmentChip
                    ref={ref}
                    kind={chipProps.kind}
                    name={chipProps.name}
                    onClick={open}
                  />
                )
              }
            </GalleryItem>
          );
        })}
      </Gallery>
    </div>
  );
});

CommentAttachments.propTypes = {
  commentId: PropTypes.string.isRequired,
};

export default CommentAttachments;
```

`client/src/components/comments/Comments/CommentAttachments.module.scss`:

```scss
/*!
 * Copyright (c) 2024 PLANKA Software GmbH
 * Licensed under the Fair Use License: https://github.com/plankanban/planka/blob/master/LICENSE.md
 */

:global(#app) {
  .thumbnail {
    background: none;
    border: 1px solid rgba(9, 30, 66, 0.13);
    border-radius: 3px;
    cursor: pointer;
    height: 64px;
    overflow: hidden;
    padding: 0;
    width: 96px;

    img {
      height: 100%;
      object-fit: cover;
      width: 100%;
    }
  }

  .wrapper {
    align-items: flex-start;
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
    line-height: 20px;
    margin-top: 6px;
  }
}
```

- [ ] **Step 5: Comment Item**

In `client/src/components/comments/Comments/Item.jsx`:
- Add `import CommentAttachments from './CommentAttachments';`.
- After `const selectListById = ...`, add:

```js
  const selectAttachmentsByCommentId = useMemo(
    () => selectors.makeSelectAttachmentsByCommentId(),
    [],
  );
```

- After the `user` selector, add:

```js
  const hasAttachments = useSelector(
    (state) => selectAttachmentsByCommentId(state, id).length > 0,
  );
```

Replace `<Markdown>{comment.text}</Markdown>` with:

```jsx
            {comment.text && <Markdown>{comment.text}</Markdown>}
            <CommentAttachments commentId={id} />
```

Change the ConfirmationPopup `content` prop to:

```jsx
                      content={
                        hasAttachments
                          ? 'common.areYouSureYouWantToDeleteThisCommentAndItsAttachments'
                          : 'common.areYouSureYouWantToDeleteThisComment'
                      }
```

- [ ] **Step 6: Marker in the card Attachments section**

In `client/src/components/attachments/Attachments/ItemContent.jsx`, replace:

```jsx
        <span className={styles.information}>
          <TimeAgo date={attachment.createdAt} />
        </span>
```

with:

```jsx
        <span className={styles.information}>
          <TimeAgo date={attachment.createdAt} />
          {attachment.commentId && (
            <Icon
              name="comment outline"
              title={t('common.attachedToComment')}
              className={styles.commentMarker}
            />
          )}
        </span>
```

In `ItemContent.module.scss`, add (alphabetically within the block):

```scss
  .commentMarker {
    margin-left: 6px;
  }
```

- [ ] **Step 7: Lint and build**

Run: `cd client && npm run lint && npm run build`
Expected: both pass.

- [ ] **Step 8: Commit**

```bash
git add client/src/components/attachments/Attachments client/src/components/comments/Comments/CommentAttachments.jsx client/src/components/comments/Comments/CommentAttachments.module.scss client/src/components/comments/Comments/Item.jsx
git commit -m "comment attachments: show them on comments, mark them in the card list

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 10: Final checks and handoff

- [ ] **Step 1: Run every light check**

```bash
cd /Users/shankar/Documents/node/planka/server && npm run lint && npx mocha test/utils/comment-attachments.test.js test/utils/hippo.test.js
cd /Users/shankar/Documents/node/planka/client && npm run lint && npx jest src/utils && npm run build
```

Expected: everything passes. Report any failure with its output; don't paper over it.

- [ ] **Step 2: Check the change scope**

Run `gitnexus_detect_changes({scope: "compare", base_ref: "timeline-drag-fluidity"})`. Confirm that only the files listed in Tasks 1–9 changed.

- [ ] **Step 3: Give the user this manual test list** (they run the migration and the app)

1. Run the migration: `npm run db:migrate` (server). Also run it down and up once.
2. As an editor:
   - Attach an image, a PDF and a link (paperclip, then the link row). Check the chips' icon, name and ✕, and that ✕ removes one before posting.
   - Post. Check the image thumbnail, the PDF chip (opens the viewer) and the link chip (opens a new tab).
   - Check the card's Attachments section: each attachment has a comment icon, and the image did not become the cover.
3. Paste a screenshot into the comment box: it becomes a chip and not a card attachment. Paste plain text and a URL: both stay text.
4. Drag two files onto the comment box: they become chips. Drop a file elsewhere on the card: it becomes a card attachment as before.
5. Post a comment with attachments and no text: it works. Post one with neither: it does not.
6. As a commenter (non-editor, comment permission):
   - Attaching on your own comment works, and Edit can add or remove attachments.
   - Card-level add/edit controls are still hidden.
   - Calling `DELETE /api/attachments/:id` on an attachment of someone else's comment returns 403.
7. Edit a comment: mark one attachment for removal (✕, then undo it with ↺, then ✕ again), add one, and Save. A second browser updates live.
8. Delete a comment with attachments:
   - The confirmation mentions the attachments.
   - The attachments vanish from the card.
   - The files are gone from S3, or from local storage when `uploaded_file.references_total` reaches 0.
9. On a Hippo ticket card, post with attachments and choose sync. The Hippo note lists the names as working links.
10. Each toolbar button with and without a selection, Ctrl/Cmd+B and Ctrl/Cmd+I, and formatting a line after an @mention. The caret lands right, and the mention still renders as a mention.

- [ ] **Step 4: Hand off for review**

Use superpowers:requesting-code-review (or `/code-review medium`) on the branch.
