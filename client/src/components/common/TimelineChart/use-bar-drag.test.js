import { DragModes, getDraggedDates } from './use-bar-drag';
import { ZoomLevels, getItemRange } from './utils';

describe('getDraggedDates for a card with only a due date', () => {
  const item = { dueDate: new Date(2026, 8, 24, 21, 0) };
  const range = getItemRange(item);

  it('gives it a start date when the whole bar is moved', () => {
    expect(getDraggedDates(item, range, DragModes.MOVE, 1, ZoomLevels.WEEK)).toEqual({
      startDate: new Date(2026, 8, 25, 9, 0),
      dueDate: new Date(2026, 8, 25, 21, 0),
    });
  });

  it('gives it a start date from the drawn start when its start edge is dragged', () => {
    expect(getDraggedDates(item, range, DragModes.RESIZE_START, -1, ZoomLevels.WEEK)).toEqual({
      startDate: new Date(2026, 8, 23, 9, 0),
      dueDate: new Date(2026, 8, 24, 21, 0),
    });
  });

  it('leaves the start date unset when only its end edge is dragged', () => {
    expect(getDraggedDates(item, range, DragModes.RESIZE_END, 1, ZoomLevels.WEEK)).toEqual({
      startDate: undefined,
      dueDate: new Date(2026, 8, 25, 21, 0),
    });
  });
});

describe('getDraggedDates for a card with both dates', () => {
  const item = {
    startDate: new Date(2026, 8, 22, 9, 0),
    dueDate: new Date(2026, 8, 24, 21, 0),
  };
  const range = getItemRange(item);

  it('shifts both dates when moved', () => {
    expect(getDraggedDates(item, range, DragModes.MOVE, 2, ZoomLevels.WEEK)).toEqual({
      startDate: new Date(2026, 8, 24, 9, 0),
      dueDate: new Date(2026, 8, 26, 21, 0),
    });
  });

  it('moves only the start when its start edge is dragged', () => {
    expect(getDraggedDates(item, range, DragModes.RESIZE_START, 1, ZoomLevels.WEEK)).toEqual({
      startDate: new Date(2026, 8, 23, 9, 0),
      dueDate: new Date(2026, 8, 24, 21, 0),
    });
  });
});
