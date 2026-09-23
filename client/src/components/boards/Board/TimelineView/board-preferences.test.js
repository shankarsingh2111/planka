import { readBoardPreferences, writeBoardPreferences } from './board-preferences';

const BOARD_ID = 'board-1';

describe('readBoardPreferences', () => {
  it('returns empty preferences when nothing is stored', () => {
    expect(readBoardPreferences(undefined, BOARD_ID)).toEqual({
      hiddenLaneKeys: {},
      collapsedLaneKeys: [],
    });

    expect(readBoardPreferences({}, BOARD_ID)).toEqual({
      hiddenLaneKeys: {},
      collapsedLaneKeys: [],
    });
  });

  it('fills in missing halves of a partially stored entry', () => {
    expect(readBoardPreferences({ [BOARD_ID]: { collapsedLaneKeys: ['a'] } }, BOARD_ID)).toEqual({
      hiddenLaneKeys: {},
      collapsedLaneKeys: ['a'],
    });

    expect(
      readBoardPreferences({ [BOARD_ID]: { hiddenLaneKeys: { list: ['a'] } } }, BOARD_ID),
    ).toEqual({
      hiddenLaneKeys: { list: ['a'] },
      collapsedLaneKeys: [],
    });
  });

  it('reads only the requested board', () => {
    const stored = {
      'board-2': { hiddenLaneKeys: { list: ['x'] }, collapsedLaneKeys: ['y'] },
    };

    expect(readBoardPreferences(stored, BOARD_ID)).toEqual({
      hiddenLaneKeys: {},
      collapsedLaneKeys: [],
    });
  });
});

describe('writeBoardPreferences', () => {
  it('stores a board that has hidden lanes', () => {
    const result = writeBoardPreferences({}, BOARD_ID, {
      hiddenLaneKeys: { list: ['a'] },
      collapsedLaneKeys: [],
    });

    expect(result).toEqual({
      [BOARD_ID]: { hiddenLaneKeys: { list: ['a'] }, collapsedLaneKeys: [] },
    });
  });

  it('stores a board that only has collapsed lanes', () => {
    const result = writeBoardPreferences({}, BOARD_ID, {
      hiddenLaneKeys: {},
      collapsedLaneKeys: ['a'],
    });

    expect(result[BOARD_ID]).toEqual({ hiddenLaneKeys: {}, collapsedLaneKeys: ['a'] });
  });

  it('prunes a board once nothing is hidden or collapsed', () => {
    const stored = {
      [BOARD_ID]: { hiddenLaneKeys: { list: ['a'] }, collapsedLaneKeys: [] },
    };

    const result = writeBoardPreferences(stored, BOARD_ID, {
      hiddenLaneKeys: { list: [] },
      collapsedLaneKeys: [],
    });

    expect(result).toEqual({});
  });

  it('prunes when every grouping has been emptied', () => {
    const result = writeBoardPreferences({ [BOARD_ID]: {} }, BOARD_ID, {
      hiddenLaneKeys: { list: [], member: [], label: [] },
      collapsedLaneKeys: [],
    });

    expect(result).toEqual({});
  });

  it('leaves other boards untouched', () => {
    const stored = {
      'board-2': { hiddenLaneKeys: { list: ['x'] }, collapsedLaneKeys: [] },
    };

    const result = writeBoardPreferences(stored, BOARD_ID, {
      hiddenLaneKeys: { list: ['a'] },
      collapsedLaneKeys: [],
    });

    expect(result['board-2']).toEqual({ hiddenLaneKeys: { list: ['x'] }, collapsedLaneKeys: [] });
    expect(Object.keys(result).sort()).toEqual(['board-1', 'board-2']);
  });

  it('does not mutate the stored map', () => {
    const stored = { [BOARD_ID]: { hiddenLaneKeys: { list: ['a'] }, collapsedLaneKeys: [] } };
    const snapshot = JSON.parse(JSON.stringify(stored));

    writeBoardPreferences(stored, BOARD_ID, { hiddenLaneKeys: {}, collapsedLaneKeys: [] });

    expect(stored).toEqual(snapshot);
  });
});
