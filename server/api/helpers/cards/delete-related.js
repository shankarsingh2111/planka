/*!
 * Copyright (c) 2024 PLANKA Software GmbH
 * Licensed under the Fair Use License: https://github.com/plankanban/planka/blob/master/LICENSE.md
 */

module.exports = {
  inputs: {
    recordOrRecords: {
      type: 'ref',
      required: true,
    },
  },

  async fn(inputs) {
    let cardIdOrIds;
    if (_.isPlainObject(inputs.recordOrRecords)) {
      ({
        recordOrRecords: { id: cardIdOrIds },
      } = inputs);
    } else if (_.every(inputs.recordOrRecords, _.isPlainObject)) {
      cardIdOrIds = sails.helpers.utils.mapRecords(inputs.recordOrRecords);
    }

    // A card of a series deleted on its own takes its day out of the series for good, so that
    // changing the series later doesn't bring it back
    const records = _.isPlainObject(inputs.recordOrRecords)
      ? [inputs.recordOrRecords]
      : inputs.recordOrRecords;

    const occurrenceDatesByRecurrenceId = records.reduce((result, record) => {
      if (_.isPlainObject(record) && record.recurrenceId && record.occurrenceDate) {
        // eslint-disable-next-line no-param-reassign
        result[record.recurrenceId] = [
          ...(result[record.recurrenceId] || []),
          record.occurrenceDate,
        ];
      }

      return result;
    }, {});

    await Promise.all(
      Object.entries(occurrenceDatesByRecurrenceId).map(([recurrenceId, occurrenceDates]) =>
        CardRecurrence.qm.addExcludedDates(recurrenceId, occurrenceDates),
      ),
    );

    await CardSubscription.qm.delete({
      cardId: cardIdOrIds,
    });

    await CardMembership.qm.delete({
      cardId: cardIdOrIds,
    });

    await CardLabel.qm.delete({
      cardId: cardIdOrIds,
    });

    await CardDependency.qm.delete({
      or: [
        {
          predecessorCardId: cardIdOrIds,
        },
        {
          successorCardId: cardIdOrIds,
        },
      ],
    });

    const taskLists = await TaskList.qm.delete({
      cardId: cardIdOrIds,
    });

    await sails.helpers.taskLists.deleteRelated(taskLists);

    await Task.qm.update(
      {
        linkedCardId: cardIdOrIds,
      },
      {
        linkedCardId: null,
      },
    );

    const { uploadedFiles } = await Attachment.qm.delete({
      cardId: cardIdOrIds,
    });

    sails.helpers.utils.removeUnreferencedUploadedFiles(uploadedFiles);

    const customFieldGroups = await CustomFieldGroup.qm.delete({
      cardId: cardIdOrIds,
    });

    await sails.helpers.customFieldGroups.deleteRelated(customFieldGroups);

    await Comment.qm.delete({
      cardId: cardIdOrIds,
    });

    await HippoCardEntry.qm.delete({
      cardId: cardIdOrIds,
    });

    await HippoCardSync.qm.delete({
      cardId: cardIdOrIds,
    });

    await Action.qm.delete({
      cardId: cardIdOrIds,
    });
  },
};
