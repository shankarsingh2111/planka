import {
  buildCustomFieldData,
  cleanCustomFieldOptions,
  isCustomFieldDataComplete,
} from './custom-fields';

describe('cleanCustomFieldOptions', () => {
  it('trims options and drops blanks and repeats', () => {
    expect(cleanCustomFieldOptions([' New ', '', 'Closed', 'New', '  '])).toEqual([
      'New',
      'Closed',
    ]);
  });
});

describe('buildCustomFieldData', () => {
  it('keeps the cleaned options of a dropdown', () => {
    expect(
      buildCustomFieldData({
        name: ' State ',
        showOnFrontOfCard: true,
        type: 'dropdown',
        options: ['New', ' New', 'Closed'],
      }),
    ).toEqual({
      name: 'State',
      showOnFrontOfCard: true,
      type: 'dropdown',
      options: ['New', 'Closed'],
    });
  });

  it('drops the options of a text field', () => {
    expect(
      buildCustomFieldData({
        name: 'Notes',
        showOnFrontOfCard: false,
        type: 'text',
        options: ['A'],
      }),
    ).toEqual({ name: 'Notes', showOnFrontOfCard: false, type: 'text', options: null });
  });

  it('turns a blank name into null', () => {
    expect(
      buildCustomFieldData({ name: '   ', showOnFrontOfCard: false, type: 'text', options: [] })
        .name,
    ).toBeNull();
  });
});

describe('isCustomFieldDataComplete', () => {
  it('needs a name', () => {
    expect(isCustomFieldDataComplete({ name: null, type: 'text', options: null })).toBe(false);
  });

  it('needs at least one option for a dropdown', () => {
    expect(isCustomFieldDataComplete({ name: 'State', type: 'dropdown', options: [] })).toBe(false);

    expect(isCustomFieldDataComplete({ name: 'State', type: 'dropdown', options: ['New'] })).toBe(
      true,
    );
  });

  it('accepts a named text field', () => {
    expect(isCustomFieldDataComplete({ name: 'Notes', type: 'text', options: null })).toBe(true);
  });
});
