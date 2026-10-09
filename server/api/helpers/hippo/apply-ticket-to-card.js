/*!
 * Copyright (c) 2024 PLANKA Software GmbH
 * Licensed under the Fair Use License: https://github.com/plankanban/planka/blob/master/LICENSE.md
 */

const { POSITION_GAP } = require('../../../constants');
const { HippoFieldNames } = require('../../../utils/hippo');
const {
  EntryRecordKinds,
  HIPPO_FIELD_DEFINITIONS,
  applyDescriptionBlock,
  buildCommentIdFromDate,
  buildEntryCommentText,
  buildFieldContents,
  getPicks,
  planEntries,
  planFieldChange,
} = require('../../../utils/hippo-card-sync');

const MAX_ID_ATTEMPTS = 3;

const Warnings = {
  DESCRIPTION_NOT_SAVED: 'descriptionNotSaved',
  FIELDS_NOT_SAVED: 'fieldsNotSaved',
  MEMBER_NOT_ADDED: 'memberNotAdded',
  COMMENT_NOT_ADDED: 'commentNotAdded',
};

// The card is read again here, as an edit saved while Hippo was answering must not be lost
const updateDescription = async ({ card, list, board, project, ticket, actorUser, request }) => {
  const currentCard = await Card.qm.getOneById(card.id);

  if (!currentCard) {
    return false;
  }

  const description = applyDescriptionBlock(currentCard.description, ticket);

  if (description === currentCard.description) {
    return true;
  }

  await sails.helpers.cards.updateOne.with({
    record: currentCard,
    values: {
      description,
    },
    project,
    board,
    list,
    actorUser,
    request,
  });
  return true;
};

// The group gets whichever fields and options it lacks, then the ticket's State, Priority and Tags
const updateFields = async ({
  card,
  list,
  board,
  project,
  ticket,
  customFieldGroupId,
  ticketState,
  actorUser,
  request,
}) => {
  const customFieldGroup = await CustomFieldGroup.qm.getOneById(customFieldGroupId);
  const customFields = await CustomField.qm.getByCustomFieldGroupId(customFieldGroupId);

  const customFieldValues = await CustomFieldValue.qm.getByCardIds([card.id], {
    customFieldGroupIdOrIds: customFieldGroupId,
  });

  const getContent = (customField) => {
    const customFieldValue =
      customField &&
      customFieldValues.find(
        (customFieldValueItem) => customFieldValueItem.customFieldId === customField.id,
      );

    return customFieldValue ? customFieldValue.content : null;
  };

  const contents = buildFieldContents({
    ticket,
    ticketState,
    currentTags: getContent(customFields.find(({ name }) => name === HippoFieldNames.TAGS)),
  });

  let lastPosition = customFields.reduce(
    (result, customField) => Math.max(result, customField.position),
    0,
  );

  // eslint-disable-next-line no-restricted-syntax
  for (const definition of HIPPO_FIELD_DEFINITIONS) {
    let customField = customFields.find(({ name }) => name === definition.name);
    const content = contents[definition.name] || null;
    const change = planFieldChange(definition, customField, getPicks(definition, content));

    if (change.action === 'create') {
      lastPosition += POSITION_GAP;

      // eslint-disable-next-line no-await-in-loop
      customField = await sails.helpers.customFields.createOneInCustomFieldGroup.with({
        project,
        board,
        list,
        card,
        values: {
          ...change.values,
          position: lastPosition,
          customFieldGroup,
        },
        actorUser,
        request,
      });
    } else if (change.action === 'update') {
      // eslint-disable-next-line no-await-in-loop
      customField = await sails.helpers.customFields.updateOneInCustomFieldGroup.with({
        record: customField,
        values: change.values,
        project,
        board,
        list,
        card,
        customFieldGroup,
        actorUser,
        request,
      });
    }

    if (customField && content && content !== getContent(customField)) {
      // eslint-disable-next-line no-await-in-loop
      await sails.helpers.customFieldValues.createOrUpdateOne.with({
        project,
        board,
        list,
        values: {
          card,
          customFieldGroup,
          customField,
          content,
        },
        actorUser,
        request,
      });
    }
  }
};

// Assignees on the board join the card; nobody leaves it
const addMembers = async ({ card, list, board, project, ticket, users, actorUser, request }) => {
  const cardMemberships = await CardMembership.qm.getByCardId(card.id);
  const memberUserIds = sails.helpers.utils.mapRecords(cardMemberships, 'userId');

  const userIds = _.uniq(
    ticket.assignees.flatMap((assignee) => (assignee.userId ? [assignee.userId] : [])),
  ).filter((userId) => !memberUserIds.includes(userId));

  let isComplete = true;

  // eslint-disable-next-line no-restricted-syntax
  for (const userId of userIds) {
    const user = users.find((userItem) => userItem.id === userId);

    try {
      // eslint-disable-next-line no-await-in-loop
      await sails.helpers.cardMemberships.createOne.with({
        project,
        board,
        list,
        values: {
          card,
          user,
        },
        actorUser,
        request,
      });
    } catch (error) {
      isComplete = false;
    }
  }

  return isComplete;
};

