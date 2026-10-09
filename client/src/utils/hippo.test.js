import {
  DEFAULT_TICKET_STATES,
  HippoFieldNames,
  applyTicketToCardData,
  buildCardDescription,
  buildHippoImport,
  buildTicketUrl,
  getFirstLine,
  getTicketUrl,
  getHippoErrorText,
  getUnmatchedAssigneeNames,
  mergeFieldOptions,
  isTicketUrl,
  parseTicketNumber,
  toSafeHttpUrl,
  toTicketUrlPattern,
} from './hippo';

const TICKET = {
  number: '43886',
  subject: 'Android APK not functional',
  descriptionMarkdown: 'Cannot pass the OTP screen',
  statusText: 'Pending from Dev',
  priority: 'Normal',
  tags: ['Backend', 'Billing'],
  dueDate: '2026-10-05T18:30:00.000Z',
  assignees: [
    { name: 'Sarabjot Kaur', userId: '11' },
    { name: 'Marketing', userId: null },
  ],
  entries: [
    {
      id: 'c1',
      kind: 'comment',
      authorName: 'Harsh Sharma',
      date: '2026-09-29T21:38:47.000Z',
      markdown: 'Hi Client,\n\nThank you for reaching out.',
    },
    {
      id: 'n1',
      kind: 'note',
      authorName: 'Harsh Sharma',
      date: '2026-10-01T06:04:16.000Z',
      markdown: '@Deepak kumar Kindly look into this',
    },
  ],
};

describe('parseTicketNumber', () => {
  it('accepts a bare or hashed number', () => {
    expect(parseTicketNumber('43886')).toBe('43886');
    expect(parseTicketNumber(' #43886 ')).toBe('43886');
  });

  it('takes the last number in the path or hash route of a link', () => {
    expect(parseTicketNumber('https://hippochat.io/en/tickets/43886')).toBe('43886');

    expect(
      parseTicketNumber('https://app2.hippochat.io:8443/#/ticket/43886?tab=notes&page=2'),
    ).toBe('43886');
  });

  it('refuses anything else', () => {
    expect(parseTicketNumber('')).toBeNull();
    expect(parseTicketNumber('ticket')).toBeNull();
    expect(parseTicketNumber('https://hippochat.io/en/tickets')).toBeNull();
    expect(parseTicketNumber('1234567890123')).toBeNull();
    expect(parseTicketNumber(null)).toBeNull();
  });
});

describe('ticket URL patterns', () => {
  it('turns a ticket link into a pattern other numbers fit into', () => {
    const pattern = toTicketUrlPattern(
      'https://app2.hippochat.io:8443/#/ticket/43886?tab=notes',
      '43886',
    );

    expect(pattern).toBe('https://app2.hippochat.io:8443/#/ticket/{ticketNumber}');
    expect(buildTicketUrl(pattern, '43934')).toBe('https://app2.hippochat.io:8443/#/ticket/43934');
  });

  it('has no pattern for a link without the number, and no link without a pattern', () => {
    expect(toTicketUrlPattern('https://hippochat.io/en/tickets', '43886')).toBeNull();
    expect(buildTicketUrl(null, '43886')).toBeNull();
  });

  it("falls back to Hippo's own ticket page when a card has no usable link", () => {
    expect(getTicketUrl(null, '44233')).toBe('https://hippochat.io/en/#/ticket/list/active/44233');

    // eslint-disable-next-line no-script-url
    expect(getTicketUrl('javascript:alert(1)', '44233')).toBe(
      'https://hippochat.io/en/#/ticket/list/active/44233',
    );

    expect(getTicketUrl('https://app2.hippochat.io/#/ticket/44233', '44233')).toBe(
      'https://app2.hippochat.io/#/ticket/44233',
    );
  });

  it('builds no fallback for a ticket number that is not a number', () => {
    expect(getTicketUrl(null, 'abc')).toBeNull();
  });

  it('tells links from numbers', () => {
    expect(isTicketUrl(' https://hippochat.io/x/1')).toBe(true);
    expect(isTicketUrl('#43886')).toBe(false);
  });
});

