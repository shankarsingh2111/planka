# Comment attachments and formatting — design

Date: 2026-10-13
Branch base: `timeline-drag-fluidity`

## Goal

Let users attach files (images, PDFs, any allowed type) and links to card comments, and format
comment text. While writing, each pending attachment shows in the comment box as a small icon, its
name and a ✕ to remove it. Posted comments show their attachments under the text.

## Decisions

| Topic | Decision |
|---|---|
| Storage | Comment attachments are ordinary card `Attachment` rows with a new nullable `commentId`. They also appear in the card's Attachments section, marked as coming from a comment. |
| Formatting | A toolbar over the existing `react-mentions` textarea that inserts Markdown. @mentions keep working. No WYSIWYG. |
| Hippo sync | The Hippo note gets an "Attachments" list of names linked to their Planka URLs (link attachments use their own URL). |
| Display | Images show as thumbnails; other files and links show as icon + name chips. Clicking opens the existing attachment viewer, or the link. |
| Editing | When editing a comment you can add new attachments and remove existing ones. |
| Permissions | Editors can attach to any comment. Members with `canComment` (non-editors) can add or remove attachments only on comments they wrote. |
| Comment delete | Deleting a comment deletes its attachments, including the stored files. |
| Add methods | Paperclip → multi-file picker; paste and drag-drop files onto the box; "Add link" popup (URL + name). |
| Upload timing | Pending items stay in the browser until Post or Save, then upload with `commentId`. An abandoned draft leaves nothing on the server. |
| Empty text | A comment may have no text when it has at least one attachment. The client enforces this; the server accepts empty text. |
| Limits | The existing file-type, SVG and size checks of `attachments/create` apply unchanged. |
| Markdown links | Markdown links in the text are not turned into attachments. |

## 1. Server

### Migration `server/db/migrations/20261013000000_add_comment_id_to_attachment.js`

- `attachment.comment_id bigInteger NULL`, plus an index on `comment_id`.
- No database foreign key, following the repository's convention. Integrity is kept in helpers.
- `down` drops the index and the column.

### Model `server/api/models/Attachment.js`

- Add `commentId: { model: 'Comment', columnName: 'comment_id' }` and the swagger property
  (`nullable: true`).
- `presentOne` / `presentMany`: include `commentId` if they whitelist fields.

### Model `server/api/models/Comment.js`

- `text`: drop `required`, add `defaultsTo: ''`. The DB column stays `NOT NULL`, and `''` is stored.

### Query methods `server/api/hooks/query-methods/models/Attachment.js`

- Add `getByCommentId(commentId)` and `getByCommentIds(commentIds)` if they are missing. The delete
  cascade and the Hippo note use them.

### Controller `attachments/create`

- New optional input `commentId` (`idInput`).
- If it is given: load the comment. If it doesn't exist or `comment.cardId !== card.id`, return
  `COMMENT_NOT_FOUND` (404).
- Permission:
  - `role === EDITOR` → allowed.
  - Otherwise, allowed only if `commentId` is given, `boardMembership.canComment`, and
    `comment.userId === currentUser.id`.
  - Otherwise → `NOT_ENOUGH_RIGHTS`.
- Pass `comment` into `attachments.createOne` so `values.commentId` is set.

### Controller `attachments/delete`

- Same rule: a non-editor with `canComment` may delete an attachment whose comment belongs to them.

### Controller `attachments/update`

- Unchanged: editors only. Renaming stays a card-level action.

### Controllers `comments/create` and `comments/update`

- `text` input: drop `required` and default it to `''`. Keep `maxLength`.

### Helper `comments/delete-one`

- Before deleting the comment, load `Attachment.qm.getByCommentId(comment.id)`.
- Run each one through `sails.helpers.attachments.deleteOne.with({...})` so file cleanup (S3 or
  local), `attachmentDelete` sockets, webhooks and storage-usage tracking all happen as usual.
- Card and board deletion already remove attachments by card. They need no change.

### Hippo `controllers/hippo/sync-note.js`

- After the comment text, if the comment has attachments, append to the note HTML:
  an "Attachments:" heading and one `<a href="…">name</a>` per attachment.
  - File: `${sails.config.custom.baseUrl}/attachments/${id}/download/${encodeURIComponent(filename)}`.
  - Link: `data.url`.
- Put this in a named helper (for example a `buildAttachmentListHtml` util next to `buildNoteHtml`),
  and escape the names.

## 2. Client — data layer

- `models/Attachment`: add the `commentId` attribute (a foreign key to `Comment`, plus an
  `attachments` back-reference on `Comment`).
