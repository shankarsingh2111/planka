const { expect } = require('chai');

const { mentionMarkupToText } = require('../../utils/mentions');
const {
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
} = require('../../utils/hippo');

describe('hippo', () => {
  describe('request bodies', () => {
    it('asks for a ticket by its number', () => {
      expect(buildTicketDetailsBody('43886')).to.deep.equal({ ticket_id: '43886' });
    });

    it('adds a note', () => {
      expect(buildAddNoteBody('43886', '<p>Hi</p>')).to.deep.equal({
        is_update_ticket: 1,
        ticket_id: '43886',
        update_key: 'NOTE',
        note: '<p>Hi</p>',
      });
    });

    it('updates the status by its name', () => {
      expect(buildUpdateStatusBody('43886', 'Closed')).to.deep.equal({
        is_update_ticket: 1,
        ticket_id: '43886',
        update_key: 'STATUS',
        status: 'Closed',
      });
    });
  });

  describe('classifyHippoResponse', () => {
    it('returns the data of a successful response', () => {
      expect(classifyHippoResponse(200, { statusCode: 200, data: { uid: 1 } })).to.deep.equal({
        data: { uid: 1 },
      });
    });

    it('trusts the statusCode in the body over the HTTP status', () => {
      expect(
        classifyHippoResponse(200, { statusCode: 400, message: 'Ticket not found' }),
      ).to.deep.equal({ exit: HippoExits.TICKET_NOT_FOUND });
    });

    it('treats key problems as unauthorized', () => {
      expect(
        classifyHippoResponse(400, {
          statusCode: 400,
          message: 'ValidationError "app_secret_key" is required',
        }),
      ).to.deep.equal({ exit: HippoExits.UNAUTHORIZED });

      expect(
        classifyHippoResponse(400, { statusCode: 400, message: 'Access Denied' }),
      ).to.deep.equal({ exit: HippoExits.UNAUTHORIZED });
    });

    it('treats server errors and unreadable bodies as unavailable', () => {
      expect(classifyHippoResponse(502, null)).to.deep.equal({ exit: HippoExits.UNAVAILABLE });
      expect(classifyHippoResponse(200, null)).to.deep.equal({ exit: HippoExits.UNAVAILABLE });
    });

    it('passes any other refusal on with its message', () => {
      expect(
        classifyHippoResponse(400, { statusCode: 400, message: 'Something went wrong!' }),
      ).to.deep.equal({ exit: HippoExits.REJECTED, message: 'Something went wrong!' });

      expect(classifyHippoResponse(400, { statusCode: 400 })).to.deep.equal({
        exit: HippoExits.REJECTED,
        message: 'Hippo responded with status 400',
      });
    });
  });

  describe('htmlToMarkdown', () => {
    it('converts HTML to Markdown', () => {
      const markdown = htmlToMarkdown(
        '<p>Hello <strong>there</strong></p><ul><li>One</li><li>Two</li></ul>',
      );

      expect(markdown).to.include('Hello **there**');
      expect(markdown).to.match(/^-\s+One$/m);
      expect(markdown).to.match(/^-\s+Two$/m);
    });

    it('decodes HTML that arrives entity-escaped', () => {
      expect(htmlToMarkdown('&lt;p&gt;Sample issue description&lt;/p&gt;')).to.equal(
        'Sample issue description',
      );
    });

    it('leaves escaped text inside real HTML alone', () => {
      expect(htmlToMarkdown('<p>a &lt; b</p>')).to.equal('a < b');
    });

    it('turns mentions into plain text', () => {
      expect(
        htmlToMarkdown(
          '<p><span class="mention" data-id="5">@Deepak kumar</span> Kindly look into this</p>',
        ),
      ).to.equal('@Deepak kumar Kindly look into this');
    });

    it('returns an empty string for missing content', () => {
      expect(htmlToMarkdown(null)).to.equal('');
      expect(htmlToMarkdown('')).to.equal('');
    });
  });

  describe('buildNoteHtml', () => {
    it('leads with the author and keeps line breaks', () => {
      expect(buildNoteHtml('Divya', 'Fixed in build 42\nPlease retest')).to.equal(
        '<p>Divya (via Planka): Fixed in build 42<br>Please retest</p>',
      );
    });

    it('turns a Planka comment with mentions and markup into a safe note', () => {
      const text = mentionMarkupToText(
        '@[deepak](1357158568008091264) please check <b>this</b> & reply\nThanks',
      );

      expect(buildNoteHtml('A <b>', text)).to.equal(
        '<p>A &lt;b&gt; (via Planka): @deepak please check &lt;b&gt;this&lt;/b&gt; &amp; reply<br>Thanks</p>',
      );
    });
  });

  describe('assignees', () => {
    it('normalizes emails, ignoring case and plus tags', () => {
      expect(normalizeEmail(' Harsh.Sharma+1cs@JungleWorks.com ')).to.equal(
        'harsh.sharma@jungleworks.com',
      );

      expect(normalizeEmail('not-an-email')).to.equal(null);
      expect(normalizeEmail(null)).to.equal(null);
    });

    it('matches assignees to users by email and keeps the unmatched ones', () => {
      const users = [
        { id: '1', email: 'harsh.sharma@jungleworks.com' },
        { id: '2', email: 'deepak@jungleworks.com' },
      ];

      expect(
        matchAssignees(
          [
            { name: 'Harsh Sharma', email: 'harsh.sharma+1cs@jungleworks.com' },
            { name: 'Sarabjot Kaur', email: 'sarabjot@jungleworks.com' },
            { name: 'Marketing', email: null },
          ],
          users,
        ),
      ).to.deep.equal([
        { name: 'Harsh Sharma', userId: '1' },
        { name: 'Sarabjot Kaur', userId: null },
        { name: 'Marketing', userId: null },
      ]);
    });
  });

  describe('mapTicket', () => {
    const data = {
      _id: 'abc',
      uid: 43886,
      subject: 'Android APK not functional',
      issue: '<p>Cannot pass the OTP screen</p>',
      status: 0,
      statusText: 'Pending from Dev',
      priority: { name: 'Normal' },
      type: { name: 'Issue' },
      group: { name: 'Jugnoo' },
      dueDate: '2026-10-05T18:30:00.000Z',
      assignee: [{ fullname: 'Sarabjot Kaur', email: 'sarabjot@jungleworks.com' }],
      notes: [
        {
          _id: 'n1',
          owner: { fullname: 'Harsh Sharma' },
          date: '2026-10-01T06:04:16.000Z',
          note: '<p>@Deepak kumar Kindly look into this</p>',
          deleted: false,
        },
        {
          _id: 'n2',
          owner: { fullname: 'Harsh Sharma' },
          date: '2026-10-01T07:00:00.000Z',
          note: '<p>Old</p>',
          deleted: true,
        },
      ],
      comments: [
        {
          _id: 'c1',
          owner: { fullname: 'Harsh Sharma' },
          date: '2026-09-29T21:38:47.000Z',
          comment: '<p>Hi Client,</p>',
          deleted: false,
        },
      ],
    };

    it('maps the ticket fields', () => {
      const ticket = mapTicket(data, '43886');

      expect(ticket).to.include({
        number: '43886',
        subject: 'Android APK not functional',
        descriptionMarkdown: 'Cannot pass the OTP screen',
        statusText: 'Pending from Dev',
        priority: 'Normal',
        type: 'Issue',
        group: 'Jugnoo',
        dueDate: '2026-10-05T18:30:00.000Z',
      });

      expect(ticket.assignees).to.deep.equal([
        { name: 'Sarabjot Kaur', email: 'sarabjot@jungleworks.com' },
      ]);
    });

    it('lists notes and comments oldest first, without deleted ones', () => {
      expect(mapTicket(data, '43886').entries).to.deep.equal([
        {
          id: 'c1',
          kind: 'comment',
          authorName: 'Harsh Sharma',
          date: '2026-09-29T21:38:47.000Z',
          markdown: 'Hi Client,',
        },
        {
          id: 'n1',
          kind: 'note',
          authorName: 'Harsh Sharma',
          date: '2026-10-01T06:04:16.000Z',
          markdown: '@Deepak kumar Kindly look into this',
        },
      ]);
    });

    it('copes with missing fields', () => {
      expect(mapTicket({}, '7')).to.deep.equal({
        number: '7',
        subject: '',
        descriptionMarkdown: '',
        statusText: null,
        priority: null,
        type: null,
        group: null,
        dueDate: null,
        assignees: [],
        tags: [],
        entries: [],
      });
    });

    it('takes tag names whether Hippo sends them as text or as objects', () => {
      const tags = [
        'Backend',
        { name: 'Apps' },
        { tag: 'Frontend' },
        { title: 'Integration' },
        ' Backend ',
        { name: 'Web, Mobile' },
        { _id: 'no-name' },
        '',
      ];

      expect(mapTicket({ tags }, '7').tags).to.deep.equal([
        'Backend',
        'Apps',
        'Frontend',
        'Integration',
        'Web Mobile',
      ]);
    });
  });

  describe('getTicketValuesByCardId', () => {
    const customFieldGroups = [
      { id: 'g1', boardId: 'b1', cardId: null, name: 'Hippo Ticket' },
      { id: 'g2', boardId: null, cardId: 'c3', name: 'Hippo Ticket' },
      { id: 'g3', boardId: 'b1', cardId: null, name: 'Other' },
    ];

    const customFields = [
      { id: 'f1', customFieldGroupId: 'g1', name: 'Ticket #' },
      { id: 'f2', customFieldGroupId: 'g1', name: 'Ticket State' },
      { id: 'f3', customFieldGroupId: 'g2', name: 'Ticket #' },
    ];

    const customFieldValues = [
      { cardId: 'c1', customFieldGroupId: 'g1', customFieldId: 'f1', content: '43886' },
      { cardId: 'c1', customFieldGroupId: 'g1', customFieldId: 'f2', content: 'Closed' },
      { cardId: 'c2', customFieldGroupId: 'g1', customFieldId: 'f2', content: 'New' },
      { cardId: 'c3', customFieldGroupId: 'g2', customFieldId: 'f3', content: '43934' },
    ];

    const cards = [
      { id: 'c1', boardId: 'b1' },
      { id: 'c2', boardId: 'b1' },
      { id: 'c3', boardId: 'b2' },
      { id: 'c4', boardId: 'b1' },
    ];

    it('reads ticket cards, including a moved card that carries its own group, and skips the rest', () => {
      expect(
        getTicketValuesByCardId({ cards, customFieldGroups, customFields, customFieldValues }),
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
    });
  });
});