describe('toSafeHttpUrl', () => {
  it('keeps web links', () => {
    expect(toSafeHttpUrl('https://hippochat.io/t/1')).toBe('https://hippochat.io/t/1');
    expect(toSafeHttpUrl(' http://hippochat.io/t/1 ')).toBe('http://hippochat.io/t/1');
  });

  it('never lets other schemes or loose text through', () => {
    // These are the unsafe links the function exists to refuse
    // eslint-disable-next-line no-script-url
    expect(toSafeHttpUrl('javascript:alert(1)')).toBeNull();
    // eslint-disable-next-line no-script-url
    expect(toSafeHttpUrl('JaVaScRiPt:alert(1)')).toBeNull();
    expect(toSafeHttpUrl('www.hippochat.io/t/1')).toBeNull();
    expect(toSafeHttpUrl(null)).toBeNull();
  });
});

describe('mergeFieldOptions', () => {
  it('starts from the defaults', () => {
    expect(mergeFieldOptions(null, DEFAULT_TICKET_STATES, ['Closed'])).toEqual(
      DEFAULT_TICKET_STATES,
    );
  });

  it("keeps the board's options first, then adds missing defaults and values", () => {
    expect(mergeFieldOptions(['Open', 'New'], ['New', 'Closed'], ['Reopened', null])).toEqual([
      'Open',
      'New',
      'Closed',
      'Reopened',
    ]);
  });
});

describe('applyTicketToCardData', () => {
  const data = { name: '', description: null, dueDate: null, userIds: ['5'], labelIds: [] };

  it('fills the dialog in from the ticket', () => {
    expect(applyTicketToCardData(data, TICKET, null)).toEqual({
      name: 'Android APK not functional',
      description:
        '### Hippo #43886: Android APK not functional\n\nCannot pass the OTP screen\n\n— Imported from Hippo ticket #43886',
      dueDate: new Date('2026-10-05T18:30:00.000Z'),
      userIds: ['5', '11'],
      labelIds: [],
    });
  });

  it('lets go of the members a previous ticket brought, keeping those picked by hand', () => {
    const nextTicket = {
      ...TICKET,
      number: '43934',
      assignees: [{ name: 'Deepak', userId: '12' }],
    };

    const prefilledData = applyTicketToCardData(data, TICKET, null);

    expect(applyTicketToCardData(prefilledData, nextTicket, TICKET).userIds).toEqual(['5', '12']);
  });

  it('clears the title and due date a previous ticket brought when the next one has none', () => {
    const nextTicket = { ...TICKET, number: '43934', subject: '', dueDate: null, assignees: [] };
    const prefilledData = applyTicketToCardData(data, TICKET, null);
    const nextData = applyTicketToCardData(prefilledData, nextTicket, TICKET);

    expect(nextData.name).toBe('');
    expect(nextData.dueDate).toBeNull();
  });

  it('keeps a title and due date changed by hand when the next ticket has none', () => {
    const nextTicket = { ...TICKET, number: '43934', subject: '', dueDate: null, assignees: [] };

    const editedData = {
      ...applyTicketToCardData(data, TICKET, null),
      name: 'My own title',
      dueDate: new Date('2026-12-01T10:00:00.000Z'),
    };

    const nextData = applyTicketToCardData(editedData, nextTicket, TICKET);

    expect(nextData.name).toBe('My own title');
    expect(nextData.dueDate).toEqual(new Date('2026-12-01T10:00:00.000Z'));
  });
});

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
      buildHippoImport({
        ticket: TICKET,
        ticketUrl: null,
        ticketState: null,
        selectedEntryIds: [],
      }),
    ).toEqual({
      ticketState: null,
      entryIds: [],
      values: [{ name: HippoFieldNames.TICKET_NUMBER, content: '43886' }],
    });
  });
});

describe('preview helpers', () => {
  it('lists assignees who are not on the board', () => {
    expect(getUnmatchedAssigneeNames(TICKET)).toEqual(['Marketing']);
  });

  it('shows the first line with text', () => {
    expect(getFirstLine('\n\nHi Client,\n\nThanks')).toBe('Hi Client,');
    expect(getFirstLine('')).toBe('');
  });
});

describe('getHippoErrorText', () => {
  const t = (key) => `t:${key}`;

  it('translates the errors Planka raises', () => {
    expect(getHippoErrorText({ message: 'Hippo ticket not found' }, t)).toBe(
      't:common.hippoTicketNotFound',
    );
  });

  it('shows Hippo refusals as worded, and falls back otherwise', () => {
    expect(getHippoErrorText({ message: 'Ticket is closed' }, t)).toBe('Ticket is closed');
    expect(getHippoErrorText({}, t)).toBe('t:common.somethingWentWrong');
  });
});
