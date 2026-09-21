import {
  DateRanges,
  Statuses,
  SummaryKeys,
  buildDashboardModel,
  filterEntries,
} from './build-dashboard-model';

const NOW = new Date('2026-09-21T12:00:00');
const daysFromNow = (days) => new Date(NOW.getTime() + days * 24 * 60 * 60 * 1000);

const buildData = (cards, extra = {}) => ({
  projects: [{ id: 'p1', name: 'Project' }],
  boards: [{ id: 'b1', projectId: 'p1', name: 'Board' }],
  lists: [
    { id: 'active', boardId: 'b1', type: 'active' },
    { id: 'closed', boardId: 'b1', type: 'closed' },
  ],
  users: [{ id: 'u1', name: 'Alice' }],
  cardMemberships: [],
  boardMemberships: [],
  cardDependencies: [],
  cards: cards.map((card) => ({
    boardId: 'b1',
    listId: 'active',
    listChangedAt: NOW,
    ...card,
  })),
  ...extra,
});

const entryById = (model) =>
  Object.fromEntries(model.entries.map((entry) => [entry.card.id, entry]));

describe('buildDashboardModel', () => {
  test('classifies done, active and upcoming cards', () => {
    const model = buildDashboardModel(
      buildData([
        { id: 'done', listId: 'closed' },
        { id: 'started', startDate: daysFromNow(-2) },
        { id: 'future', startDate: daysFromNow(3) },
        { id: 'dueLater', dueDate: daysFromNow(20) },
        { id: 'undated' },
      ]),
      'u1',
      NOW,
    );

    const entries = entryById(model);

    expect(entries.done.status).toBe(Statuses.DONE);
    expect(entries.started.status).toBe(Statuses.ACTIVE);
    expect(entries.future.status).toBe(Statuses.UPCOMING);
    expect(entries.dueLater.status).toBe(Statuses.UPCOMING);
    expect(entries.undated.status).toBe(Statuses.ACTIVE);
  });

  test('computes summary flags', () => {
    const model = buildDashboardModel(
      buildData(
        [
          { id: 'overdue', dueDate: daysFromNow(-1) },
          { id: 'dueSoon', dueDate: daysFromNow(2) },
          { id: 'closedRecently', listId: 'closed', listChangedAt: daysFromNow(-2) },
          { id: 'closedLongAgo', listId: 'closed', listChangedAt: daysFromNow(-20) },
          { id: 'assigned' },
        ],
        { cardMemberships: [{ cardId: 'assigned', userId: 'u1' }] },
      ),
      'u1',
      NOW,
    );

    const entries = entryById(model);

    expect(entries.overdue.summaryKeys.has(SummaryKeys.OVERDUE)).toBe(true);
    expect(entries.dueSoon.summaryKeys.has(SummaryKeys.DUE_THIS_WEEK)).toBe(true);
    expect(entries.closedRecently.summaryKeys.has(SummaryKeys.COMPLETED_THIS_WEEK)).toBe(true);
    expect(entries.closedLongAgo.summaryKeys.has(SummaryKeys.COMPLETED_THIS_WEEK)).toBe(false);
    expect(entries.overdue.summaryKeys.has(SummaryKeys.UNASSIGNED)).toBe(true);
    expect(entries.assigned.summaryKeys.has(SummaryKeys.UNASSIGNED)).toBe(false);
  });

  test('marks cards editable only on boards where the user is an editor', () => {
    const model = buildDashboardModel(
      buildData([{ id: 'card' }], {
        boardMemberships: [{ boardId: 'b1', userId: 'u1', role: 'editor' }],
      }),
      'u1',
      NOW,
    );

    expect(model.entries[0].isEditable).toBe(true);
    expect(buildDashboardModel(buildData([{ id: 'card' }]), 'u1', NOW).entries[0].isEditable).toBe(
      false,
    );
  });
});

describe('filterEntries', () => {
  const model = buildDashboardModel(
    buildData(
      [
        { id: 'mine', startDate: daysFromNow(0), dueDate: daysFromNow(1) },
        { id: 'other', dueDate: daysFromNow(60) },
        { id: 'done', listId: 'closed' },
      ],
      { cardMemberships: [{ cardId: 'mine', userId: 'u1' }] },
    ),
    'u1',
    NOW,
  );

  const ids = (entries) => entries.map((entry) => entry.card.id);

  test('filters by member', () => {
    expect(
      ids(
        filterEntries(model.entries, {
          userIds: ['u1'],
          projectIds: [],
          dateRange: DateRanges.ALL,
          includeDone: true,
        }),
      ),
    ).toEqual(['mine']);
  });

  test('hides completed cards when asked', () => {
    expect(
      ids(
        filterEntries(model.entries, {
          userIds: [],
          projectIds: [],
          dateRange: DateRanges.ALL,
          includeDone: false,
        }),
      ),
    ).toEqual(['mine', 'other']);
  });
});
