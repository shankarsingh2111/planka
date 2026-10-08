const { expect } = require('chai');

const { cleanOptions, normalizeTypeValues, isValueAllowed } = require('../../utils/custom-fields');

describe('custom-fields', () => {
  describe('cleanOptions', () => {
    it('trims options and drops blanks and repeats', () => {
      expect(cleanOptions([' New ', 'Closed', '', 'New', '  '])).to.deep.equal(['New', 'Closed']);
    });

    it('rejects lists that are empty, not lists, or hold non-strings', () => {
      expect(cleanOptions([])).to.equal(null);
      expect(cleanOptions(['', ' '])).to.equal(null);
      expect(cleanOptions('New')).to.equal(null);
      expect(cleanOptions(['New', 3])).to.equal(null);
      expect(cleanOptions(null)).to.equal(null);
    });

    it('rejects too many or too long options', () => {
      const tooMany = Array.from({ length: 101 }, (_, index) => `Option ${index}`);

      expect(cleanOptions(tooMany)).to.equal(null);
      expect(cleanOptions(['x'.repeat(129)])).to.equal(null);
    });
  });

  describe('normalizeTypeValues', () => {
    it('defaults a new field to text without options', () => {
      expect(normalizeTypeValues({ name: 'Notes' })).to.deep.equal({ type: 'text', options: null });
    });

    it('drops the options of a text field', () => {
      expect(normalizeTypeValues({ type: 'text', options: ['A'] })).to.deep.equal({
        type: 'text',
        options: null,
      });
    });

    it('keeps the cleaned options of a dropdown', () => {
      expect(normalizeTypeValues({ type: 'dropdown', options: ['A', ' B '] })).to.deep.equal({
        type: 'dropdown',
        options: ['A', 'B'],
      });
    });

    it('refuses a dropdown without options', () => {
      expect(normalizeTypeValues({ type: 'dropdown' })).to.equal(null);
      expect(normalizeTypeValues({ type: 'dropdown', options: [] })).to.equal(null);
    });

    it('falls back to the existing field for whatever an update leaves out', () => {
      const record = { type: 'dropdown', options: ['A', 'B'] };

      expect(normalizeTypeValues({ options: ['C'] }, record)).to.deep.equal({
        type: 'dropdown',
        options: ['C'],
      });

      expect(normalizeTypeValues({ type: 'dropdown' }, record)).to.deep.equal({
        type: 'dropdown',
        options: ['A', 'B'],
      });

      expect(normalizeTypeValues({ type: 'text' }, record)).to.deep.equal({
        type: 'text',
        options: null,
      });
    });
  });

  describe('isValueAllowed', () => {
    it('lets text fields hold anything', () => {
      expect(isValueAllowed({ type: 'text', options: null }, 'Anything')).to.equal(true);
    });

    it('limits dropdown fields to their options', () => {
      const customField = { type: 'dropdown', options: ['New', 'Closed'] };

      expect(isValueAllowed(customField, 'Closed')).to.equal(true);
      expect(isValueAllowed(customField, 'Reopened')).to.equal(false);
    });
  });
});
