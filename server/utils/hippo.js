/*!
 * Copyright (c) 2024 PLANKA Software GmbH
 * Licensed under the Fair Use License: https://github.com/plankanban/planka/blob/master/LICENSE.md
 */

const escapeHtml = require('escape-html');
const TurndownService = require('turndown');

const HIPPO_API_URL = 'https://api.hippochat.io';
const TICKETING_PATH = '/api/ticketing/activities';
const VERIFY_ACCOUNT_PATH = '/api/business/verifyAccount';
const REQUEST_TIMEOUT_MS = 10 * 1000;

const HIPPO_GROUP_NAME = 'Hippo Ticket';

const HippoFieldNames = {
  TICKET_NUMBER: 'Ticket #',
  TICKET_STATE: 'Ticket State',
  PRIORITY: 'Priority',
  TICKET_URL: 'Ticket URL',
  TAGS: 'Tags',
};

// Exits of the Hippo helpers, one per way a call can go wrong
const HippoExits = {
  UNAUTHORIZED: 'hippoUnauthorized',
  TICKET_NOT_FOUND: 'hippoTicketNotFound',
  UNAVAILABLE: 'hippoUnavailable',
  REJECTED: 'hippoRejected',
};

const EntryKinds = {
  NOTE: 'note',
  COMMENT: 'comment',
};

const FIELD_KEY_BY_NAME = {
  [HippoFieldNames.TICKET_NUMBER]: 'ticketNumber',
  [HippoFieldNames.TICKET_STATE]: 'ticketState',
  [HippoFieldNames.PRIORITY]: 'priority',
  [HippoFieldNames.TICKET_URL]: 'ticketUrl',
  [HippoFieldNames.TAGS]: 'tags',
};

const TICKET_NOT_FOUND_REGEX = /ticket not found/i;
const UNAUTHORIZED_REGEX =
  /app_secret_key|access denied|unauthori[sz]ed|invalid (app )?(secret )?key/i;
const RAW_TAG_REGEX = /<[a-z!/][^>]*>/i;
const ESCAPED_TAG_REGEX = /&lt;[a-z!/]/i;

const turndownService = new TurndownService({
  headingStyle: 'atx',
  codeBlockStyle: 'fenced',
  bulletListMarker: '-',
});

/* Requests */

const buildTicketDetailsBody = (ticketNumber) => ({
  ticket_id: ticketNumber,
});

const buildAddNoteBody = (ticketNumber, note) => ({
  is_update_ticket: 1,
  ticket_id: ticketNumber,
  update_key: 'NOTE',
  note,
});

const buildUpdateStatusBody = (ticketNumber, status) => ({
  is_update_ticket: 1,
  ticket_id: ticketNumber,
  update_key: 'STATUS',
  status,
});

/* Responses */

// Hippo reports the outcome in the body's statusCode, whatever the HTTP status says
const classifyHippoResponse = (httpStatus, body) => {
  if (httpStatus >= 500 || !body || typeof body !== 'object') {
    return {
      exit: HippoExits.UNAVAILABLE,
    };
  }

  const statusCode = body.statusCode || httpStatus;

  if (statusCode === 200) {
    return {
      data: body.data,
    };
  }

  const message = typeof body.message === 'string' ? body.message : '';

  if (TICKET_NOT_FOUND_REGEX.test(message)) {
    return {
      exit: HippoExits.TICKET_NOT_FOUND,
    };
  }

  if (statusCode === 401 || statusCode === 403 || UNAUTHORIZED_REGEX.test(message)) {
    return {
      exit: HippoExits.UNAUTHORIZED,
    };
  }

  return {
    exit: HippoExits.REJECTED,
    message: message || `Hippo responded with status ${statusCode}`,
  };
};

/* Content */

const decodeBasicEntities = (value) =>
  value
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, '&');

// Hippo keeps rich text as HTML. Its docs show that HTML entity-escaped, so text holding escaped
// tags but not a single raw one is decoded first.
const htmlToMarkdown = (html) => {
  if (!html) {
    return '';
  }

  const source =
    !RAW_TAG_REGEX.test(html) && ESCAPED_TAG_REGEX.test(html) ? decodeBasicEntities(html) : html;

  return turndownService.turndown(source).trim();
};

// Hippo shows notes added through its API as written by the business, so the Planka author leads
const buildNoteHtml = (authorName, text) => {
  const body = escapeHtml(text.trim()).replace(/\r?\n/g, '<br>');

  return `<p>${escapeHtml(authorName)} (via Planka): ${body}</p>`;
};

/* People */

