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
// "**[Hippo Note] Author**", followed by the entry, as imported comments read
const IMPORTED_COMMENT_REGEX = /^\*\*\[Hippo (?:Note|Comment)\][^\n]*\*\*(?:\n\n([\s\S]*))?$/;

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

// What a comment says, as an imported entry or a note Planka pushed would say it
const getCommentBody = (comment) => {
  const match = (comment.text || '').match(IMPORTED_COMMENT_REGEX);
  return normalizeText(match ? match[1] : comment.text);
};

const getEntryBody = (entry) => {
  const match = entry.kind === 'note' && entry.markdown.match(PUSHED_NOTE_REGEX);
  return normalizeText(match ? match[1] : entry.markdown);
};

/**
 * Sorts the ticket's notes and comments into those the card has and those it needs. Recorded
 * entries are done with. An entry whose whole text a comment holds was imported before records
 * were kept, or is a Planka comment that went to Hippo as a note; it gets a record. Each comment
 * stands for one entry at most, so two "Done" notes need two comments. Entries left out of
 * entryIds are recorded as skipped. The rest are imported.
 */
const planEntries = ({ entries, records, comments, entryIds }) => {
  const recordedEntryIds = new Set(records.map((record) => record.entryId));
  const claimedCommentIds = new Set(records.map((record) => record.commentId).filter(Boolean));

  const commentBodies = comments.map((comment) => ({
    id: comment.id,
    body: getCommentBody(comment),
  }));

  const result = {
    toImport: [],
    toRecord: [],
  };

  entries.forEach((entry) => {
    if (recordedEntryIds.has(entry.id)) {
      return;
    }

    const body = getEntryBody(entry);

    const comment =
      body &&
      commentBodies.find(
        (commentBody) => commentBody.body === body && !claimedCommentIds.has(commentBody.id),
      );

    if (comment) {
      claimedCommentIds.add(comment.id);

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
