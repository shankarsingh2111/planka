import {
  buildCustomFieldData,
  cleanCustomFieldOptions,
  isCustomFieldDataComplete,
  joinMultiselectContent,
  splitMultiselectContent,
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

  it('keeps the cleaned options of a multi-select', () => {
    expect(
      buildCustomFieldData({
        name: 'Tags',
        showOnFrontOfCard: false,
        type: 'multiselect',
        options: ['Apps', ' Apps', 'Backend'],
      }).options,
    ).toEqual(['Apps', 'Backend']);
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

describe('multi-select content', () => {
  it('joins picks into one text and splits them back', () => {
    expect(joinMultiselectContent(['Apps', 'Backend'])).toBe('Apps, Backend');
    expect(splitMultiselectContent('Apps, Backend')).toEqual(['Apps', 'Backend']);
  });

  it('treats no picks as no value', () => {
    expect(joinMultiselectContent([])).toBeNull();
    expect(splitMultiselectContent(null)).toEqual([]);
    expect(splitMultiselectContent('')).toEqual([]);
  });
});

describe('isCustomFieldDataComplete for multi-selects', () => {
  it('needs options, none with a comma', () => {
    expect(isCustomFieldDataComplete({ name: 'Tags', type: 'multiselect', options: [] })).toBe(
      false,
    );

    expect(
      isCustomFieldDataComplete({ name: 'Tags', type: 'multiselect', options: ['Web, Mobile'] }),
    ).toBe(false);

    expect(
      isCustomFieldDataComplete({ name: 'Tags', type: 'multiselect', options: ['Apps'] }),
    ).toBe(true);
  });
});
