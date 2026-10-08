/*!
 * Copyright (c) 2024 PLANKA Software GmbH
 * Licensed under the Fair Use License: https://github.com/plankanban/planka/blob/master/LICENSE.md
 */

import { CustomFieldTypes } from '../constants/Enums';

// The server reads picks the same way (server/utils/custom-fields.js)
const MULTISELECT_SEPARATOR = ', ';

// Field types whose values are picked from a list of options
export const isChoiceFieldType = (type) =>
  type === CustomFieldTypes.DROPDOWN || type === CustomFieldTypes.MULTISELECT;

export const splitMultiselectContent = (content) =>
  content ? content.split(MULTISELECT_SEPARATOR) : [];

export const joinMultiselectContent = (picks) =>
  picks.length > 0 ? picks.join(MULTISELECT_SEPARATOR) : null;

// Trimmed, without blanks or repeats, in the order given
export const cleanCustomFieldOptions = (options) =>
  options.reduce((result, option) => {
    const trimmedOption = option.trim();

    return trimmedOption && !result.includes(trimmedOption) ? [...result, trimmedOption] : result;
  }, []);

// What an add or edit form sends; options only travel with dropdown and multi-select fields
export const buildCustomFieldData = ({ name, showOnFrontOfCard, type, options }) => ({
  name: name.trim() || null,
  showOnFrontOfCard,
  type,
  options: isChoiceFieldType(type) ? cleanCustomFieldOptions(options) : null,
});

// A comma would split a multi-select option in two once picked
export const isCustomFieldDataComplete = (data) =>
  !!data.name &&
  (!isChoiceFieldType(data.type) || data.options.length > 0) &&
  (data.type !== CustomFieldTypes.MULTISELECT ||
    data.options.every((option) => !option.includes(',')));