- Selectors: `makeSelectAttachmentsByCommentId` (memoised; images first, then by `createdAt`).
- `api/attachments.createAttachment`: pass `commentId` through in the multipart/JSON body.
- The `comments` saga service:
  - `createComment(cardId, data, { syncToHippo, attachments })`:
    1. create the comment;
    2. for each pending item, `createAttachment(cardId, { ...item, commentId })` in sequence;
    3. if `syncToHippo`, call the existing `syncCommentToHippo`.
    - A failed upload shows the existing error toast. The comment and the other attachments stay.
  - `updateComment(id, data, { addAttachments, removeAttachmentIds })`:
    update the text, then delete the removed attachments, then upload the new ones.
- Deleting a comment: on `commentDelete`, remove the comment's attachments from the local store.
  Socket `attachmentDelete` events also arrive.

## 3. Client — comment box

New shared components in `client/src/components/comments/CommentComposer/`:

- **`FormattingToolbar.jsx`**: buttons for Bold, Italic, Strikethrough, Inline code, Code block,
  Bulleted list, Numbered list, Quote and Link.
  - Each calls a pure helper in `client/src/utils/markdown-format.js`:
    `applyFormat(text, selectionStart, selectionEnd, format) → { text, selectionStart, selectionEnd }`.
    - Inline formats wrap the selection, or insert a marker pair with the caret inside.
    - Line formats prefix every selected line.
  - Keyboard: Ctrl/Cmd+B and Ctrl/Cmd+I in the textarea.
  - The toolbar works on the `react-mentions` input ref (`textInputRef`) and writes back through the
    existing `handleFieldChange`, so mention markup stays valid.
- **`PendingAttachments.jsx`**: a row of chips. Each chip shows a type icon (image → preview from
  `URL.createObjectURL`, pdf, generic file, link), the truncated name and a ✕.
  - Object URLs are revoked on removal and unmount.
- **`AttachButtons.jsx`**: the paperclip (a hidden `<input type="file" multiple>`) and a link button
  that opens a small popup step (URL + optional name, defaulting to the URL). The popup follows the
  look of `AddAttachmentStep`.
- **Paste / drop**: an `onPaste` (`clipboardData.files`) and drop-zone handler on the composer
  wrapper adds files to the pending list. Text paste is not affected.
- Pending item shape: `{ localId, type: 'file' | 'link', file?, url?, name }`.

`Add.jsx`:
- Renders the toolbar, the composer textarea, pending chips and attach buttons.
- Submit is allowed when the text is non-empty or there is at least one pending item.
- The Hippo modal flow is unchanged; pending items are carried into `createComment`.
- After submit, pending items are cleared.

`Edit.jsx`:
- Same composer.
- Existing attachments show as chips. ✕ marks one for removal (greyed out; ✕ again undoes it).
- Save sends `{ text, addAttachments, removeAttachmentIds }`. Cancel throws away pending changes.

## 4. Client — display

- `comments/Comments/Item.jsx`: below `<Markdown>`, render `CommentAttachments`:
  - images: small thumbnails (the existing `thumbnailUrls` / `url`) in a wrap row;
  - other files and links: chips with an icon and name.
  - Clicking opens the existing attachment viewer used by `attachments/Attachments` (images
    gallery, PDF, CSV), or the link in a new tab.
- The comment delete confirmation adds "Its attachments will also be deleted." when there are any.
- `attachments/Attachments/Item.jsx`: a small comment icon and tooltip ("Attached to a comment")
  when `commentId` is set.
- Who sees the attach and edit-attachment controls in the composer: editors, and the comment's
  author when they have `canComment`.

## 5. i18n

New keys in `en-US` (other locales fall back to English):
- toolbar tooltips;
- "Attach file", "Add link";
- "Attached to a comment";
- the delete-confirmation sentence;
- "Remove attachment".

## 6. Error handling

- A failed upload after the comment is created shows a toast naming the file; the comment remains.
- `COMMENT_NOT_FOUND` / `NOT_ENOUGH_RIGHTS` from `attachments/create` go through the same toast.
- Server file checks reject a disallowed type, and the pending chip for that file is dropped with
  a toast.

## 7. Testing

Light checks only:
- `npm run lint` in client and server; a client build.
- Unit tests for `applyFormat` (wrap, empty selection, multi-line prefix, toggle-free insertion).

Manual test list for the user:
1. Editor: attach an image, a PDF and a link via the paperclip and the link popup; check the chips
   and ✕; post; check the thumbnail and chips in the comment and the marker in the card
   Attachments section.
2. Paste a screenshot; drag-drop two files.
3. A comment with attachments and no text posts; one with neither does not.
4. Commenter (non-editor, `canComment`): attach on own comment works; editing someone else's
   comment is not possible; the card-level add button is still hidden.
5. Edit a comment: remove one attachment and add one; Save; check another browser via sockets.
6. Delete the comment: the attachments disappear from the card and the files are gone from
   S3/local.
7. Hippo ticket card: post with attachments and choose sync; the Hippo note lists the names with
   working links.
8. Each toolbar button with and without a selection; Ctrl/Cmd+B/I; @mention still autocompletes
   and renders.
9. Run the migration up and down.
