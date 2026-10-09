# Hippo Card Sync Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let a hand-made card pull its Hippo ticket in (Pull button), refresh linked cards from Hippo when an editor opens them (at most every 2 minutes) or on demand (Sync button), and route the Add Card import through the same server-side sync.

**Architecture:**
- **Server endpoint.** One endpoint, `POST /api/cards/:cardId/hippo-sync`, does everything:
  - fetches the ticket;
  - merges it into the card: the description block, State, Priority and Tags, members, and notes and comments placed by date;
  - records which Hippo entries the card already has, in `hippo_card_entry`;
  - records when the card was last synced, in `hippo_card_sync`.
- **Server code layout.** The merge rules are pure functions in `server/utils/hippo-card-sync.js`. A controller does the access checks and the Hippo fetch, and a helper writes the result through Planka's existing write helpers, so sockets, webhooks and actions fire as usual.
- **Client.** The client calls the endpoint directly, outside the shared request queue:
  - from a hook in the card view's Hippo Ticket section;
  - from the Add Card import saga.

**Tech Stack:** Sails 1 / Waterline / knex (server), mocha + chai (server tests), React 18 + redux-saga + Semantic UI React (client), jest (client tests).

**Spec:** `docs/superpowers/specs/2026-10-09-hippo-card-sync-design.md`

## Global Constraints

- Hippo wins for its own fields: Ticket State, Priority and the imported description block are overwritten. Notes, comments, tags and members are only ever added. Nothing a user added in Planka is removed or changed.
- Saving Ticket # only saves it; the first pull is the **Pull from Hippo** button.
- Refresh on open: every open by an editor, at most every 2 minutes per card, counted across all users. The Sync button skips the limit.
- The card title is never changed by a sync.
- Board editors only, for the buttons and for refresh on open.
- A Hippo failure is never answered with 401 (the client logs the user out on 401).
- Imported comments are headed `**[Hippo Note] Author**` / `**[Hippo Comment] Author**`, with no date.
- Description block: `### Hippo #<n>: <subject>`, a blank line, the description, a blank line, `— Imported from Hippo ticket #<n>`.
- Comment ID from a date: `((dateMs - 1567191600000) << 23) | (1 << 10) | random(0..1023)`, with no bitwise operators in code (airbnb `no-bitwise`), computed with `BigInt` multiplication.
- Sails helpers load before models: never reference a model global (`Comment`, `HippoCardEntry`, …) at module level, only inside functions.
- Checks are light, per the user's standing preference: unit tests for pure code, then lint and build, then a manual test list. Don't start servers, databases or browsers.
- Before editing an existing function, run `gitnexus_impact` on it (`repo: "planka"`), and before each commit run `gitnexus_detect_changes`. The index may not know branch-new symbols; when it reports "not found", find the callers with grep and note that you did.

## Review Focus

1. **Two editors open the same card at the same moment.** Each Hippo note must still become exactly one comment. Covered by the in-process lock in Task 4 and the record-before-comment order in Task 3, which relies on the unique index from Task 2. No unit test can exercise this; the reviewer checks the order of writes in `importEntries`.
2. **A pushed Planka comment containing Markdown characters (`*`, `_`, `#`, `[`) comes back from Hippo through Turndown with backslash escapes.** It must still be recognised as the card's own comment. Pinned by the `planEntries` "pushed note with escaped characters" test in Task 1.
3. **Ticket # typed as `#43643` or with spaces.** It must still sync as ticket 43643. Anything not numeric must be refused as not a ticket card. Pinned by the `normalizeTicketNumber` tests in Task 1.
4. **A ticket description containing `$&` or `$1`.** It must appear literally in the description block, not as a regex replacement pattern. Pinned by the `applyDescriptionBlock` "replacement patterns" test in Task 1.
5. **A card with more than 50 comments.** Matching older imports and pushed notes must see every comment, not the first page. Task 3 adds `Comment.qm.getAllByCardId`, and the reviewer checks that `importEntries` uses it.

---

## File Structure

**Server, new:**
- `server/db/migrations/20261009000000_add_hippo_card_sync.js` — two tables.
- `server/api/models/HippoCardEntry.js`, `server/api/models/HippoCardSync.js` — models.
- `server/api/hooks/query-methods/models/HippoCardEntry.js`, `.../HippoCardSync.js` — query methods.
- `server/utils/hippo-card-sync.js` — pure merge rules.
- `server/test/utils/hippo-card-sync.test.js` — their tests.
- `server/api/helpers/hippo/apply-ticket-to-card.js` — writes a fetched ticket into a card.
- `server/api/controllers/hippo/sync-card.js` — the endpoint.

**Server, changed:**
- `server/utils/hippo.js` — adds `TAGS`, plus `customFieldGroupId` and `tags` on ticket values.
- `server/test/utils/hippo.test.js`
- `server/api/hooks/query-methods/models/Comment.js` — `createOne(values, { createdAt })` and `getAllByCardId`.
- `server/api/helpers/comments/create-one.js` — `createdAt` input.
- `server/api/helpers/cards/delete-related.js` — cleanup.
- `server/config/routes.js` — the route.

**Client, changed:**
- `client/src/utils/hippo.js` + `.test.js` — block description and the new import shape.
- `client/src/api/hippo.js` — `syncHippoCard`.
- `client/src/sagas/core/services/hippo.js` — the import goes through the sync.
- `client/src/components/cards/AddCardModal/Content.jsx` — the new `buildHippoImport` call.
- `client/src/components/cards/CardModal/CustomFieldGroups/Item.jsx` + `Item.module.scss` — the button and the status line.
- `client/src/locales/en-US/core.js` — new strings.

**Client, new:**
- `client/src/components/cards/CardModal/CustomFieldGroups/use-hippo-card-sync.js` — the hook.

---

### Task 1: Server merge rules (pure)

**Files:**
- Create: `server/utils/hippo-card-sync.js`
- Create: `server/test/utils/hippo-card-sync.test.js`
- Modify: `server/utils/hippo.js`
- Modify: `server/test/utils/hippo.test.js`

**Interfaces:**
- Consumes: from `server/utils/hippo.js`: `HippoFieldNames`, and the ticket shape from `mapTicket`: `{ number, subject, descriptionMarkdown, statusText, priority, tags: string[], entries: [{ id, kind: 'note'|'comment', authorName, date, markdown }] }`. From `server/api/models/CustomField.js`: `Types` (`TEXT`, `DROPDOWN`, `MULTISELECT`). From `server/utils/mentions.js`: `mentionMarkupToText`.
- Produces (all exported from `server/utils/hippo-card-sync.js`):
  - `SYNC_INTERVAL_MS` = 120000.
  - `SkipReasons = { NEVER_SYNCED: 'neverSynced', OTHER_TICKET: 'otherTicket', RECENT: 'recent', IN_PROGRESS: 'inProgress' }`.
  - `EntryRecordKinds = { IMPORTED: 'imported', SKIPPED: 'skipped' }`.
  - `HIPPO_FIELD_DEFINITIONS`: an array of `{ name, type, showOnFrontOfCard, defaultOptions? }`.
  - `normalizeTicketNumber(value) → string|null`.
  - `buildDescriptionBlock(ticket) → string`.
  - `applyDescriptionBlock(description, ticket) → string`.
  - `buildEntryCommentText(entry) → string`.
  - `buildCommentIdFromDate(date, { now, sequence }?) → string|null`.
  - `planEntries({ entries, records, comments, entryIds }) → { toImport: entry[], toRecord: [{ entryId, kind, commentId }] }`.
  - `getSkipReason({ syncRecord, ticketNumber, force, now }) → string|null`.
  - `mergeFieldOptions(existing, defaults, values) → string[]`.
  - `mergeTags(content, tags) → string|null`.
  - `buildFieldContents({ ticket, ticketState, currentTags }) → { [fieldName]: string|null }`.
  - `getPicks(definition, content) → string[]`.
  - `planFieldChange(definition, customField, picks) → { action: 'create'|'update'|'none', values? }`.
- Produces (`server/utils/hippo.js`): `HippoFieldNames.TAGS = 'Tags'`. `getTicketValuesByCardId` results gain `customFieldGroupId` and `tags`.

- [ ] **Step 1: Impact check**

Run `gitnexus_impact({target: "getTicketValuesByCardId", direction: "upstream", repo: "planka"})`. If it is not found, run `grep -rn "getTicketValuesByCardId\|getTicketValuesByCards" server/api` and note the callers: `get-ticket-values-by-cards.js`, then `sync-note.js`, `sync-status.js` and `dashboard/show.js` through the helper. All of them read named keys, so two extra keys cannot break them.

- [ ] **Step 2: Write the failing tests**

Create `server/test/utils/hippo-card-sync.test.js`:

