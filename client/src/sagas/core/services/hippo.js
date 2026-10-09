/*!
 * Copyright (c) 2024 PLANKA Software GmbH
 * Licensed under the Fair Use License: https://github.com/plankanban/planka/blob/master/LICENSE.md
 */

import { call, select } from 'redux-saga/effects';
import toast from 'react-hot-toast';

import { createCustomFieldGroupInBoard } from './custom-field-groups';
import { createCustomFieldInGroup, updateCustomField } from './custom-fields';
import { updateCustomFieldValue } from './custom-field-values';
import { syncTicketStateToHippo } from './hippo-sync';
import api from '../../../api';
import selectors from '../../../selectors';
import { HIPPO_FIELD_DEFINITIONS, HIPPO_GROUP_NAME, mergeFieldOptions } from '../../../utils/hippo';
import { isChoiceFieldType, splitMultiselectContent } from '../../../utils/custom-fields';
import { CustomFieldTypes } from '../../../constants/Enums';
import ToastTypes from '../../../constants/ToastTypes';

const getPicks = (definition, values) => {
  const value = values.find(({ name }) => name === definition.name);

  if (!value) {
    return [];
  }

  return definition.type === CustomFieldTypes.MULTISELECT
    ? splitMultiselectContent(value.content)
    : [value.content];
};

/**
 * Finds the board's "Hippo Ticket" group, creating it and whichever of its fields are missing. A
 * choice field takes the type it is defined with, and any default option or imported value it
 * does not offer yet joins its options. Returns the ids to set the values with, or null when the
 * server refused any of it.
 */
export function* ensureHippoFieldGroup(boardId, values) {
  const hippoFieldGroup = yield select(selectors.selectHippoFieldGroupByBoardId, boardId);

  let customFieldGroupId;
  let customFields;

  if (hippoFieldGroup) {
    ({ id: customFieldGroupId, customFields } = hippoFieldGroup);
  } else {
    const customFieldGroup = yield call(createCustomFieldGroupInBoard, boardId, {
      name: HIPPO_GROUP_NAME,
    });

    if (!customFieldGroup) {
      return null;
    }

    customFieldGroupId = customFieldGroup.id;
    customFields = [];
  }

  const customFieldIdByName = {};

  for (let i = 0; i < HIPPO_FIELD_DEFINITIONS.length; i += 1) {
    const { defaultOptions, ...definition } = HIPPO_FIELD_DEFINITIONS[i];
    const isChoice = isChoiceFieldType(definition.type);
    const picks = isChoice ? getPicks(definition, values) : [];

    let customField = customFields.find(({ name }) => name === definition.name);

    if (!customField) {
      customField = yield call(createCustomFieldInGroup, customFieldGroupId, {
        ...definition,
        options: isChoice ? mergeFieldOptions(null, defaultOptions, picks) : null,
      });
    } else if (isChoice) {
      // A field made before it was a dropdown, such as Priority, turns into one
      const isSameType = customField.type === definition.type;

      const options = mergeFieldOptions(
        isSameType ? customField.options : null,
        defaultOptions,
        picks,
      );

      if (!isSameType || options.length !== (customField.options || []).length) {
        customField = yield call(updateCustomField, customField.id, {
          type: definition.type,
          options,
        });
      }
    }

    if (!customField) {
      return null;
    }

    customFieldIdByName[definition.name] = customField.id;
  }

  return {
    customFieldGroupId,
    customFieldIdByName,
  };
}

/**
 * Links a card that was just created to its Hippo ticket: the board's "Hippo Ticket" group gets
 * its fields, and the card its Ticket # and Ticket URL. The server sync then brings in the rest,
 * including the notes and comments picked in the dialog, placed by date. The ones left out are
 * remembered, so a later refresh does not bring them in.
 */
export function* importHippoTicketToCard(card, { values, entryIds, ticketState }) {
  const hippoFieldGroup = yield call(ensureHippoFieldGroup, card.boardId, values);

  let isComplete = !!hippoFieldGroup;

  for (let i = 0; isComplete && i < values.length; i += 1) {
    const { name, content } = values[i];

    const customFieldValue = yield call(
      updateCustomFieldValue,
      card.id,
      hippoFieldGroup.customFieldGroupId,
      hippoFieldGroup.customFieldIdByName[name],
      {
        content,
      },
    );

    isComplete = !!customFieldValue;
  }

  if (isComplete) {
    const accessToken = yield select(selectors.selectAccessToken);

    // Straight to the server, as Hippo may take its whole timeout to answer
    try {
      yield call(
        api.syncHippoCard,
        card.id,
        {
          force: true,
          entryIds,
          ...(ticketState && {
            ticketState,
          }),
        },
        {
          Authorization: `Bearer ${accessToken}`,
        },
      );
    } catch (error) {
      isComplete = false;
    }
  }

  // Hippo wins on every later refresh, so a state picked over Hippo's own is pushed there too
  if (isComplete && ticketState) {
    yield call(syncTicketStateToHippo, card.id);
  }

  if (!isComplete) {
    yield call(toast, {
      type: ToastTypes.HIPPO_IMPORT_INCOMPLETE,
    });
  }
}

export default {
  ensureHippoFieldGroup,
  importHippoTicketToCard,
};
