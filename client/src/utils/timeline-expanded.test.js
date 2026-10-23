import { getIsTimelineExpanded, setIsTimelineExpanded } from './timeline-expanded';

describe('setIsTimelineExpanded', () => {
  let stored;

  beforeEach(() => {
    stored = {};

    global.window = {
      localStorage: {
        getItem: (key) => (key in stored ? stored[key] : null),
        setItem: (key, value) => {
          stored[key] = value;
        },
      },
    };
  });

  afterEach(() => {
    setIsTimelineExpanded(false);
    delete global.window;
  });

  test('changes the value and remembers it in this browser', () => {
    setIsTimelineExpanded(true);

    expect(getIsTimelineExpanded()).toBe(true);
    expect(stored.timelineExpanded).toBe('true');
  });

  test('keeps working when storage refuses writes', () => {
    window.localStorage.setItem = () => {
      throw new Error('denied');
    };

    setIsTimelineExpanded(true);

    expect(getIsTimelineExpanded()).toBe(true);
  });
});