```js
const { expect } = require('chai');

const {
  SYNC_INTERVAL_MS,
  SkipReasons,
  EntryRecordKinds,
  HIPPO_FIELD_DEFINITIONS,
  normalizeTicketNumber,
  buildDescriptionBlock,
  applyDescriptionBlock,
  buildEntryCommentText,
  buildCommentIdFromDate,
  planEntries,
  getSkipReason,
  mergeFieldOptions,
  mergeTags,
  buildFieldContents,
  getPicks,
  planFieldChange,
} = require('../../utils/hippo-card-sync');

const TICKET = {
  number: '43643',
  subject: 'PE - INDIA',
  descriptionMarkdown: 'Luggage weight on apps',
  statusText: 'Pending from Dev',
  priority: 'Urgent',
  tags: ['Backend', 'Billing'],
  entries: [],
};

const BLOCK =
  '### Hippo #43643: PE - INDIA\n\nLuggage weight on apps\n\n— Imported from Hippo ticket #43643';

const ID_EPOCH_MS = 1567191600000;
const TWO_POW_23 = BigInt(8388608);

describe('hippo-card-sync', () => {
  describe('normalizeTicketNumber', () => {
    it('accepts a number with a leading # or spaces', () => {
      expect(normalizeTicketNumber('43643')).to.equal('43643');
      expect(normalizeTicketNumber(' #43643 ')).to.equal('43643');
    });

    it('refuses anything that is not a ticket number', () => {
      expect(normalizeTicketNumber('abc')).to.equal(null);
      expect(normalizeTicketNumber('1234567890123')).to.equal(null);
      expect(normalizeTicketNumber('')).to.equal(null);
      expect(normalizeTicketNumber(null)).to.equal(null);
    });
  });

  describe('description block', () => {
    it('builds the heading, description and footer', () => {
      expect(buildDescriptionBlock(TICKET)).to.equal(BLOCK);
    });

    it('leaves out an empty description and an empty subject', () => {
      expect(buildDescriptionBlock({ ...TICKET, subject: '', descriptionMarkdown: '' })).to.equal(
        '### Hippo #43643\n\n— Imported from Hippo ticket #43643',
      );
    });

    it('becomes the whole description of a card without one', () => {
      expect(applyDescriptionBlock(null, TICKET)).to.equal(BLOCK);
      expect(applyDescriptionBlock('  \n', TICKET)).to.equal(BLOCK);
    });

    it('goes after the card description', () => {
      expect(applyDescriptionBlock('My notes\n\n', TICKET)).to.equal(`My notes\n\n${BLOCK}`);
    });

    it('replaces only its own block, keeping text around it', () => {
      const description = `Before\n\n### Hippo #43643: Old\n\nOld text\n\n— Imported from Hippo ticket #43643\n\nAfter`;

      expect(applyDescriptionBlock(description, TICKET)).to.equal(`Before\n\n${BLOCK}\n\nAfter`);
    });

    it("leaves another ticket's block alone and adds its own", () => {
      const other = '### Hippo #431: Other\n\nText\n\n— Imported from Hippo ticket #431';

      expect(applyDescriptionBlock(other, TICKET)).to.equal(`${other}\n\n${BLOCK}`);
    });

    it('replaces a description imported before blocks had a heading', () => {
      expect(
        applyDescriptionBlock('Old text\n\n— Imported from Hippo ticket #43643', TICKET),
      ).to.equal(BLOCK);
    });

    it('keeps replacement patterns in the ticket text as they are', () => {
      const ticket = { ...TICKET, descriptionMarkdown: 'Costs $& and $1' };
      const description = `### Hippo #43643: Old\n\nOld\n\n— Imported from Hippo ticket #43643`;

      expect(applyDescriptionBlock(description, ticket)).to.include('Costs $& and $1');
    });
  });

  describe('buildEntryCommentText', () => {
    it('heads an entry with its kind and author', () => {
      expect(
        buildEntryCommentText({ kind: 'note', authorName: 'Harsh Sharma', markdown: 'Look' }),
      ).to.equal('**[Hippo Note] Harsh Sharma**\n\nLook');

      expect(buildEntryCommentText({ kind: 'comment', authorName: '', markdown: '' })).to.equal(
        '**[Hippo Comment]**',
      );
    });
  });

  describe('buildCommentIdFromDate', () => {
    const now = Date.parse('2026-10-09T00:00:00.000Z');

    it('encodes the date the way next_id() does', () => {
      const date = '2026-10-01T06:04:16.000Z';
      const id = BigInt(buildCommentIdFromDate(date, { now, sequence: 7 }));

      expect(id / TWO_POW_23).to.equal(BigInt(Date.parse(date) - ID_EPOCH_MS));
      expect((id / BigInt(1024)) % BigInt(8192)).to.equal(BigInt(1));
      expect(id % BigInt(1024)).to.equal(BigInt(7));
    });

    it('orders earlier dates first', () => {
      const earlier = BigInt(buildCommentIdFromDate('2026-09-29T21:38:47.000Z', { now }));
      const later = BigInt(buildCommentIdFromDate('2026-10-01T06:04:16.000Z', { now }));

      expect(earlier < later).to.equal(true);
    });

    it('gives up on missing, invalid, future and pre-epoch dates', () => {
      expect(buildCommentIdFromDate(null, { now })).to.equal(null);
      expect(buildCommentIdFromDate('soon', { now })).to.equal(null);
      expect(buildCommentIdFromDate('2027-01-01T00:00:00.000Z', { now })).to.equal(null);
      expect(buildCommentIdFromDate('2019-01-01T00:00:00.000Z', { now })).to.equal(null);
    });
  });

  describe('planEntries', () => {
    const note = { id: 'n1', kind: 'note', authorName: 'Harsh', markdown: 'Kindly look' };
    const comment = { id: 'c1', kind: 'comment', authorName: 'Harsh', markdown: 'Hi Client' };

    it('imports what the card does not have', () => {
      expect(planEntries({ entries: [note], records: [], comments: [] })).to.deep.equal({
        toImport: [note],
        toRecord: [],
      });
    });

    it('skips entries already recorded, imported or skipped', () => {
      const records = [
        { entryId: 'n1', kind: EntryRecordKinds.IMPORTED },
        { entryId: 'c1', kind: EntryRecordKinds.SKIPPED },
      ];

      expect(planEntries({ entries: [note, comment], records, comments: [] })).to.deep.equal({
        toImport: [],
        toRecord: [],
      });
    });

    it('recognizes entries imported before records were kept', () => {
      const comments = [{ id: '9', text: '**[Hippo Note] Harsh · Oct 1**\n\nKindly   look' }];

      expect(planEntries({ entries: [note], records: [], comments })).to.deep.equal({
        toImport: [],
        toRecord: [{ entryId: 'n1', kind: EntryRecordKinds.IMPORTED, commentId: '9' }],
      });
    });

    it('recognizes a note Planka pushed, mentions and all', () => {
      const pushed = {
        id: 'n2',
        kind: 'note',
        authorName: 'Business',
        markdown: 'Shankar (via Planka): Ask @Deepak about it',
      };

      const comments = [{ id: '5', text: 'Ask @[Deepak](123) about it' }];

      expect(planEntries({ entries: [pushed], records: [], comments })).to.deep.equal({
        toImport: [],
        toRecord: [{ entryId: 'n2', kind: EntryRecordKinds.IMPORTED, commentId: '5' }],
      });
    });

    it('recognizes a pushed note with escaped characters', () => {
      const pushed = {
        id: 'n3',
        kind: 'note',
        authorName: 'Business',
        markdown: 'Shankar (via Planka): Fix \\*all\\* the \\_ids\\_ in \\#12',
      };

      const comments = [{ id: '6', text: 'Fix *all* the _ids_ in #12' }];

      expect(planEntries({ entries: [pushed], records: [], comments }).toRecord).to.deep.equal([
        { entryId: 'n3', kind: EntryRecordKinds.IMPORTED, commentId: '6' },
      ]);
    });

    it('records entries left out of the chosen ones as skipped', () => {
      expect(
        planEntries({ entries: [note, comment], records: [], comments: [], entryIds: ['c1'] }),
      ).to.deep.equal({
        toImport: [comment],
        toRecord: [{ entryId: 'n1', kind: EntryRecordKinds.SKIPPED, commentId: null }],
      });
    });

    it('never matches an empty entry against comments', () => {
      const empty = { id: 'n4', kind: 'note', authorName: 'Harsh', markdown: '' };

      expect(
        planEntries({ entries: [empty], records: [], comments: [{ id: '1', text: 'x' }] }).toImport,
      ).to.deep.equal([empty]);
    });
  });

  describe('getSkipReason', () => {
    const now = Date.parse('2026-10-09T10:00:00.000Z');
    const syncRecord = { ticketNumber: '43643', syncedAt: '2026-10-09T09:59:00.000Z' };

    it('never skips a forced sync', () => {
      expect(getSkipReason({ syncRecord: null, ticketNumber: '43643', force: true, now })).to.equal(
        null,
      );
    });

    it('skips a card never synced, or synced for another ticket', () => {
      expect(getSkipReason({ syncRecord: null, ticketNumber: '43643', force: false, now })).to.equal(
        SkipReasons.NEVER_SYNCED,
      );

      expect(getSkipReason({ syncRecord, ticketNumber: '1', force: false, now })).to.equal(
        SkipReasons.OTHER_TICKET,
      );
    });

    it('skips a card synced within the interval', () => {
      expect(getSkipReason({ syncRecord, ticketNumber: '43643', force: false, now })).to.equal(
        SkipReasons.RECENT,
      );

      expect(
        getSkipReason({
          syncRecord,
          ticketNumber: '43643',
          force: false,
          now: Date.parse(syncRecord.syncedAt) + SYNC_INTERVAL_MS,
        }),
      ).to.equal(null);
    });
  });

  describe('fields', () => {
    const tagsDefinition = HIPPO_FIELD_DEFINITIONS.find(({ name }) => name === 'Tags');
    const priorityDefinition = HIPPO_FIELD_DEFINITIONS.find(({ name }) => name === 'Priority');
    const numberDefinition = HIPPO_FIELD_DEFINITIONS.find(({ name }) => name === 'Ticket #');

    it('merges options: the field first, then missing defaults and values', () => {
      expect(mergeFieldOptions(['Open', 'New'], ['New', 'Closed'], ['Reopened', null])).to.deep.equal(
        ['Open', 'New', 'Closed', 'Reopened'],
      );
    });

    it("adds Hippo's tags after the card's own", () => {
      expect(mergeTags('Apps, Backend', ['Backend', 'Billing'])).to.equal('Apps, Backend, Billing');
      expect(mergeTags(null, [])).to.equal(null);
    });

    it("takes the dialog's state over Hippo's, and leaves empty values out", () => {
      expect(
        buildFieldContents({ ticket: TICKET, ticketState: 'Closed', currentTags: 'Apps' }),
      ).to.deep.equal({
        'Ticket State': 'Closed',
        Priority: 'Urgent',
        Tags: 'Apps, Backend, Billing',
      });

      expect(
        buildFieldContents({
          ticket: { ...TICKET, statusText: null, priority: null, tags: [] },
          ticketState: null,
          currentTags: null,
        }),
      ).to.deep.equal({ 'Ticket State': null, Priority: null, Tags: null });
    });

    it('splits multi-select picks', () => {
      expect(getPicks(tagsDefinition, 'Apps, Backend')).to.deep.equal(['Apps', 'Backend']);
      expect(getPicks(priorityDefinition, 'Urgent')).to.deep.equal(['Urgent']);
      expect(getPicks(priorityDefinition, null)).to.deep.equal([]);
    });

    it('creates a missing field with its options', () => {
      expect(planFieldChange(priorityDefinition, undefined, ['Blocker'])).to.deep.equal({
        action: 'create',
        values: {
          name: 'Priority',
          type: 'dropdown',
          showOnFrontOfCard: false,
          options: ['Normal', 'Urgent', 'Critical', 'Blocker'],
        },
      });

      expect(planFieldChange(numberDefinition, undefined, [])).to.deep.equal({
        action: 'create',
        values: { name: 'Ticket #', type: 'text', showOnFrontOfCard: false, options: null },
      });
    });

    it('turns a text Priority into a dropdown and adds missing options', () => {
      expect(
        planFieldChange(priorityDefinition, { type: 'text', options: null }, ['Urgent']),
      ).to.deep.equal({
        action: 'update',
        values: { type: 'dropdown', options: ['Normal', 'Urgent', 'Critical'] },
      });

      expect(
        planFieldChange(
          priorityDefinition,
          { type: 'dropdown', options: ['Normal', 'Urgent', 'Critical'] },
          ['Blocker'],
        ),
      ).to.deep.equal({
        action: 'update',
        values: { type: 'dropdown', options: ['Normal', 'Urgent', 'Critical', 'Blocker'] },
      });
    });

    it('leaves a field that already fits alone', () => {
      expect(
        planFieldChange(
          priorityDefinition,
          { type: 'dropdown', options: ['Normal', 'Urgent', 'Critical'] },
          ['Urgent'],
        ),
      ).to.deep.equal({ action: 'none' });

      expect(planFieldChange(numberDefinition, { type: 'text' }, [])).to.deep.equal({
        action: 'none',
      });
    });
  });
});
```

In `server/test/utils/hippo.test.js`, replace the expectation in `getTicketValuesByCardId`'s test:

```js
      ).to.deep.equal({
        c1: {
          customFieldGroupId: 'g1',
          ticketNumber: '43886',
          ticketState: 'Closed',
          priority: null,
          ticketUrl: null,
          tags: null,
        },
        c3: {
          customFieldGroupId: 'g2',
          ticketNumber: '43934',
          ticketState: null,
          priority: null,
          ticketUrl: null,
          tags: null,
        },
      });
