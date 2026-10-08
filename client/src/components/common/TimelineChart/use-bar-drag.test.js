import { DragModes, getAutoScrollDirection, getDraggedDates } from './use-bar-drag';
import { isPointOverVisibleCanvas } from './use-drop-target';
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

describe('getAutoScrollDirection', () => {
  // Lane headers take the first 220px, the date header the first 60px
  const rect = { left: 0, top: 0, right: 1000, bottom: 600 };
  const headerHeight = 60;

  it('stays still in the middle of the canvas', () => {
    expect(getAutoScrollDirection(500, 300, rect, headerHeight)).toEqual({ x: 0, y: 0 });
  });

  it('scrolls towards each edge just inside the headers', () => {
    expect(getAutoScrollDirection(230, 300, rect, headerHeight)).toEqual({ x: -1, y: 0 });
    expect(getAutoScrollDirection(990, 300, rect, headerHeight)).toEqual({ x: 1, y: 0 });
    expect(getAutoScrollDirection(500, 70, rect, headerHeight)).toEqual({ x: 0, y: -1 });
    expect(getAutoScrollDirection(500, 590, rect, headerHeight)).toEqual({ x: 0, y: 1 });
  });

  it('does not scroll over the lane headers or outside the scroll area', () => {
    expect(getAutoScrollDirection(100, 300, rect, headerHeight)).toEqual({ x: 0, y: 0 });
    expect(getAutoScrollDirection(-20, 300, rect, headerHeight)).toEqual({ x: 0, y: 0 });
    expect(getAutoScrollDirection(500, 700, rect, headerHeight)).toEqual({ x: 0, y: 0 });
  });
});

describe('isPointOverVisibleCanvas', () => {
  const rect = { left: 300, top: 100, right: 1300, bottom: 700 };
  const headerHeight = 60;

  it('accepts a point over the visible dates', () => {
    expect(isPointOverVisibleCanvas(800, 400, rect, headerHeight)).toBe(true);
  });

  it('rejects the sidebar, lane headers and date header', () => {
    expect(isPointOverVisibleCanvas(150, 400, rect, headerHeight)).toBe(false);
    expect(isPointOverVisibleCanvas(400, 400, rect, headerHeight)).toBe(false);
    expect(isPointOverVisibleCanvas(800, 130, rect, headerHeight)).toBe(false);
  });
});