// Case and any "+tag" in the local part are ignored: harsh.sharma+1cs@x is harsh.sharma@x
const normalizeEmail = (email) => {
  if (!email) {
    return null;
  }

  const [localPart, domain] = email.trim().toLowerCase().split('@');

  if (!localPart || !domain) {
    return null;
  }

  return `${localPart.split('+')[0]}@${domain}`;
};

const getPersonName = (person) =>
  (person && (person.fullname || person.username || person.email)) || '';

const matchAssignees = (assignees, users) => {
  const userIdByEmail = {};

  users.forEach((user) => {
    const email = normalizeEmail(user.email);

    if (email && !userIdByEmail[email]) {
      userIdByEmail[email] = user.id;
    }
  });

  return assignees.map((assignee) => {
    const email = normalizeEmail(assignee.email);

    return {
      name: assignee.name,
      userId: (email && userIdByEmail[email]) || null,
    };
  });
};

/* Tickets */

const getTime = (date) => (date ? new Date(date).getTime() : 0);

const mapEntries = (items, kind, contentKey) =>
  (items || [])
    .filter((item) => item && !item.deleted)
    .map((item, index) => ({
      // eslint-disable-next-line no-underscore-dangle
      id: item._id ? String(item._id) : `${kind}-${index}`,
      kind,
      authorName: getPersonName(item.owner),
      date: item.date || null,
      markdown: htmlToMarkdown(item[contentKey]),
    }));

// Hippo's sample shows only an empty list, so a tag may be plain text or an object naming it. A
// comma would split it in the multi-select it goes into, so commas become spaces.
const getTagName = (tag) => {
  const name = typeof tag === 'string' ? tag : tag && (tag.name || tag.tag || tag.title);
  return typeof name === 'string' ? name.replace(/,/g, ' ').replace(/\s+/g, ' ').trim() : '';
};

const mapTags = (tags) =>
  (tags || []).reduce((result, tag) => {
    const name = getTagName(tag);
    return name && !result.includes(name) ? [...result, name] : result;
  }, []);

const mapTicket = (data, ticketNumber) => ({
  number: data.uid ? String(data.uid) : ticketNumber,
  subject: data.subject || '',
  descriptionMarkdown: htmlToMarkdown(data.issue),
  statusText: data.statusText || null,
  priority: (data.priority && data.priority.name) || null,
  type: (data.type && data.type.name) || null,
  group: (data.group && data.group.name) || null,
  dueDate: data.dueDate || null,
  assignees: (data.assignee || []).map((assignee) => ({
    name: getPersonName(assignee),
    email: assignee.email || null,
  })),
  tags: mapTags(data.tags),
  // Oldest first, the order they are posted to the card in
  entries: [
    ...mapEntries(data.notes, EntryKinds.NOTE, 'note'),
    ...mapEntries(data.comments, EntryKinds.COMMENT, 'comment'),
  ].sort((a, b) => getTime(a.date) - getTime(b.date)),
});

// A card's Hippo values come from its board's "Hippo Ticket" group or, failing that, from the
// card's own copy of it, which Planka makes when the card moves to another board. Cards without
// a ticket number are left out.
const getTicketValuesByCardId = ({ cards, customFieldGroups, customFields, customFieldValues }) => {
  const hippoCustomFieldGroups = customFieldGroups.filter(
    (customFieldGroup) => customFieldGroup.name === HIPPO_GROUP_NAME,
  );

  const fieldKeyByCustomFieldId = {};

  customFields.forEach((customField) => {
    const fieldKey = FIELD_KEY_BY_NAME[customField.name];

    if (fieldKey) {
      fieldKeyByCustomFieldId[customField.id] = fieldKey;
    }
  });

  const valuesByGroupedCardId = {};

  customFieldValues.forEach((customFieldValue) => {
    const fieldKey = fieldKeyByCustomFieldId[customFieldValue.customFieldId];

    if (!fieldKey) {
      return;
    }

    const groupedCardId = `${customFieldValue.cardId}:${customFieldValue.customFieldGroupId}`;

    valuesByGroupedCardId[groupedCardId] = {
      ...valuesByGroupedCardId[groupedCardId],
      [fieldKey]: customFieldValue.content,
    };
  });

  const result = {};

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

  return result;
};

module.exports = {
  HIPPO_API_URL,
  TICKETING_PATH,
  VERIFY_ACCOUNT_PATH,
  REQUEST_TIMEOUT_MS,
  HIPPO_GROUP_NAME,
  HippoFieldNames,
  HippoExits,
  buildTicketDetailsBody,
  buildAddNoteBody,
  buildUpdateStatusBody,
  classifyHippoResponse,
  htmlToMarkdown,
  buildNoteHtml,
  normalizeEmail,
  matchAssignees,
  mapTicket,
  getTicketValuesByCardId,
};
