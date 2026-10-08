/*!
 * Copyright (c) 2024 PLANKA Software GmbH
 * Licensed under the Fair Use License: https://github.com/plankanban/planka/blob/master/LICENSE.md
 */

const { Types } = require('../api/models/CustomField');

const MAX_OPTIONS = 100;
const MAX_OPTION_LENGTH = 128;

// Trimmed, without blanks or repeats; null when the list is not a usable set of options
const cleanOptions = (options) => {
  if (!Array.isArray(options) || options.some((option) => typeof option !== 'string')) {
    return null;
  }

  const result = [];

  options.forEach((option) => {
    const trimmedOption = option.trim();

    if (trimmedOption && !result.includes(trimmedOption)) {
      result.push(trimmedOption);
    }
  });

  if (
    result.length === 0 ||
    result.length > MAX_OPTIONS ||
    result.some((option) => option.length > MAX_OPTION_LENGTH)
  ) {
    return null;
  }

  return result;
};

// The type and options a field ends up with once the given values apply to it. A dropdown needs
// options to pick from, so null means the values are invalid.
const normalizeTypeValues = (values, record = {}) => {
  const type = values.type || record.type || Types.TEXT;

  if (type !== Types.DROPDOWN) {
    return {
      type,
      options: null,
    };
  }

  const options = cleanOptions(values.options === undefined ? record.options : values.options);

  if (!options) {
    return null;
  }

  return {
    type,
    options,
  };
};

const isValueAllowed = (customField, content) =>
  customField.type !== Types.DROPDOWN || (customField.options || []).includes(content);

module.exports = {
  cleanOptions,
  normalizeTypeValues,
  isValueAllowed,
};
