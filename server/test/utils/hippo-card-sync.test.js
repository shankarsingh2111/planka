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

    it('does not take a short note for part of a longer comment', () => {
      const done = { id: 'n5', kind: 'note', authorName: 'Harsh', markdown: 'Done' };

      const comments = [
        { id: '7', text: '**[Hippo Note] Harsh**\n\nDone with the backend part, ok to deploy?' },
        { id: '8', text: 'Done, and more besides' },
      ];

      expect(planEntries({ entries: [done], records: [], comments })).to.deep.equal({
        toImport: [done],
        toRecord: [],
      });
    });

    it('matches each earlier comment to one entry only', () => {
      const first = { id: 'n6', kind: 'note', authorName: 'Harsh', markdown: 'Done' };
      const second = { id: 'n7', kind: 'note', authorName: 'Harsh', markdown: 'Done' };
      const comments = [{ id: '9', text: '**[Hippo Note] Harsh · Oct 1**\n\nDone' }];

      expect(planEntries({ entries: [first, second], records: [], comments })).to.deep.equal({
        toImport: [second],
        toRecord: [{ entryId: 'n6', kind: EntryRecordKinds.IMPORTED, commentId: '9' }],
      });
    });

    it('leaves a comment an entry record already points at to that entry', () => {
      const again = { id: 'n8', kind: 'note', authorName: 'Harsh', markdown: 'Done' };
      const records = [{ entryId: 'n6', kind: EntryRecordKinds.IMPORTED, commentId: '9' }];
      const comments = [{ id: '9', text: '**[Hippo Note] Harsh**\n\nDone' }];

      expect(planEntries({ entries: [again], records, comments }).toImport).to.deep.equal([again]);
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
      expect(
        getSkipReason({ syncRecord: null, ticketNumber: '43643', force: false, now }),
      ).to.equal(SkipReasons.NEVER_SYNCED);

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
      expect(
        mergeFieldOptions(['Open', 'New'], ['New', 'Closed'], ['Reopened', null]),
      ).to.deep.equal(['Open', 'New', 'Closed', 'Reopened']);
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
