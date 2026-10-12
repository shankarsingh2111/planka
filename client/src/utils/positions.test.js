import { getPositionBetween } from './positions';

// Config reads browser globals on import; only the gap matters here
jest.mock('../constants/Config', () => ({
  __esModule: true,
  default: { POSITION_GAP: 65536 },
}));

// Lane neighbours a and d have hidden cards (unscheduled, or filtered out) between them
const items = [
  { id: 'a', position: 65536 },
  { id: 'x', position: 131072 },
  { id: 'd', position: 196608 },
  { id: 'y', position: 262144 },
  { id: 'b', position: 327680 },
];

describe('getPositionBetween', () => {
  test('lands right before the next lane card, past the hidden ones', () => {
    expect(getPositionBetween(items, { beforeId: 'd', afterId: 'a' }, 'b')).toBe(163840);
  });

  test('lands right after the previous lane card when it goes last in the lane', () => {
    expect(getPositionBetween(items, { beforeId: null, afterId: 'd' }, 'b')).toBe(229376);
  });

  test('goes to the top of the list before the first card', () => {
    expect(getPositionBetween(items, { beforeId: 'a', afterId: null }, 'b')).toBe(32768);
  });

  test('goes to the end of the list without neighbours', () => {
    expect(getPositionBetween(items, { beforeId: null, afterId: null }, 'b')).toBe(327680);
  });

  test('ignores neighbours that are not in the list', () => {
    expect(getPositionBetween(items, { beforeId: 'gone', afterId: 'a' }, 'b')).toBe(98304);
  });
});