```

- [ ] **Step 3: Run the tests to watch them fail**

Run: `cd server && npx mocha test/utils/hippo-card-sync.test.js test/utils/hippo.test.js`
Expected: FAIL. The new file errors with `Cannot find module '../../utils/hippo-card-sync'`, and the `getTicketValuesByCardId` test fails on missing `customFieldGroupId`.

- [ ] **Step 4: Extend `server/utils/hippo.js`**

In `HippoFieldNames`, add `TAGS: 'Tags',` after `TICKET_URL`. In `FIELD_KEY_BY_NAME`, add `[HippoFieldNames.TAGS]: 'tags',`. Then, in `getTicketValuesByCardId`, change the group lookup and the result so they carry the group:

```js
  cards.forEach((card) => {
    const match = [
      ...hippoCustomFieldGroups.filter(
        (customFieldGroup) => customFieldGroup.boardId === card.boardId,
      ),
      ...hippoCustomFieldGroups.filter((customFieldGroup) => customFieldGroup.cardId === card.id),
    ]
      .map((customFieldGroup) => ({
        customFieldGroupId: customFieldGroup.id,
        values: valuesByGroupedCardId[`${card.id}:${customFieldGroup.id}`],
      }))
      .find(({ values }) => values && values.ticketNumber);

    if (match) {
      result[card.id] = {
        customFieldGroupId: match.customFieldGroupId,
        ticketNumber: match.values.ticketNumber,
        ticketState: match.values.ticketState || null,
        priority: match.values.priority || null,
        ticketUrl: match.values.ticketUrl || null,
        tags: match.values.tags || null,
      };
    }
  });
```

- [ ] **Step 5: Write `server/utils/hippo-card-sync.js`**

```js
/*!
 * Copyright (c) 2024 PLANKA Software GmbH
 * Licensed under the Fair Use License: https://github.com/plankanban/planka/blob/master/LICENSE.md
 */

const crypto = require('crypto');

const { Types: CustomFieldTypes } = require('../api/models/CustomField');
const { HippoFieldNames } = require('./hippo');
const { mentionMarkupToText } = require('./mentions');

// next_id(): milliseconds since this epoch, shifted past a 13-bit shard and a 10-bit sequence
const ID_EPOCH_MS = 1567191600000;
const ID_SHARD = 1;
const TWO_POW_23 = BigInt(8388608);
const TWO_POW_10 = BigInt(1024);

