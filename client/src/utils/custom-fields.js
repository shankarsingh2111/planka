/*!
 * Copyright (c) 2024 PLANKA Software GmbH
 * Licensed under the Fair Use License: https://github.com/plankanban/planka/blob/master/LICENSE.md
 */

import { CustomFieldTypes } from '../constants/Enums';

// Trimmed, without blanks or repeats, in the order given
export const cleanCustomFieldOptions = (options) =>
  options.reduce((result, option) => {
    const trimmedOption = option.trim();

    return trimmedOption && !result.includes(trimmedOption) ? [...result, trimmedOption] : result;
  }, []);

// What an add or edit form sends; options only travel with dropdown fields
export const buildCustomFieldData = ({ name, showOnFrontOfCard, type, options }) => ({
  name: name.trim() || null,
  showOnFrontOfCard,
  type,
  options: type === CustomFieldTypes.DROPDOWN ? cleanCustomFieldOptions(options) : null,
});

export const isCustomFieldDataComplete = (data) =>
  !!data.name && (data.type !== CustomFieldTypes.DROPDOWN || data.options.length > 0);
