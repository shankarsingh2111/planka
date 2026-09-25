import { getAddCardDefaults } from './add-card-defaults';
import { GroupByOptions, NO_VALUE_KEY } from './constants';

const DEFAULT_LIST_ID = 'list-first';

const startDate = new Date(2026, 8, 24, 9, 0, 0, 0);
const dueDate = new Date(2026, 8, 24, 21, 0, 0, 0);

describe('getAddCardDefaults', () => {
  it.each([
    [
      'puts the card in the list of a list lane',
      GroupByOptions.LIST,
      'list-3',
      { listId: 'list-3', userIds: [], labelIds: [] },
    ],
    [
      'assigns the member of a member lane, in the default list',
      GroupByOptions.MEMBER,
      'user-7',
      { listId: 'list-first', userIds: ['user-7'], labelIds: [] },
    ],
    [
      'assigns nobody from the unassigned lane',
      GroupByOptions.MEMBER,
      NO_VALUE_KEY,
      { listId: 'list-first', userIds: [], labelIds: [] },
    ],
    [
      'applies the label of a label lane, in the default list',
      GroupByOptions.LABEL,
      'label-2',
      { listId: 'list-first', userIds: [], labelIds: ['label-2'] },
    ],
    [
      'applies no label from the no-labels lane',
      GroupByOptions.LABEL,
      NO_VALUE_KEY,
      { listId: 'list-first', userIds: [], labelIds: [] },
    ],
    [
      'carries only the dates without grouping',
      GroupByOptions.NONE,
      NO_VALUE_KEY,
      { listId: 'list-first', userIds: [], labelIds: [] },
    ],
  ])('%s', (_, groupBy, laneKey, expected) => {
    expect(getAddCardDefaults(groupBy, laneKey, { startDate, dueDate }, DEFAULT_LIST_ID)).toEqual({
      ...expected,
      startDate: new Date(2026, 8, 24, 9, 0, 0, 0),
      dueDate: new Date(2026, 8, 24, 21, 0, 0, 0),
    });
  });
});
