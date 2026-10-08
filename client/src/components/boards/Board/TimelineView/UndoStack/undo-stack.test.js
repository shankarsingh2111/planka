import {
  MAX_UNDO_ENTRIES,
  pushEntry,
  removeEntry,
  removeEntryWithLater,
  truncateCardName,
} from './undo-stack';

const entry = (id, cardId) => ({ id, cardId });

describe('undo stack', () => {
  it('truncates long card names only', () => {
    expect(truncateCardName('Short')).toBe('Short');
    expect(truncateCardName('Zyro Cabs App Development')).toBe('Zyro Cabs App Develo…');
  });

  it(`keeps the newest ${MAX_UNDO_ENTRIES} entries`, () => {
    let entries = [];
    for (let id = 1; id <= MAX_UNDO_ENTRIES + 3; id += 1) {
      entries = pushEntry(entries, entry(id, 'a'));
    }

    expect(entries).toHaveLength(MAX_UNDO_ENTRIES);
    expect(entries[0].id).toBe(4);
    expect(entries[entries.length - 1].id).toBe(MAX_UNDO_ENTRIES + 3);
  });

  it('removes only the closed entry', () => {
    const entries = [entry(1, 'x'), entry(2, 'x')];
    expect(removeEntry(entries, 1)).toEqual([entry(2, 'x')]);
  });

  it('drops later entries for the same card on undo, keeping earlier ones and other cards', () => {
    const entries = [entry(1, 'x'), entry(2, 'x'), entry(3, 'y'), entry(4, 'x')];
    expect(removeEntryWithLater(entries, 2)).toEqual([entry(1, 'x'), entry(3, 'y')]);
  });
});