// The comment takes an id built from its Hippo date, so it sorts among the card's comments by
// that date. An id another comment already has is retried, then left to the database.
const createEntryComment = async ({ card, list, board, project, entry, actorUser, request }) => {
  const createdAt = buildCommentIdFromDate(entry.date) ? new Date(entry.date).toISOString() : null;

  for (let attempt = 0; attempt <= MAX_ID_ATTEMPTS; attempt += 1) {
    const id = attempt < MAX_ID_ATTEMPTS ? buildCommentIdFromDate(entry.date) : null;

    try {
      // eslint-disable-next-line no-await-in-loop
      return await sails.helpers.comments.createOne.with({
        values: {
          ...(id && {
            id,
          }),
          text: buildEntryCommentText(entry),
          card,
          user: actorUser,
        },
        project,
        board,
        list,
        createdAt: createdAt || undefined,
        isImported: true,
        request,
      });
    } catch (error) {
      if (!id || error.code !== 'E_UNIQUE') {
        throw error;
      }
    }
  }

  return null;
};

// Each new entry's record goes in before its comment: the unique index lets only one sync claim
// an entry, so two syncs at once never post it twice
const importEntries = async ({
  card,
  list,
  board,
  project,
  ticket,
  entryIds,
  actorUser,
  request,
}) => {
  const records = await HippoCardEntry.qm.getByCardIdAndTicketNumber(card.id, ticket.number);
  const comments = await Comment.qm.getAllByCardId(card.id);

  const { toImport, toRecord } = planEntries({
    entries: ticket.entries,
    records,
    comments,
    entryIds,
  });

  // eslint-disable-next-line no-restricted-syntax
  for (const { entryId, kind, commentId } of toRecord) {
    // eslint-disable-next-line no-await-in-loop
    await HippoCardEntry.qm.createOne({
      cardId: card.id,
      ticketNumber: ticket.number,
      entryId,
      kind,
      commentId,
    });
  }

  let isComplete = true;

  // eslint-disable-next-line no-restricted-syntax
  for (const entry of toImport) {
    // eslint-disable-next-line no-await-in-loop
    const record = await HippoCardEntry.qm.createOne({
      cardId: card.id,
      ticketNumber: ticket.number,
      entryId: entry.id,
      kind: EntryRecordKinds.IMPORTED,
    });

    if (record) {
      try {
        // eslint-disable-next-line no-await-in-loop
        const comment = await createEntryComment({
          card,
          list,
          board,
          project,
          entry,
          actorUser,
          request,
        });

        // eslint-disable-next-line no-await-in-loop
        await HippoCardEntry.qm.updateOne(record.id, {
          commentId: comment.id,
        });
      } catch (error) {
        // The entry is tried again on the next sync
        // eslint-disable-next-line no-await-in-loop
        await HippoCardEntry.qm.delete({
          id: record.id,
        });

        isComplete = false;
      }
    }
  }

  return isComplete;
};

// Each step saves on its own, so one failing (a member who left the board, say) leaves the rest
const runStep = async (step, inputs, warning, warnings) => {
  try {
    const isComplete = await step(inputs);

    if (isComplete === false) {
      warnings.push(warning);
    }
  } catch (error) {
    sails.log.warn(`Hippo sync of card ${inputs.card.id}: ${warning}`, error);
    warnings.push(warning);
  }
};

module.exports = {
  inputs: {
    card: {
      type: 'ref',
      required: true,
    },
    list: {
      type: 'ref',
      required: true,
    },
    board: {
      type: 'ref',
      required: true,
    },
    project: {
      type: 'ref',
      required: true,
    },
    ticket: {
      type: 'ref',
      required: true,
    },
    customFieldGroupId: {
      type: 'string',
      required: true,
    },
    users: {
      type: 'ref',
      required: true,
    },
    ticketState: {
      type: 'string',
    },
    entryIds: {
      type: 'ref',
    },
    actorUser: {
      type: 'ref',
      required: true,
    },
    request: {
      type: 'ref',
    },
  },

  async fn(inputs) {
    const warnings = [];

    // ---- Step 1: Write the ticket's block into the description ----
    await runStep(updateDescription, inputs, Warnings.DESCRIPTION_NOT_SAVED, warnings);

    // ---- Step 2: Set State, Priority and Tags ----
    await runStep(updateFields, inputs, Warnings.FIELDS_NOT_SAVED, warnings);

    // ---- Step 3: Add assignees as members ----
    await runStep(addMembers, inputs, Warnings.MEMBER_NOT_ADDED, warnings);

    // ---- Step 4: Add new notes and comments, placed by date ----
    await runStep(importEntries, inputs, Warnings.COMMENT_NOT_ADDED, warnings);

    return {
      warnings,
    };
  },
};