const SYNC_INTERVAL_MS = 2 * 60 * 1000;
const MULTISELECT_SEPARATOR = ', ';
const TICKET_NUMBER_REGEX = /^#?(\d{1,12})$/;
// buildNoteHtml writes "<author> (via Planka): <text>"; Hippo hands it back as Markdown
const PUSHED_NOTE_REGEX = /^.*? \(via Planka\): ([\s\S]*)$/;
const MARKDOWN_ESCAPE_REGEX = /\\([\\`*_{}[\]()#+\-.!>~|=])/g;

const SkipReasons = {
  NEVER_SYNCED: 'neverSynced',
  OTHER_TICKET: 'otherTicket',
  RECENT: 'recent',
  IN_PROGRESS: 'inProgress',
};

const EntryRecordKinds = {
  IMPORTED: 'imported',
  SKIPPED: 'skipped',
};

const ENTRY_LABEL_BY_KIND = {
  note: 'Hippo Note',
  comment: 'Hippo Comment',
};

// The client keeps the same lists (client/src/utils/hippo.js); the two must stay in step
const DEFAULT_TICKET_STATES = [
  'New',
  'Pending',
  'Acknowledged',
  'Pending from CSM',
  'Pending from Client',
  'Pending from Dev',
  'Client not Responsive',
  'In Progress',
  'Integration in Progress',
  'Feasibility Check',
  'Pending from QA',
  'Closed',
];

const DEFAULT_PRIORITIES = ['Normal', 'Urgent', 'Critical'];
const DEFAULT_TAGS = ['Apps', 'Backend', 'Frontend', 'Integration', 'Solutioning'];

// What a "Hippo Ticket" group holds, in order
const HIPPO_FIELD_DEFINITIONS = [
  {
    name: HippoFieldNames.TICKET_NUMBER,
    type: CustomFieldTypes.TEXT,
    showOnFrontOfCard: false,
  },
  {
    name: HippoFieldNames.TICKET_STATE,
    type: CustomFieldTypes.DROPDOWN,
    showOnFrontOfCard: true,
    defaultOptions: DEFAULT_TICKET_STATES,
  },
  {
    name: HippoFieldNames.PRIORITY,
    type: CustomFieldTypes.DROPDOWN,
    showOnFrontOfCard: false,
    defaultOptions: DEFAULT_PRIORITIES,
  },
  {
    name: HippoFieldNames.TAGS,
    type: CustomFieldTypes.MULTISELECT,
    showOnFrontOfCard: false,
    defaultOptions: DEFAULT_TAGS,
  },
  {
    name: HippoFieldNames.TICKET_URL,
    type: CustomFieldTypes.TEXT,
    showOnFrontOfCard: false,
  },
];

const escapeRegExp = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/* Ticket number */

const normalizeTicketNumber = (value) => {
  const match = (value || '').trim().match(TICKET_NUMBER_REGEX);
  return match ? match[1] : null;
};

/* Description */

const buildFooter = (ticketNumber) => `— Imported from Hippo ticket #${ticketNumber}`;

const buildDescriptionBlock = (ticket) => {
  const heading = ticket.subject
    ? `### Hippo #${ticket.number}: ${ticket.subject}`
    : `### Hippo #${ticket.number}`;

  return [heading, ticket.descriptionMarkdown, buildFooter(ticket.number)]
    .filter(Boolean)
    .join('\n\n');
};

// The card's text stays; only this ticket's block is written. A card imported before blocks had
// a heading ends with the bare footer, and all of its description was the import.
const applyDescriptionBlock = (description, ticket) => {
  const block = buildDescriptionBlock(ticket);
  const text = description || '';
  const number = escapeRegExp(ticket.number);

  const blockRegex = new RegExp(
    `^### Hippo #${number}(?::[^\\n]*)?$[\\s\\S]*?^${escapeRegExp(buildFooter(ticket.number))}$`,
    'm',
  );

  if (blockRegex.test(text)) {
    return text.replace(blockRegex, () => block);
  }

  if (new RegExp(`(^|\\n)${escapeRegExp(buildFooter(ticket.number))}\\s*$`).test(text)) {
    return block;
  }

  const trimmedText = text.replace(/\s+$/, '');
  return trimmedText ? `${trimmedText}\n\n${block}` : block;
};

/* Comments */

const buildEntryCommentText = (entry) => {
  const header = `**[${ENTRY_LABEL_BY_KIND[entry.kind]}]${
    entry.authorName ? ` ${entry.authorName}` : ''
  }**`;

  return entry.markdown ? `${header}\n\n${entry.markdown}` : header;
};

// An id that sorts the comment by its Hippo date; null when the date cannot place it
const buildCommentIdFromDate = (
  date,
  { now = Date.now(), sequence = crypto.randomInt(1024) } = {},
) => {
  const milliseconds = date ? new Date(date).getTime() : NaN;

  if (!Number.isFinite(milliseconds) || milliseconds <= ID_EPOCH_MS || milliseconds > now) {
    return null;
  }

  return (
    BigInt(milliseconds - ID_EPOCH_MS) * TWO_POW_23 +
    BigInt(ID_SHARD) * TWO_POW_10 +
    BigInt(sequence)
  ).toString();
};

// Turndown escapes Markdown characters and Planka keeps mentions as markup, so both sides are
// compared as plain words
const normalizeText = (text) =>
  mentionMarkupToText(text || '')
    .replace(MARKDOWN_ESCAPE_REGEX, '$1')
    .replace(/\s+/g, ' ')
    .trim();

const getComparableText = (entry) => {
  const match = entry.kind === 'note' && entry.markdown.match(PUSHED_NOTE_REGEX);
  return normalizeText(match ? match[1] : entry.markdown);
};

/**
 * Sorts the ticket's notes and comments into those the card has and those it needs. Recorded
 * entries are done with. An entry whose text a comment already holds was imported before records
 * were kept, or is a Planka comment that went to Hippo as a note; it gets a record. Entries left
 * out of entryIds are recorded as skipped. The rest are imported.
 */
const planEntries = ({ entries, records, comments, entryIds }) => {
  const recordedEntryIds = new Set(records.map((record) => record.entryId));

  const commentTexts = comments.map((comment) => ({
    id: comment.id,
    text: normalizeText(comment.text),
  }));

  const result = {
    toImport: [],
    toRecord: [],
  };

  entries.forEach((entry) => {
    if (recordedEntryIds.has(entry.id)) {
      return;
    }

    const text = getComparableText(entry);
    const comment = text && commentTexts.find((commentText) => commentText.text.includes(text));

    if (comment) {
      result.toRecord.push({
        entryId: entry.id,
        kind: EntryRecordKinds.IMPORTED,
        commentId: comment.id,
      });

      return;
    }

    if (entryIds && !entryIds.includes(entry.id)) {
      result.toRecord.push({
        entryId: entry.id,
        kind: EntryRecordKinds.SKIPPED,
        commentId: null,
      });

      return;
    }

    result.toImport.push(entry);
  });

  return result;
};

/* Sync timing */

const getSkipReason = ({ syncRecord, ticketNumber, force, now }) => {
  if (force) {
    return null;
  }

  if (!syncRecord) {
    return SkipReasons.NEVER_SYNCED;
  }

  if (syncRecord.ticketNumber !== ticketNumber) {
    return SkipReasons.OTHER_TICKET;
  }

  if (now - new Date(syncRecord.syncedAt).getTime() < SYNC_INTERVAL_MS) {
    return SkipReasons.RECENT;
  }

  return null;
};

/* Fields */

const mergeFieldOptions = (existingOptions, defaultOptions, values) =>
  [...(existingOptions || []), ...defaultOptions, ...values].reduce(
    (result, option) => (option && !result.includes(option) ? [...result, option] : result),
    [],
  );

const splitPicks = (content) => (content ? content.split(MULTISELECT_SEPARATOR) : []);

const mergeTags = (content, tags) => {
  const picks = splitPicks(content);
  const merged = [...picks, ...tags.filter((tag) => !picks.includes(tag))];

  return merged.length > 0 ? merged.join(MULTISELECT_SEPARATOR) : null;
};

// What the sync writes into the group; Ticket # and Ticket URL are never touched
const buildFieldContents = ({ ticket, ticketState, currentTags }) => ({
  [HippoFieldNames.TICKET_STATE]: ticketState || ticket.statusText || null,
  [HippoFieldNames.PRIORITY]: ticket.priority || null,
  [HippoFieldNames.TAGS]: mergeTags(currentTags, ticket.tags || []),
});

const getPicks = (definition, content) => {
  if (!content) {
    return [];
  }

  return definition.type === CustomFieldTypes.MULTISELECT ? splitPicks(content) : [content];
};

// A choice field takes the type it is defined with, and whatever options it lacks
const planFieldChange = (definition, customField, picks) => {
  const { defaultOptions, ...values } = definition;

  if (!customField) {
    return {
      action: 'create',
      values: {
        ...values,
        options: defaultOptions ? mergeFieldOptions(null, defaultOptions, picks) : null,
      },
    };
  }

  if (!defaultOptions) {
    return {
      action: 'none',
    };
  }

  const isSameType = customField.type === definition.type;
  const existingOptions = isSameType ? customField.options || [] : [];
  const options = mergeFieldOptions(existingOptions, defaultOptions, picks);

  if (isSameType && options.length === existingOptions.length) {
    return {
      action: 'none',
    };
  }

  return {
    action: 'update',
    values: {
      type: definition.type,
      options,
    },
  };
};

module.exports = {
  SYNC_INTERVAL_MS,
  SkipReasons,
  EntryRecordKinds,
  HIPPO_FIELD_DEFINITIONS,
  normalizeTicketNumber,
  buildDescriptionBlock,
  applyDescriptionBlock,
  buildEntryCommentText,
  buildCommentIdFromDate,
  planEntries,
  getSkipReason,
  mergeFieldOptions,
  mergeTags,
  buildFieldContents,
  getPicks,
  planFieldChange,
};
```

- [ ] **Step 6: Run the tests to watch them pass**

Run: `cd server && npx mocha test/utils/hippo-card-sync.test.js test/utils/hippo.test.js test/utils/custom-fields.test.js test/utils/hippo-errors.test.js`
Expected: all passing, 0 failing.

- [ ] **Step 7: Lint and commit**

Run: `cd server && npx eslint utils/hippo-card-sync.js utils/hippo.js test/utils/hippo-card-sync.test.js test/utils/hippo.test.js`
Expected: no output.

Run `gitnexus_detect_changes({scope: "all", repo: "planka"})`, then:

```bash
git add server/utils/hippo-card-sync.js server/utils/hippo.js server/test/utils/hippo-card-sync.test.js server/test/utils/hippo.test.js
git commit -m "hippo: merge rules for syncing a card from its ticket"
```

---

### Task 2: Tables, models and query methods

**Files:**
- Create: `server/db/migrations/20261009000000_add_hippo_card_sync.js`
- Create: `server/api/models/HippoCardEntry.js`, `server/api/models/HippoCardSync.js`
- Create: `server/api/hooks/query-methods/models/HippoCardEntry.js`, `server/api/hooks/query-methods/models/HippoCardSync.js`
- Modify: `server/api/helpers/cards/delete-related.js` (after the `Comment.qm.delete` call)

**Interfaces:**
- Consumes: `EntryRecordKinds` (Task 1).
- Produces:
  - `HippoCardEntry.qm.getByCardIdAndTicketNumber(cardId, ticketNumber) → record[]`.
  - `HippoCardEntry.qm.createOne(values) → record|null` (null when the unique index refuses it).
  - `HippoCardEntry.qm.updateOne(id, values)`.
  - `HippoCardEntry.qm.delete(criteria)`.
  - `HippoCardSync.qm.getOneByCardId(cardId) → record|null`.
  - `HippoCardSync.qm.createOrUpdateOne(cardId, values) → record`.
  - `HippoCardSync.qm.delete(criteria)`.
  - The records' attributes are `cardId`, `ticketNumber`, `entryId`, `commentId`, `kind` (entries) and `cardId`, `ticketNumber`, `syncedAt` (sync).

- [ ] **Step 1: Impact check**

Run `gitnexus_impact({target: "delete-related.js", direction: "upstream", repo: "planka"})` for `server/api/helpers/cards/delete-related.js`, and report the callers (the card deletion paths). The change only adds two deletions at the end.

- [ ] **Step 2: Write the migration**

```js
/*!
 * Copyright (c) 2024 PLANKA Software GmbH
 * Licensed under the Fair Use License: https://github.com/plankanban/planka/blob/master/LICENSE.md
 */

// Which Hippo notes and comments each card has, so a sync never brings one in twice, and when
// each card was last synced, so refreshes on open stay a few minutes apart
module.exports.up = async (knex) => {
  await knex.schema.createTable('hippo_card_entry', (table) => {
    /* Columns */

    table.bigInteger('id').primary().defaultTo(knex.raw('next_id()'));

    table.bigInteger('card_id').notNullable();
    table.bigInteger('comment_id');

    table.text('ticket_number').notNullable();
    table.text('entry_id').notNullable();
    table.text('kind').notNullable();

    table.timestamp('created_at', true);
    table.timestamp('updated_at', true);

    /* Indexes */

    table.unique(['card_id', 'ticket_number', 'entry_id']);
  });

  return knex.schema.createTable('hippo_card_sync', (table) => {
    /* Columns */

    table.bigInteger('id').primary().defaultTo(knex.raw('next_id()'));

    table.bigInteger('card_id').notNullable();

    table.text('ticket_number').notNullable();
    table.timestamp('synced_at', true).notNullable();

    table.timestamp('created_at', true);
    table.timestamp('updated_at', true);

    /* Indexes */

    table.unique('card_id');
  });
};

module.exports.down = async (knex) => {
  await knex.schema.dropTable('hippo_card_sync');

  return knex.schema.dropTable('hippo_card_entry');
};
```

- [ ] **Step 3: Write the models**

`server/api/models/HippoCardEntry.js`:

```js
/*!
 * Copyright (c) 2024 PLANKA Software GmbH
 * Licensed under the Fair Use License: https://github.com/plankanban/planka/blob/master/LICENSE.md
 */

/**
 * HippoCardEntry.js
 *
 * @description :: A Hippo note or comment a card already has, imported or deliberately left out.
 * @docs        :: https://sailsjs.com/docs/concepts/models-and-orm/models
 */

const Kinds = {
  IMPORTED: 'imported',
  SKIPPED: 'skipped',
};

module.exports = {
  Kinds,

  attributes: {
    //  ╔═╗╦═╗╦╔╦╗╦╔╦╗╦╦  ╦╔═╗╔═╗
    //  ╠═╝╠╦╝║║║║║ ║ ║╚╗╔╝║╣ ╚═╗
    //  ╩  ╩╚═╩╩ ╩╩ ╩ ╩ ╚╝ ╚═╝╚═╝

    ticketNumber: {
      type: 'string',
      required: true,
      columnName: 'ticket_number',
    },
    entryId: {
      type: 'string',
      required: true,
      columnName: 'entry_id',
    },
    kind: {
      type: 'string',
      isIn: Object.values(Kinds),
      required: true,
    },

    //  ╔═╗╔╦╗╔╗ ╔═╗╔╦╗╔═╗
    //  ║╣ ║║║╠╩╗║╣  ║║╚═╗
    //  ╚═╝╩ ╩╚═╝╚═╝═╩╝╚═╝

    //  ╔═╗╔═╗╔═╗╔═╗╔═╗╦╔═╗╔╦╗╦╔═╗╔╗╔╔═╗
    //  ╠═╣╚═╗╚═╗║ ║║  ║╠═╣ ║ ║║ ║║║║╚═╗
    //  ╩ ╩╚═╝╚═╝╚═╝╚═╝╩╩ ╩ ╩ ╩╚═╝╝╚╝╚═╝

    cardId: {
      model: 'Card',
      required: true,
      columnName: 'card_id',
    },
    commentId: {
      model: 'Comment',
      columnName: 'comment_id',
    },
  },

  tableName: 'hippo_card_entry',
};
```

`server/api/models/HippoCardSync.js`:

```js
/*!
 * Copyright (c) 2024 PLANKA Software GmbH
 * Licensed under the Fair Use License: https://github.com/plankanban/planka/blob/master/LICENSE.md
 */

/**
 * HippoCardSync.js
 *
 * @description :: When a card was last synced from its Hippo ticket, and for which ticket.
 * @docs        :: https://sailsjs.com/docs/concepts/models-and-orm/models
 */

module.exports = {
  attributes: {
    //  ╔═╗╦═╗╦╔╦╗╦╔╦╗╦╦  ╦╔═╗╔═╗
    //  ╠═╝╠╦╝║║║║║ ║ ║╚╗╔╝║╣ ╚═╗
    //  ╩  ╩╚═╩╩ ╩╩ ╩ ╩ ╚╝ ╚═╝╚═╝

    ticketNumber: {
      type: 'string',
      required: true,
      columnName: 'ticket_number',
    },
    syncedAt: {
      type: 'ref',
      required: true,
      columnName: 'synced_at',
    },

    //  ╔═╗╔╦╗╔╗ ╔═╗╔╦╗╔═╗
    //  ║╣ ║║║╠╩╗║╣  ║║╚═╗
    //  ╚═╝╩ ╩╚═╝╚═╝═╩╝╚═╝

    //  ╔═╗╔═╗╔═╗╔═╗╔═╗╦╔═╗╔╦╗╦╔═╗╔╗╔╔═╗
    //  ╠═╣╚═╗╚═╗║ ║║  ║╠═╣ ║ ║║ ║║║║╚═╗
    //  ╩ ╩╚═╝╚═╝╚═╝╚═╝╩╩ ╩ ╩ ╩╚═╝╝╚╝╚═╝

    cardId: {
      model: 'Card',
      required: true,
      columnName: 'card_id',
    },
  },

  tableName: 'hippo_card_sync',
};
```

- [ ] **Step 4: Write the query methods**

`server/api/hooks/query-methods/models/HippoCardEntry.js`:

```js
/*!
 * Copyright (c) 2024 PLANKA Software GmbH
 * Licensed under the Fair Use License: https://github.com/plankanban/planka/blob/master/LICENSE.md
 */

const getByCardIdAndTicketNumber = (cardId, ticketNumber) =>
  HippoCardEntry.find({
    cardId,
    ticketNumber,
  });

// Null when the card already has a record of the entry, which another sync may have just made
const createOne = async (values) => {
  try {
    return await HippoCardEntry.create({ ...values }).fetch();
  } catch (error) {
    if (error.code === 'E_UNIQUE') {
      return null;
    }

    throw error;
  }
};

const updateOne = (id, values) => HippoCardEntry.updateOne(id).set({ ...values });

// eslint-disable-next-line no-underscore-dangle
const delete_ = (criteria) => HippoCardEntry.destroy(criteria).fetch();

module.exports = {
  getByCardIdAndTicketNumber,
  createOne,
  updateOne,
  delete: delete_,
};
```

`server/api/hooks/query-methods/models/HippoCardSync.js`:

```js
/*!
 * Copyright (c) 2024 PLANKA Software GmbH
 * Licensed under the Fair Use License: https://github.com/plankanban/planka/blob/master/LICENSE.md
 */

const getOneByCardId = (cardId) =>
  HippoCardSync.findOne({
    cardId,
  });

// One record per card: syncing again replaces it
const createOrUpdateOne = async (cardId, values) => {
  const hippoCardSync = await getOneByCardId(cardId);

  if (hippoCardSync) {
    return HippoCardSync.updateOne(hippoCardSync.id).set({ ...values });
  }

  return HippoCardSync.create({
    ...values,
    cardId,
  }).fetch();
};

// eslint-disable-next-line no-underscore-dangle
const delete_ = (criteria) => HippoCardSync.destroy(criteria).fetch();

module.exports = {
  getOneByCardId,
  createOrUpdateOne,
  delete: delete_,
};
```

- [ ] **Step 5: Delete them with the card**

In `server/api/helpers/cards/delete-related.js`, add the following directly after the `await Comment.qm.delete({ cardId: cardIdOrIds });` block:

```js
    await HippoCardEntry.qm.delete({
      cardId: cardIdOrIds,
    });

    await HippoCardSync.qm.delete({
      cardId: cardIdOrIds,
    });
```

- [ ] **Step 6: Check the files load and lint**

Run:

```bash
cd server && node -e "require('./db/migrations/20261009000000_add_hippo_card_sync.js'); require('./api/models/HippoCardEntry.js'); require('./api/models/HippoCardSync.js'); require('./api/hooks/query-methods/models/HippoCardEntry.js'); require('./api/hooks/query-methods/models/HippoCardSync.js'); console.log('ok')"
```

Expected: `ok`.

Then run `cd server && npm run lint`.
Expected: `✔  Your .js files look good.`

- [ ] **Step 7: Commit**

Run `gitnexus_detect_changes({scope: "all", repo: "planka"})`, then:

```bash
git add server/db/migrations/20261009000000_add_hippo_card_sync.js server/api/models/HippoCardEntry.js server/api/models/HippoCardSync.js server/api/hooks/query-methods/models/HippoCardEntry.js server/api/hooks/query-methods/models/HippoCardSync.js server/api/helpers/cards/delete-related.js
git commit -m "hippo: tables for card sync records"
```

---

### Task 3: Backdated comments and the helper that writes a ticket into a card

**Files:**
- Modify: `server/api/hooks/query-methods/models/Comment.js` (`createOne`, plus the new `getAllByCardId`)
- Modify: `server/api/helpers/comments/create-one.js` (the `inputs` block and the `Comment.qm.createOne` call)
- Create: `server/api/helpers/hippo/apply-ticket-to-card.js`

**Interfaces:**
- Consumes:
  - From Task 1: `HIPPO_FIELD_DEFINITIONS`, `EntryRecordKinds`, `applyDescriptionBlock`, `buildEntryCommentText`, `buildCommentIdFromDate`, `planEntries`, `buildFieldContents`, `getPicks`, `planFieldChange`.
  - From Task 2: `HippoCardEntry.qm.*`.
  - From `server/utils/hippo.js`: `HippoFieldNames`.
  - From `server/constants.js`: `POSITION_GAP`.
- Produces:
  - `Comment.qm.createOne(values, { createdAt }?)`.
  - `Comment.qm.getAllByCardId(cardId)`.
  - `sails.helpers.comments.createOne.with({ ..., createdAt })` takes an optional ISO string.
  - `sails.helpers.hippo.applyTicketToCard.with({ card, list, board, project, ticket, customFieldGroupId, users, ticketState, entryIds, actorUser, request }) → { warnings: string[] }`. Here `ticket` is `mapTicket` output whose `assignees` have already been through `matchAssignees`, so each has a `userId`, and `users` are the board's active users.

- [ ] **Step 1: Impact check**

Run `gitnexus_impact({target: "createOne", direction: "upstream", repo: "planka"})` scoped to `server/api/hooks/query-methods/models/Comment.js`. If the name is ambiguous, run `grep -rn "Comment.qm.createOne" server/api` and report the callers: the `comments/create-one` helper only. Then run the same impact check for `server/api/helpers/comments/create-one.js`, whose callers are the comment create controller and card duplication, if present. Both changes are additive: an optional second argument, and an optional input.

- [ ] **Step 2: Let a comment carry its own date**

In `server/api/hooks/query-methods/models/Comment.js`, replace `createOne` and add `getAllByCardId`:

```js
// A comment imported from elsewhere keeps its original time. The model's beforeCreate always
// stamps now, so that time is written right after, in the same transaction.
const createOne = (values, { createdAt } = {}) =>
  sails.getDatastore().transaction(async (db) => {
    const comment = await Comment.create({ ...values })
      .fetch()
      .usingConnection(db);

    if (createdAt) {
      await sails
        .sendNativeQuery('UPDATE comment SET created_at = $1 WHERE id = $2', [
          createdAt,
          comment.id,
        ])
        .usingConnection(db);

      comment.createdAt = createdAt;
    }

    const queryResult = await sails
      .sendNativeQuery(
        'UPDATE card SET comments_total = comments_total + 1, updated_at = $1 WHERE id = $2',
        [new Date().toISOString(), comment.cardId],
      )
      .usingConnection(db);

    if (queryResult.rowCount === 0) {
      throw 'cardNotFound';
    }

    return comment;
  });
```

```js
// Every comment of the card, not just a page of them
const getAllByCardId = (cardId) => defaultFind({ cardId });
```

Add `getAllByCardId,` to `module.exports` after `getByCardId,`.

- [ ] **Step 3: Pass the date through the comment helper**

In `server/api/helpers/comments/create-one.js`, add this to `inputs` before `request`:

```js
    // An imported comment's original time, as an ISO string
    createdAt: {
      type: 'string',
    },
```

Then change the create call to:

```js
    const comment = await Comment.qm.createOne(
      {
        ...values,
        cardId: values.card.id,
        userId: values.user.id,
      },
      {
        createdAt: inputs.createdAt,
      },
    );
```

- [ ] **Step 4: Write `server/api/helpers/hippo/apply-ticket-to-card.js`**

```js
/*!
 * Copyright (c) 2024 PLANKA Software GmbH
 * Licensed under the Fair Use License: https://github.com/plankanban/planka/blob/master/LICENSE.md
 */

const { POSITION_GAP } = require('../../../constants');
const { HippoFieldNames } = require('../../../utils/hippo');
const {
  EntryRecordKinds,
  HIPPO_FIELD_DEFINITIONS,
  applyDescriptionBlock,
  buildCommentIdFromDate,
  buildEntryCommentText,
  buildFieldContents,
  getPicks,
  planEntries,
  planFieldChange,
} = require('../../../utils/hippo-card-sync');

const MAX_ID_ATTEMPTS = 3;

const Warnings = {
  DESCRIPTION_NOT_SAVED: 'descriptionNotSaved',
  FIELDS_NOT_SAVED: 'fieldsNotSaved',
  MEMBER_NOT_ADDED: 'memberNotAdded',
  COMMENT_NOT_ADDED: 'commentNotAdded',
};

const updateDescription = async ({ card, list, board, project, ticket, actorUser, request }) => {
  const description = applyDescriptionBlock(card.description, ticket);

  if (description === card.description) {
    return;
  }

  await sails.helpers.cards.updateOne.with({
    record: card,
    values: {
      description,
    },
    project,
    board,
    list,
    actorUser,
    request,
  });
};

// The group gets whichever fields and options it lacks, then the ticket's State, Priority and Tags
const updateFields = async ({
  card,
  list,
  board,
  project,
  ticket,
  customFieldGroupId,
  ticketState,
  actorUser,
  request,
}) => {
  const customFieldGroup = await CustomFieldGroup.qm.getOneById(customFieldGroupId);
  const customFields = await CustomField.qm.getByCustomFieldGroupId(customFieldGroupId);

  const customFieldValues = await CustomFieldValue.qm.getByCardIds([card.id], {
    customFieldGroupIdOrIds: customFieldGroupId,
  });

  const getContent = (customField) => {
    const customFieldValue =
      customField &&
      customFieldValues.find(
        (customFieldValueItem) => customFieldValueItem.customFieldId === customField.id,
      );

    return customFieldValue ? customFieldValue.content : null;
  };

  const contents = buildFieldContents({
    ticket,
    ticketState,
    currentTags: getContent(customFields.find(({ name }) => name === HippoFieldNames.TAGS)),
  });

  let lastPosition = customFields.reduce(
    (result, customField) => Math.max(result, customField.position),
    0,
  );

  // eslint-disable-next-line no-restricted-syntax
  for (const definition of HIPPO_FIELD_DEFINITIONS) {
    let customField = customFields.find(({ name }) => name === definition.name);
    const content = contents[definition.name] || null;
    const change = planFieldChange(definition, customField, getPicks(definition, content));

    if (change.action === 'create') {
      lastPosition += POSITION_GAP;

      // eslint-disable-next-line no-await-in-loop
      customField = await sails.helpers.customFields.createOneInCustomFieldGroup.with({
        project,
        board,
        list,
        card,
        values: {
          ...change.values,
          position: lastPosition,
          customFieldGroup,
        },
        actorUser,
        request,
      });
    } else if (change.action === 'update') {
      // eslint-disable-next-line no-await-in-loop
      customField = await sails.helpers.customFields.updateOneInCustomFieldGroup.with({
        record: customField,
        values: change.values,
        project,
        board,
        list,
        card,
        customFieldGroup,
        actorUser,
        request,
      });
    }

    if (customField && content && content !== getContent(customField)) {
      // eslint-disable-next-line no-await-in-loop
      await sails.helpers.customFieldValues.createOrUpdateOne.with({
        project,
        board,
        list,
        values: {
          card,
          customFieldGroup,
          customField,
          content,
        },
        actorUser,
        request,
      });
    }
  }
};

// Assignees on the board join the card; nobody leaves it
const addMembers = async ({ card, list, board, project, ticket, users, actorUser, request }) => {
  const cardMemberships = await CardMembership.qm.getByCardId(card.id);
  const memberUserIds = sails.helpers.utils.mapRecords(cardMemberships, 'userId');

  const userIds = _.uniq(
    ticket.assignees.flatMap((assignee) => (assignee.userId ? [assignee.userId] : [])),
  ).filter((userId) => !memberUserIds.includes(userId));

  let isComplete = true;

  // eslint-disable-next-line no-restricted-syntax
  for (const userId of userIds) {
    const user = users.find((userItem) => userItem.id === userId);

    try {
      // eslint-disable-next-line no-await-in-loop
      await sails.helpers.cardMemberships.createOne.with({
        project,
        board,
        list,
        values: {
          card,
          user,
        },
        actorUser,
        request,
      });
    } catch (error) {
      isComplete = false;
    }
  }

  return isComplete;
};

// The comment takes an id built from its Hippo date, so it sorts among the card's comments by
// that date. An id another comment already has is retried, then left to the database.
const createEntryComment = async ({ card, list, board, project, entry, actorUser, request }) => {
  const createdAt = buildCommentIdFromDate(entry.date) ? new Date(entry.date).toISOString() : null;

  for (let attempt = 0; attempt <= MAX_ID_ATTEMPTS; attempt += 1) {
    const id = attempt < MAX_ID_ATTEMPTS ? buildCommentIdFromDate(entry.date) : null;

    try {
      // eslint-disable-next-line no-await-in-loop
      return await sails.helpers.comments.createOne.with({
        values: {
          ...(id && {
            id,
          }),
          text: buildEntryCommentText(entry),
          card,
          user: actorUser,
        },
        project,
        board,
        list,
        createdAt: createdAt || undefined,
        request,
      });
    } catch (error) {
      if (!id || error.code !== 'E_UNIQUE') {
        throw error;
      }
    }
  }

  return null;
};

// Each new entry's record goes in before its comment: the unique index lets only one sync claim
// an entry, so two syncs at once never post it twice
const importEntries = async ({
  card,
  list,
  board,
  project,
  ticket,
  entryIds,
  actorUser,
  request,
}) => {
  const records = await HippoCardEntry.qm.getByCardIdAndTicketNumber(card.id, ticket.number);
  const comments = await Comment.qm.getAllByCardId(card.id);

  const { toImport, toRecord } = planEntries({
    entries: ticket.entries,
    records,
    comments,
    entryIds,
  });

  // eslint-disable-next-line no-restricted-syntax
  for (const { entryId, kind, commentId } of toRecord) {
    // eslint-disable-next-line no-await-in-loop
    await HippoCardEntry.qm.createOne({
      cardId: card.id,
      ticketNumber: ticket.number,
      entryId,
      kind,
      commentId,
    });
  }

  let isComplete = true;

  // eslint-disable-next-line no-restricted-syntax
  for (const entry of toImport) {
    // eslint-disable-next-line no-await-in-loop
    const record = await HippoCardEntry.qm.createOne({
      cardId: card.id,
      ticketNumber: ticket.number,
      entryId: entry.id,
      kind: EntryRecordKinds.IMPORTED,
    });

    if (record) {
      try {
        // eslint-disable-next-line no-await-in-loop
        const comment = await createEntryComment({
          card,
          list,
          board,
          project,
          entry,
          actorUser,
          request,
        });

        // eslint-disable-next-line no-await-in-loop
        await HippoCardEntry.qm.updateOne(record.id, {
          commentId: comment.id,
        });
      } catch (error) {
        // The entry is tried again on the next sync
        // eslint-disable-next-line no-await-in-loop
        await HippoCardEntry.qm.delete({
          id: record.id,
        });

        isComplete = false;
      }
    }
  }

  return isComplete;
};

// Each step saves on its own, so one failing (a member who left the board, say) leaves the rest
const runStep = async (step, inputs, warning, warnings) => {
  try {
    const isComplete = await step(inputs);

    if (isComplete === false) {
      warnings.push(warning);
    }
  } catch (error) {
    sails.log.warn(`Hippo sync of card ${inputs.card.id}: ${warning}`, error);
    warnings.push(warning);
  }
};

module.exports = {
  inputs: {
    card: {
      type: 'ref',
      required: true,
    },
    list: {
      type: 'ref',
      required: true,
    },
    board: {
      type: 'ref',
      required: true,
    },
    project: {
      type: 'ref',
      required: true,
    },
    ticket: {
      type: 'ref',
      required: true,
    },
    customFieldGroupId: {
      type: 'string',
      required: true,
    },
    users: {
      type: 'ref',
      required: true,
    },
    ticketState: {
      type: 'string',
    },
    entryIds: {
      type: 'ref',
    },
    actorUser: {
      type: 'ref',
      required: true,
    },
    request: {
      type: 'ref',
    },
  },

  async fn(inputs) {
    const warnings = [];

    // ---- Step 1: Write the ticket's block into the description ----
    await runStep(updateDescription, inputs, Warnings.DESCRIPTION_NOT_SAVED, warnings);

    // ---- Step 2: Set State, Priority and Tags ----
    await runStep(updateFields, inputs, Warnings.FIELDS_NOT_SAVED, warnings);

    // ---- Step 3: Add assignees as members ----
    await runStep(addMembers, inputs, Warnings.MEMBER_NOT_ADDED, warnings);

    // ---- Step 4: Add new notes and comments, placed by date ----
    await runStep(importEntries, inputs, Warnings.COMMENT_NOT_ADDED, warnings);

    return {
      warnings,
    };
  },
};
```

- [ ] **Step 5: Check the query method names this helper calls exist**

Run:

```bash
cd server && grep -n "^const getOneById\|^const getByCustomFieldGroupId\|^const getByCardIds\|^const getByCardId\b" api/hooks/query-methods/models/CustomFieldGroup.js api/hooks/query-methods/models/CustomField.js api/hooks/query-methods/models/CustomFieldValue.js api/hooks/query-methods/models/CardMembership.js
```

Expected:
- `CustomFieldGroup.js` has `getOneById`
- `CustomField.js` has `getByCustomFieldGroupId`
- `CustomFieldValue.js` has `getByCardIds`
- `CardMembership.js` has `getByCardId`

If a name differs, use the existing name in the helper and ledger the ruling.

- [ ] **Step 6: Lint, load check, commit**

Run `cd server && npm run lint`.
Expected: `✔  Your .js files look good.`

Run `cd server && node -e "require('./api/helpers/hippo/apply-ticket-to-card.js'); console.log('ok')"`.
Expected: `ok`.

Run `cd server && npx mocha test/utils/hippo-card-sync.test.js test/utils/hippo.test.js`.
Expected: all passing.

Run `gitnexus_detect_changes({scope: "all", repo: "planka"})`, then:

```bash
git add server/api/hooks/query-methods/models/Comment.js server/api/helpers/comments/create-one.js server/api/helpers/hippo/apply-ticket-to-card.js
git commit -m "hippo: write a fetched ticket into a card, comments by date"
```

---

### Task 4: The sync endpoint

**Files:**
- Create: `server/api/controllers/hippo/sync-card.js`
- Modify: `server/config/routes.js` (next to `'POST /api/cards/:cardId/hippo-sync/note'`)

**Interfaces:**
- Consumes:
  - `getSkipReason`, `SkipReasons`, `normalizeTicketNumber` (Task 1).
  - `HippoCardSync.qm.*` (Task 2).
  - `sails.helpers.hippo.applyTicketToCard` (Task 3).
  - Existing: `sails.helpers.cards.getPathToProjectById`, `sails.helpers.hippo.getTicketValuesByCards`, `getAppSecretKey`, `fetchTicket`, `mapTicket`, `matchAssignees`, and `HippoErrors`, `HIPPO_ERROR_EXITS`, `interceptHippoExits`.
- Produces: `POST /api/cards/:cardId/hippo-sync` with body `{ force?: boolean, entryIds?: string[], ticketState?: string }`. It answers `{ item: { cardId, ticketNumber, hasSynced, syncedAt, isSkipped, warnings } }`.

- [ ] **Step 1: Write the controller**

```js
/*!
 * Copyright (c) 2024 PLANKA Software GmbH
 * Licensed under the Fair Use License: https://github.com/plankanban/planka/blob/master/LICENSE.md
 */

const { idInput } = require('../../../utils/inputs');
const { mapTicket, matchAssignees } = require('../../../utils/hippo');
const {
  SkipReasons,
  getSkipReason,
  normalizeTicketNumber,
} = require('../../../utils/hippo-card-sync');
const {
  HippoErrors,
  HIPPO_ERROR_EXITS,
  interceptHippoExits,
} = require('../../../utils/hippo-errors');

const MAX_ENTRY_IDS = 1000;

const Errors = {
  NOT_ENOUGH_RIGHTS: {
    notEnoughRights: 'Not enough rights',
  },
  CARD_NOT_FOUND: {
    cardNotFound: 'Card not found',
  },
  NOT_A_TICKET_CARD: {
    notATicketCard: 'Not a ticket card',
  },
};

// Cards this server process is syncing right now; another request for one of them is skipped
const syncingCardIds = new Set();

const buildItem = (card, ticketNumber, syncRecord, extra) => {
  const isSameTicket = !!syncRecord && syncRecord.ticketNumber === ticketNumber;

  return {
    cardId: card.id,
    ticketNumber,
    hasSynced: isSameTicket,
    syncedAt: isSameTicket ? syncRecord.syncedAt : null,
    isSkipped: false,
    warnings: [],
    ...extra,
  };
};

module.exports = {
  inputs: {
    cardId: {
      ...idInput,
      required: true,
    },
    force: {
      type: 'boolean',
      defaultsTo: false,
    },
    entryIds: {
      type: ['string'],
      custom: (value) => value.length <= MAX_ENTRY_IDS,
    },
    ticketState: {
      type: 'string',
      isNotEmptyString: true,
      maxLength: 128,
    },
  },

  exits: {
    notEnoughRights: {
      responseType: 'forbidden',
    },
    cardNotFound: {
      responseType: 'notFound',
    },
    notATicketCard: {
      responseType: 'unprocessableEntity',
    },
    ...HIPPO_ERROR_EXITS,
  },

  async fn(inputs) {
    const { currentUser } = this.req;

    // ---- Step 1: Check the user may edit the card ----
    const { card, list, board, project } = await sails.helpers.cards
      .getPathToProjectById(inputs.cardId)
      .intercept('pathNotFound', () => Errors.CARD_NOT_FOUND);

    const boardMembership = await BoardMembership.qm.getOneByBoardIdAndUserId(
      board.id,
      currentUser.id,
    );

    if (!boardMembership) {
      throw Errors.CARD_NOT_FOUND; // Forbidden
    }

    if (boardMembership.role !== BoardMembership.Roles.EDITOR) {
      throw Errors.NOT_ENOUGH_RIGHTS;
    }

    // ---- Step 2: Find the card's ticket ----
    const ticketValuesByCardId = await sails.helpers.hippo.getTicketValuesByCards([card]);
    const ticketValues = ticketValuesByCardId[card.id];
    const ticketNumber = ticketValues && normalizeTicketNumber(ticketValues.ticketNumber);

    if (!ticketNumber) {
      throw Errors.NOT_A_TICKET_CARD;
    }

    // ---- Step 3: Skip a refresh that is not due, or a card already syncing ----
    const syncRecord = await HippoCardSync.qm.getOneByCardId(card.id);

    if (syncingCardIds.has(card.id)) {
      return {
        item: buildItem(card, ticketNumber, syncRecord, {
          isSkipped: true,
          skipReason: SkipReasons.IN_PROGRESS,
        }),
      };
    }

    const skipReason = getSkipReason({
      syncRecord,
      ticketNumber,
      force: inputs.force,
      now: Date.now(),
    });

    if (skipReason) {
      return {
        item: buildItem(card, ticketNumber, syncRecord, {
          isSkipped: true,
          skipReason,
        }),
      };
    }

    syncingCardIds.add(card.id);

    try {
      // ---- Step 4: Fetch the ticket from Hippo ----
      const appSecretKey = await sails.helpers.hippo
        .getAppSecretKey(project.id)
        .intercept('hippoNotConfigured', () => HippoErrors.HIPPO_NOT_CONFIGURED);

      const data = await interceptHippoExits(
        sails.helpers.hippo.fetchTicket.with({
          appSecretKey,
          ticketNumber,
        }),
      );

      if (!data) {
        throw HippoErrors.HIPPO_TICKET_NOT_FOUND;
      }

      // ---- Step 5: Match assignees to board members ----
      const ticket = {
        ...mapTicket(data, ticketNumber),
        // The number the card holds, so records and blocks stay tied to it
        number: ticketNumber,
      };

      const boardMemberships = await BoardMembership.qm.getByBoardId(board.id);

      const users = await User.qm.getByIds(
        sails.helpers.utils.mapRecords(boardMemberships, 'userId'),
        {
          withDeactivated: false,
        },
      );

      // ---- Step 6: Write the ticket into the card ----
      const { warnings } = await sails.helpers.hippo.applyTicketToCard.with({
        card,
        list,
        board,
        project,
        ticket: {
          ...ticket,
          assignees: matchAssignees(ticket.assignees, users),
        },
        customFieldGroupId: ticketValues.customFieldGroupId,
        users,
        ticketState: inputs.ticketState,
        entryIds: inputs.entryIds,
        actorUser: currentUser,
        request: this.req,
      });

      // ---- Step 7: Record the sync ----
      const nextSyncRecord = await HippoCardSync.qm.createOrUpdateOne(card.id, {
        ticketNumber,
        syncedAt: new Date().toISOString(),
      });

      return {
        item: buildItem(card, ticketNumber, nextSyncRecord, {
          warnings,
        }),
      };
    } finally {
      syncingCardIds.delete(card.id);
    }
  },
};
```

- [ ] **Step 2: Add the route**

In `server/config/routes.js`, add this line directly above `'POST /api/cards/:cardId/hippo-sync/note': 'hippo/sync-note',`:

```js
  'POST /api/cards/:cardId/hippo-sync': 'hippo/sync-card',
```

- [ ] **Step 3: Lint, load check, commit**

Run `cd server && npm run lint`.
Expected: `✔  Your .js files look good.`

Run `cd server && node -e "require('./api/controllers/hippo/sync-card.js'); console.log('ok')"`.
Expected: `ok`.

Run `gitnexus_detect_changes({scope: "all", repo: "planka"})`, then:

```bash
git add server/api/controllers/hippo/sync-card.js server/config/routes.js
git commit -m "hippo: endpoint to sync a card from its ticket"
```

---

### Task 5: Client import shape and description block

**Files:**
- Modify: `client/src/utils/hippo.js` (`buildCardDescription`, `buildHippoImport`; remove `buildImportedCommentText` and `ENTRY_LABEL_BY_KIND`)
- Modify: `client/src/utils/hippo.test.js`
- Modify: `client/src/components/cards/AddCardModal/Content.jsx` (the `formatEntryDate` callback and the `buildHippoImport` call in `submit`)

**Interfaces:**
- Consumes: the server's block format (Task 1). The client block must be byte-identical: `### Hippo #<n>: <subject>`, blank line, description, blank line, `— Imported from Hippo ticket #<n>`.
- Produces:
  - `buildCardDescription(ticket) → string` (the block).
  - `buildHippoImport({ ticket, ticketUrl, ticketState, selectedEntryIds }) → { ticketState: string|null, entryIds: string[], values: [{ name, content }] }`. `values` holds only Ticket # and Ticket URL, and only when present.

- [ ] **Step 1: Impact check**

Run `gitnexus_impact` (`repo: "planka"`) on `buildCardDescription`, `buildHippoImport` and `buildImportedCommentText`. If they are not found, run `grep -rn "buildCardDescription\|buildHippoImport\|buildImportedCommentText" client/src`. Expected callers:
- `applyTicketToCardData` (same file)
- `Content.jsx`
- `sagas/core/services/hippo.js`, through the import's shape
- the test file

- [ ] **Step 2: Update the tests first**

In `client/src/utils/hippo.test.js`:

1. Remove `buildImportedCommentText,` from the import list.
2. In `applyTicketToCardData`'s first test, change the expected `description` to:
   ```js
      description:
        '### Hippo #43886: Android APK not functional\n\nCannot pass the OTP screen\n\n— Imported from Hippo ticket #43886',
   ```
3. Replace the `describe('buildCardDescription', ...)` and `describe('imported comments', ...)` blocks with:

```js
describe('buildCardDescription', () => {
  it('writes the block the server syncs: heading, description, footer', () => {
    expect(buildCardDescription({ ...TICKET, descriptionMarkdown: '' })).toBe(
      '### Hippo #43886: Android APK not functional\n\n— Imported from Hippo ticket #43886',
    );

    expect(buildCardDescription({ ...TICKET, subject: '', descriptionMarkdown: '' })).toBe(
      '### Hippo #43886\n\n— Imported from Hippo ticket #43886',
    );
  });
});

describe('buildHippoImport', () => {
  it('links the card and leaves the rest to the server sync', () => {
    expect(
      buildHippoImport({
        ticket: TICKET,
        ticketUrl: 'https://hippochat.io/en/#/ticket/list/active/43886',
        ticketState: 'Closed',
        selectedEntryIds: ['n1'],
      }),
    ).toEqual({
      ticketState: 'Closed',
      entryIds: ['n1'],
      values: [
        { name: HippoFieldNames.TICKET_NUMBER, content: '43886' },
        {
          name: HippoFieldNames.TICKET_URL,
          content: 'https://hippochat.io/en/#/ticket/list/active/43886',
        },
      ],
    });
  });

  it('leaves out a missing link and state', () => {
    expect(
      buildHippoImport({ ticket: TICKET, ticketUrl: null, ticketState: null, selectedEntryIds: [] }),
    ).toEqual({
      ticketState: null,
      entryIds: [],
      values: [{ name: HippoFieldNames.TICKET_NUMBER, content: '43886' }],
    });
  });
});
```

- [ ] **Step 3: Run them to watch them fail**

Run: `cd client && npx jest src/utils/hippo.test.js`
Expected: FAIL in `applyTicketToCardData`, `buildCardDescription` and `buildHippoImport`.

- [ ] **Step 4: Implement**

In `client/src/utils/hippo.js`, replace `buildCardDescription`:

```js
// The server writes and replaces this same block when it syncs the card
// (server/utils/hippo-card-sync.js); the two must stay in step
export const buildCardDescription = (ticket) => {
  const heading = ticket.subject
    ? `### Hippo #${ticket.number}: ${ticket.subject}`
    : `### Hippo #${ticket.number}`;

  return [heading, ticket.descriptionMarkdown, `— Imported from Hippo ticket #${ticket.number}`]
    .filter(Boolean)
    .join('\n\n');
};
```

Delete `buildImportedCommentText` and the `ENTRY_LABEL_BY_KIND` constant. Replace `buildHippoImport`:

```js
// What the create saga needs: the card is linked here, and the server sync brings in the rest
export const buildHippoImport = ({ ticket, ticketUrl, ticketState, selectedEntryIds }) => ({
  ticketState: ticketState || null,
  entryIds: selectedEntryIds,
  values: [
    {
      name: HippoFieldNames.TICKET_NUMBER,
      content: ticket.number,
    },
    {
      name: HippoFieldNames.TICKET_URL,
      content: ticketUrl,
    },
  ].filter(({ content }) => !!content),
});
```

If `joinMultiselectContent` is no longer used in `utils/hippo.js`, remove its import.

In `client/src/components/cards/AddCardModal/Content.jsx`:
- Delete the `formatEntryDate` `useCallback` block.
- In `submit`, change the hippo argument to `hippo: hippo ? buildHippoImport(hippo) : undefined,`.
- Remove `formatEntryDate` from `submit`'s dependency array.

- [ ] **Step 5: Run the tests to watch them pass, then lint**

Run: `cd client && npx jest src/utils`
Expected: all passing.

Run: `cd client && npx eslint --ext js,jsx src/utils src/components/cards/AddCardModal`
Expected: no output.

- [ ] **Step 6: Commit**

Run `gitnexus_detect_changes({scope: "all", repo: "planka"})`, then:

```bash
git add client/src/utils/hippo.js client/src/utils/hippo.test.js client/src/components/cards/AddCardModal/Content.jsx
git commit -m "hippo: add-card import hands notes to the server sync"
```

---

### Task 6: Add Card import through the server sync

**Files:**
- Modify: `client/src/api/hippo.js`
- Modify: `client/src/sagas/core/services/hippo.js` (`importHippoTicketToCard`, and its imports)

**Interfaces:**
- Consumes:
  - The endpoint from Task 4.
  - The `buildHippoImport` shape `{ ticketState, entryIds, values }` from Task 5.
  - The existing `ensureHippoFieldGroup(boardId, values)` and `updateCustomFieldValue`.
- Produces: `api.syncHippoCard(cardId, data, headers)`. `importHippoTicketToCard(card, { values, entryIds, ticketState })`.

- [ ] **Step 1: Impact check**

Run `gitnexus_impact({target: "importHippoTicketToCard", direction: "upstream", repo: "planka"})`. If it is not found, run `grep -rn "importHippoTicketToCard" client/src`. Expected caller: `createCardWithDetails` in `sagas/core/services/cards.js`, which passes `hippo` through unchanged.

- [ ] **Step 2: Add the API call**

In `client/src/api/hippo.js`, add:

```js
const syncHippoCard = (cardId, data, headers) =>
  socket.post(`/cards/${cardId}/hippo-sync`, data, headers);
```

Then add `syncHippoCard,` to the default export.

- [ ] **Step 3: Rewrite the import**

In `client/src/sagas/core/services/hippo.js`:
- Remove the `import { createComment } from './comments';` line.
- Add `import api from '../../../api';` after the `toast` import.
- Replace `importHippoTicketToCard` with:

```js
/**
 * Links a card that was just created to its Hippo ticket: the board's "Hippo Ticket" group gets
 * its fields, and the card its Ticket # and Ticket URL. The server sync then brings in the rest,
 * including the notes and comments picked in the dialog, placed by date. The ones left out are
 * remembered, so a later refresh does not bring them in.
 */
export function* importHippoTicketToCard(card, { values, entryIds, ticketState }) {
  const hippoFieldGroup = yield call(ensureHippoFieldGroup, card.boardId, values);

  let isComplete = !!hippoFieldGroup;

  for (let i = 0; isComplete && i < values.length; i += 1) {
    const { name, content } = values[i];

    const customFieldValue = yield call(
      updateCustomFieldValue,
      card.id,
      hippoFieldGroup.customFieldGroupId,
      hippoFieldGroup.customFieldIdByName[name],
      {
        content,
      },
    );

    isComplete = !!customFieldValue;
  }

  if (isComplete) {
    const accessToken = yield select(selectors.selectAccessToken);

    // Straight to the server, as Hippo may take its whole timeout to answer
    try {
      yield call(
        api.syncHippoCard,
        card.id,
        {
          force: true,
          entryIds,
          ...(ticketState && {
            ticketState,
          }),
        },
        {
          Authorization: `Bearer ${accessToken}`,
        },
      );
    } catch (error) {
      isComplete = false;
    }
  }

  if (!isComplete) {
    yield call(toast, {
      type: ToastTypes.HIPPO_IMPORT_INCOMPLETE,
    });
  }
}
```

- [ ] **Step 4: Lint, test, build, commit**

Run: `cd client && npx eslint --ext js,jsx src/api src/sagas && npx jest`
Expected: no lint output, and all suites pass.

Run: `cd client && npm run build`
Expected: exit 0.

Run `gitnexus_detect_changes({scope: "all", repo: "planka"})`, then:

```bash
git add client/src/api/hippo.js client/src/sagas/core/services/hippo.js
git commit -m "hippo: add-card import syncs through the server"
```

---

### Task 7: Pull and Sync in the card view

**Files:**
- Create: `client/src/components/cards/CardModal/CustomFieldGroups/use-hippo-card-sync.js`
- Modify: `client/src/components/cards/CardModal/CustomFieldGroups/Item.jsx`
- Modify: `client/src/components/cards/CardModal/CustomFieldGroups/Item.module.scss`
- Modify: `client/src/locales/en-US/core.js`

**Interfaces:**
- Consumes:
  - `api.syncHippoCard` (Task 6).
  - `selectors.selectHippoTicketForCurrentCard`, which returns `{ number, customFieldGroupId, ... }` or null.
  - `selectors.selectCanSyncToHippoInCurrentBoard`, which is true for editors when Hippo is configured.
  - `getHippoErrorText(error, t)` from `utils/hippo`.
  - `TimeAgo` from `components/common/TimeAgo`.
- Produces: `useHippoCardSync(cardId, isEnabled) → [{ hasSynced: boolean|null, syncedAt: Date|null, isSyncing: boolean, error: object|null }, syncNow: () => void]`.

- [ ] **Step 1: Impact check**

Run `gitnexus_impact({target: "Item", direction: "upstream", repo: "planka"})` for `client/src/components/cards/CardModal/CustomFieldGroups/Item.jsx`. Expected: `DraggableItem.jsx` and `CustomFieldGroups.jsx`. The props are unchanged.

- [ ] **Step 2: Write the hook**

```js
/*!
 * Copyright (c) 2024 PLANKA Software GmbH
 * Licensed under the Fair Use License: https://github.com/plankanban/planka/blob/master/LICENSE.md
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { useSelector } from 'react-redux';

import api from '../../../../api';
import selectors from '../../../../selectors';

const INITIAL_STATE = {
  hasSynced: null,
  syncedAt: null,
  isSyncing: false,
  error: null,
};

/**
 * A card's sync with its Hippo ticket. Opening the card sends one quiet refresh, which the server
 * skips when it is not due; syncNow always reaches Hippo. Only the latest call settles the state,
 * and only syncNow reports errors. Calls go straight to the server, past the request queue.
 */
export default (cardId, isEnabled) => {
  const accessToken = useSelector(selectors.selectAccessToken);

  const [state, setState] = useState(INITIAL_STATE);
  const requestIdRef = useRef(0);

  const sync = useCallback(
    async (force) => {
      requestIdRef.current += 1;
      const requestId = requestIdRef.current;

      setState((prevState) => ({
        ...prevState,
        isSyncing: true,
        error: null,
      }));

      try {
        const { item } = await api.syncHippoCard(
          cardId,
          {
            force,
          },
          {
            Authorization: `Bearer ${accessToken}`,
          },
        );

        if (requestId === requestIdRef.current) {
          setState({
            hasSynced: item.hasSynced,
            syncedAt: item.syncedAt ? new Date(item.syncedAt) : null,
            isSyncing: false,
            error: null,
          });
        }
      } catch (error) {
        if (requestId === requestIdRef.current) {
          setState((prevState) => ({
            ...prevState,
            isSyncing: false,
            error: force ? error : null,
          }));
        }
      }
    },
    [cardId, accessToken],
  );

  const syncNow = useCallback(() => {
    sync(true);
  }, [sync]);

  useEffect(() => {
    setState(INITIAL_STATE);

    if (isEnabled) {
      sync(false);
    }
  }, [cardId, isEnabled]); // eslint-disable-line react-hooks/exhaustive-deps

  return [state, syncNow];
};
```

- [ ] **Step 3: Add the button and the status line to the Hippo Ticket section**

In `client/src/components/cards/CardModal/CustomFieldGroups/Item.jsx`:

Add these imports:
- `useTranslation` from `react-i18next`
- `getHippoErrorText` next to `HIPPO_GROUP_NAME`, as `import { HIPPO_GROUP_NAME, getHippoErrorText } from '../../../../utils/hippo';`
- `import TimeAgo from '../../../common/TimeAgo';`
- `import useHippoCardSync from './use-hippo-card-sync';`

After the `hasValues` selector line, add:

```js
  const { cardId } = useSelector(selectors.selectPath);
  const hippoTicket = useSelector(selectors.selectHippoTicketForCurrentCard);
  const canSyncToHippo = useSelector(selectors.selectCanSyncToHippoInCurrentBoard);
```

After `const isCollapsible = ...`, add:

```js
  // Editors sync the card with its ticket from here; the card holds its number in this group
  const isHippoGroup = isCollapsible && canSyncToHippo;
  const isLinked = !!hippoTicket && hippoTicket.customFieldGroupId === id;

  const [t] = useTranslation();
  const [hippoSync, syncWithHippoNow] = useHippoCardSync(cardId, isHippoGroup && isLinked);
```

In the JSX, add the button directly after the toggle `<button>` (inside the `isCollapsible` branch, which becomes a fragment):

```jsx
            {isCollapsible ? (
              <>
                <button type="button" className={styles.toggleButton} onClick={handleToggleClick}>
                  <span className={styles.moduleHeaderTitle}>{customFieldGroup.name}</span>
                  <Icon
                    name={isOpened ? 'chevron up' : 'chevron down'}
                    className={styles.toggleIcon}
                  />
                </button>
                {isHippoGroup && (
                  <Button
                    basic
                    size="mini"
                    icon={hippoSync.hasSynced === false ? 'download' : 'sync'}
                    content={
                      hippoSync.hasSynced === false
                        ? t('action.pullFromHippo')
                        : t('action.syncWithHippo')
                    }
                    loading={hippoSync.isSyncing}
                    disabled={!isLinked || hippoSync.isSyncing}
                    className={styles.syncButton}
                    onClick={syncWithHippoNow}
                  />
                )}
              </>
            ) : (
```

Then, directly after the closing `</div>` of the drag-handle wrapper (before `{isOpened && <CustomFieldGroup id={id} />}`), add:

```jsx
        {isHippoGroup && hippoSync.error && (
          <div className={styles.syncError}>{getHippoErrorText(hippoSync.error, t)}</div>
        )}
        {isHippoGroup && !hippoSync.error && hippoSync.syncedAt && (
          <div className={styles.syncStatus}>
            {t('common.syncedFromHippo')} <TimeAgo date={hippoSync.syncedAt} />
          </div>
        )}
```

- [ ] **Step 4: Styles**

In `Item.module.scss`, add these before `.toggleButton`, keeping alphabetical order:

```scss
  .syncButton {
    flex: 0 0 auto;
    margin: 0 0 0 12px;
  }

  .syncError {
    color: #db2828;
    font-size: 12px;
    margin: -4px 0 8px;
  }

  .syncStatus {
    color: #6b808c;
    font-size: 12px;
    margin: -4px 0 8px;
  }
```

- [ ] **Step 5: Strings**

In `client/src/locales/en-US/core.js`, add these keys in alphabetical position within each section:
- `common`: `syncedFromHippo: 'Synced from Hippo',`
- `action`: `pullFromHippo: 'Pull from Hippo',` and `syncWithHippo: 'Sync',`

- [ ] **Step 6: Lint, test, build, commit**

Run: `cd client && npx eslint --ext js,jsx src/components/cards/CardModal src/locales/en-US && npx jest`
Expected: no lint output, and all suites pass.

Run: `cd client && npm run build`
Expected: exit 0.

Run `gitnexus_detect_changes({scope: "all", repo: "planka"})`, then:

```bash
git add client/src/components/cards/CardModal/CustomFieldGroups client/src/locales/en-US/core.js
git commit -m "hippo: pull and sync buttons, refresh on open"
```

---

### Task 8: Whole-branch checks and the manual test list

- [ ] **Step 1: Full checks**

Run each command and read its output:
- `cd server && npm run lint` → `✔  Your .js files look good.`
- `cd server && npx mocha test/utils/hippo-card-sync.test.js test/utils/hippo.test.js test/utils/custom-fields.test.js test/utils/hippo-errors.test.js` → all passing.
- `cd client && npx jest` → all suites pass.
- `cd client && npx eslint --ext js,jsx src/utils src/api src/sagas src/components/cards src/locales/en-US` → no output.
- `cd client && npm run build` → exit 0.

- [ ] **Step 2: Manual test list for the user** (put it in the final message)

1. `cd server && npm run db:migrate` (creates `hippo_card_entry` and `hippo_card_sync`), then restart the server.
2. **Pull on a hand-made card.** Open a hand-made card on a board in a project with a Hippo key, type a real ticket number into Ticket #, and save. Click **Pull from Hippo**. Expect:
   - the block added under the existing description;
   - State, Priority and Tags filled;
   - assignees added next to the existing members;
   - Hippo notes and comments placed among the existing comments by date. Check that an old Hippo note sits below newer Planka comments. **This also checks that Waterline kept the supplied comment ID.** If every imported comment lands on top instead, the ID was dropped: report it.
3. **Sync again.** The button now reads **Sync**. Click it: nothing is duplicated, and "Synced from Hippo just now" shows.
4. **Hippo wins for its fields.** Change the ticket's status and description in Hippo, then click Sync. The card's State and block update, and your own description text above the block stays.
5. **Your pushed comments.** Add a Planka comment, choose to push it to Hippo, then click Sync. It must not come back as a `[Hippo Note]` comment.
6. **Refresh on open.** Close the card, wait over 2 minutes, add a note in Hippo, and reopen the card. The note appears without clicking anything. Reopen within 2 minutes: no new fetch (check the server log, or that "Synced" keeps its old time).
7. **A viewer.** Open the card as a board viewer. There's no button and no refresh.
8. **Add Card.** Fetch a ticket, untick one note, and add the card. The ticked notes appear, by date. Click Sync: the unticked note still does not appear.
9. **An older imported card.** A card imported before this change shows **Pull from Hippo**. Click it: no duplicate comments, and the old footer-only description is turned into the block.
10. **Errors.** Remove the project's Hippo key and click Sync: you see "Hippo not configured" in red under the heading. Put a wrong number in Ticket # and click Pull: you see "Hippo ticket not found".
11. **Two at once.** Open the same never-recently-synced card in two browsers within a second. No comment is duplicated.
