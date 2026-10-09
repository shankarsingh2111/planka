/*!
 * Copyright (c) 2024 PLANKA Software GmbH
 * Licensed under the Fair Use License: https://github.com/plankanban/planka/blob/master/LICENSE.md
 */

import { CustomFieldTypes } from '../constants/Enums';

// The server reads these same names (server/utils/hippo.js); the two must stay in step
export const HIPPO_GROUP_NAME = 'Hippo Ticket';

export const HippoFieldNames = {
  TICKET_NUMBER: 'Ticket #',
  TICKET_STATE: 'Ticket State',
  PRIORITY: 'Priority',
  TICKET_URL: 'Ticket URL',
  TAGS: 'Tags',
};

// The ticket chip on the card front stands in for these
export const TICKET_CHIP_FIELD_NAMES = [HippoFieldNames.TICKET_NUMBER, HippoFieldNames.TICKET_URL];

export const DEFAULT_TICKET_STATES = [
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

export const DEFAULT_PRIORITIES = ['Normal', 'Urgent', 'Critical'];

export const DEFAULT_TAGS = ['Apps', 'Backend', 'Frontend', 'Integration', 'Solutioning'];

// What a board's "Hippo Ticket" group holds, in order. A board's own options are kept, and the
// defaults join them.
export const HIPPO_FIELD_DEFINITIONS = [
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

const TICKET_NUMBER_REGEX = /^#?(\d{1,12})$/;
const URL_REGEX = /^https?:\/\//i;
const TICKET_NUMBER_PLACEHOLDER = '{ticketNumber}';

// Where a ticket lives when no link to it was ever pasted
export const DEFAULT_TICKET_URL_PATTERN = `https://hippochat.io/en/#/ticket/list/active/${TICKET_NUMBER_PLACEHOLDER}`;
const MAX_TICKET_NUMBER_LENGTH = 12;

const ERROR_KEY_BY_MESSAGE = {
  'Hippo not configured': 'common.hippoNotConfigured',
  'Hippo key invalid': 'common.hippoKeyInvalid',
  'Hippo ticket not found': 'common.hippoTicketNotFound',
  'Hippo unavailable': 'common.hippoUnavailable',
  'Not a ticket card': 'common.notAHippoTicketCard',
};

const parseUrl = (value) => {
  try {
    return new URL(value.trim());
  } catch {
    return null;
  }
};

// A link's origin, path and hash route, without query strings
const getUrlBase = (url) => `${url.origin}${url.pathname}${url.hash.split('?')[0]}`;

export const isTicketUrl = (input) => URL_REGEX.test((input || '').trim());

// Accepts "43886", "#43886", or a link whose path or hash route ends in the number
export const parseTicketNumber = (input) => {
  const value = (input || '').trim();
  const match = value.match(TICKET_NUMBER_REGEX);

  if (match) {
    return match[1];
  }

  if (!isTicketUrl(value)) {
    return null;
  }

  const url = parseUrl(value);

  if (!url) {
    return null;
  }

  const digitRuns = `${url.pathname}${url.hash.split('?')[0]}`.match(/\d+/g);

  if (!digitRuns) {
    return null;
  }

  const ticketNumber = digitRuns[digitRuns.length - 1];
  return ticketNumber.length <= MAX_TICKET_NUMBER_LENGTH ? ticketNumber : null;
};

// "https://x/#/ticket/43886?tab=notes" for 43886 → "https://x/#/ticket/{ticketNumber}"
export const toTicketUrlPattern = (value, ticketNumber) => {
  const url = parseUrl(value);

  if (!url) {
    return null;
  }

  const base = getUrlBase(url);
  const index = base.lastIndexOf(ticketNumber);

  if (index === -1) {
    return null;
  }

  return `${base.slice(0, index)}${TICKET_NUMBER_PLACEHOLDER}${base.slice(index + ticketNumber.length)}`;
};

export const buildTicketUrl = (pattern, ticketNumber) =>
  pattern ? pattern.replace(TICKET_NUMBER_PLACEHOLDER, ticketNumber) : null;

// Only web links may become clickable: the field is free text, and a javascript: link never may
export const toSafeHttpUrl = (value) => {
  if (!value) {
    return null;
  }

  const url = parseUrl(value);
  return url && (url.protocol === 'http:' || url.protocol === 'https:') ? url.href : null;
};

// A card's own link when it is a web link, otherwise Hippo's page for its number
export const getTicketUrl = (url, ticketNumber) =>
  toSafeHttpUrl(url) ||
  (/^\d{1,12}$/.test(ticketNumber || '')
    ? buildTicketUrl(DEFAULT_TICKET_URL_PATTERN, ticketNumber)
    : null);

// The board's own options first, then whichever defaults and ticket values they lack
export const mergeFieldOptions = (existingOptions, defaultOptions, values) =>
  [...(existingOptions || []), ...defaultOptions, ...values].reduce(
    (result, option) => (option && !result.includes(option) ? [...result, option] : result),
    [],
  );

export const getMatchedUserIds = (ticket) =>
  ticket ? ticket.assignees.flatMap((assignee) => (assignee.userId ? [assignee.userId] : [])) : [];

export const getUnmatchedAssigneeNames = (ticket) =>
  ticket.assignees.flatMap((assignee) => (assignee.userId ? [] : [assignee.name]));

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

// A fetched ticket fills the dialog in; members a ticket fetched before it brought are let go
export const applyTicketToCardData = (data, ticket, prevTicket) => {
  const prevUserIds = getMatchedUserIds(prevTicket);
  const keptUserIds = data.userIds.filter((userId) => !prevUserIds.includes(userId));

  const ticketUserIds = getMatchedUserIds(ticket).filter((userId) => !keptUserIds.includes(userId));

  // A title or due date the previous ticket filled in goes too, unless it was changed by hand
  const isPrevName = !!prevTicket && data.name === prevTicket.subject;

  const isPrevDueDate =
    !!prevTicket &&
    !!prevTicket.dueDate &&
    !!data.dueDate &&
    data.dueDate.getTime() === new Date(prevTicket.dueDate).getTime();

  let { dueDate } = data;

  if (ticket.dueDate) {
    dueDate = new Date(ticket.dueDate);
  } else if (isPrevDueDate) {
    dueDate = null;
  }

  return {
    ...data,
    name: ticket.subject || (isPrevName ? '' : data.name),
    description: buildCardDescription(ticket),
    dueDate,
    userIds: [...keptUserIds, ...ticketUserIds],
  };
};

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

export const getFirstLine = (markdown) =>
  (markdown || '').split('\n').find((line) => line.trim()) || '';

// Planka's own Hippo errors are translated; Hippo's refusals are shown as Hippo words them
export const getHippoErrorText = (error, t) => {
  const key = error && ERROR_KEY_BY_MESSAGE[error.message];

  if (key) {
    return t(key);
  }

  return (error && error.message) || t('common.somethingWentWrong');
};
