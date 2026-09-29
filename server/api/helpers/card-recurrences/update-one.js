/*!
 * Copyright (c) 2024 PLANKA Software GmbH
 * Licensed under the Fair Use License: https://github.com/plankanban/planka/blob/master/LICENSE.md
 */

const {
  MAX_SPAN_DAYS,
  addDays,
  diffDays,
  getWeekday,
  shiftWeekdays,
  getToday,
  getTimePattern,
  getOccurrenceCardDates,
  buildOccurrenceDates,
} = require('../../../utils/recurrence');

const toISOString = (date) => (date ? new Date(date).toISOString() : null);

const laterDate = (a, b) => (a > b ? a : b);

/**
 * Applies an edit made on one card of a series to that card and to the other cards in scope:
 * those from it on ("following") or all of them. Done cards and cards in the archive or trash
 * are history and stay as they are, except the edited card itself.
 *
 * Only what the edit changes is written, so a card edited on its own keeps its other changes.
 * Moving the card to another day moves every card in scope by as many days, weekdays included.
 * A new repeat rule or end date deletes the open cards it no longer lands on, and creates the
 * missing ones as copies of the edited card; days deleted by hand are never created again.
 */
module.exports = {
  inputs: {
    record: {
      type: 'ref',
      required: true,
    },
    card: {
      type: 'ref',
      required: true,
    },
    values: {
      type: 'ref',
      required: true,
    },
    // One of CardRecurrence.Scopes (models aren't loaded yet when helpers are defined)
    scope: {
      type: 'string',
      required: true,
    },
    project: {
      type: 'ref',
      required: true,
    },
    board: {
      type: 'ref',
      required: true,
    },
    actorUser: {
      type: 'ref',
      required: true,
    },
    request: {
      type: 'ref',
    },
  },

  exits: {
    endsOnMustNotBeBeforeCard: {},
    endsOnMustBeWithinOneYear: {},
    openListMustBePresent: {},
  },

  async fn(inputs) {
    const { values, scope } = inputs;
    const { timezone } = inputs.record;

    let cardRecurrence = inputs.record;
    let { card } = inputs;

    const lists = await List.qm.getByBoardId(inputs.board.id);
    const listById = _.keyBy(lists, 'id');

    const isOpen = (seriesCard) =>
      !seriesCard.isClosed &&
      !seriesCard.isDueCompleted &&
      !!listById[seriesCard.listId] &&
      !sails.helpers.lists.isArchiveOrTrash(listById[seriesCard.listId]);

    // The edited card, plus the open cards in scope
    const isInScope = (seriesCard, fromDate) =>
      seriesCard.id === card.id ||
      (isOpen(seriesCard) &&
        (scope === CardRecurrence.Scopes.ALL || seriesCard.occurrenceDate >= fromDate));

    const getSeriesCards = () =>
      Card.qm.getByRecurrenceId(cardRecurrence.id, {
        boardId: inputs.board.id,
      });

    // ---- Step 1: work out the new dates, and check the rule before changing anything ----

    const isDatesChange = !_.isUndefined(values.startDate) || !_.isUndefined(values.dueDate);

    let dayShift = 0;
    let nextTimePattern;

    if (isDatesChange) {
      const startDate = _.isUndefined(values.startDate) ? card.startDate : values.startDate;
      const dueDate = _.isUndefined(values.dueDate) ? card.dueDate : values.dueDate;

      const { occurrenceDate, ...timePattern } = getTimePattern({ startDate, dueDate }, timezone);

      // A card of the series may have lost its due date in an edit of its own
      const prevDate = card.dueDate
        ? getTimePattern(card, timezone).occurrenceDate
        : card.occurrenceDate;

      // A day change moves the series slot along with the card, even if the card had been moved
      // on its own before; a time change alone leaves every card on its day
      if (occurrenceDate !== prevDate) {
        dayShift = diffDays(card.occurrenceDate, occurrenceDate);
      }

      nextTimePattern = timePattern;
    }

    const nextCardOccurrenceDate = addDays(card.occurrenceDate, dayShift);
    const today = getToday(timezone);

    const nextEndsOn = values.endsOn || addDays(cardRecurrence.endsOn, dayShift);

    if (values.endsOn) {
      if (values.endsOn < nextCardOccurrenceDate) {
        throw 'endsOnMustNotBeBeforeCard';
      }

      if (diffDays(laterDate(today, cardRecurrence.startsOn), values.endsOn) > MAX_SPAN_DAYS) {
        throw 'endsOnMustBeWithinOneYear';
      }
    }

    const webhooks = await Webhook.qm.getAll();

    const updateCard = (seriesCard, cardValues) =>
      sails.helpers.cards.updateOne.with({
        webhooks,
        project: inputs.project,
        board: inputs.board,
        list: listById[seriesCard.listId],
        record: seriesCard,
        values: cardValues,
        actorUser: inputs.actorUser,
      });

    const seriesValues = {};

    // Every card the edit changes, created or deleted, for the activity entry
    const changedCardIds = new Set();

    // ---- Step 2: fields and dates ----

    const fieldValues = _.pick(values, ['name', 'description']);

    if (isDatesChange || !_.isEmpty(fieldValues)) {
      const fromDate = card.occurrenceDate;

      if (isDatesChange) {
        Object.assign(seriesValues, nextTimePattern);

        if (dayShift !== 0) {
          const isShifted = (date) => scope === CardRecurrence.Scopes.ALL || date >= fromDate;

          Object.assign(seriesValues, {
            weekdays: shiftWeekdays(cardRecurrence.weekdays, dayShift),
            endsOn: addDays(cardRecurrence.endsOn, dayShift),
            // Deleted days move along with the cards around them
            excludedDates: cardRecurrence.excludedDates.map((date) =>
              isShifted(date) ? addDays(date, dayShift) : date,
            ),
          });

          if (scope === CardRecurrence.Scopes.ALL) {
            seriesValues.startsOn = addDays(cardRecurrence.startsOn, dayShift);
          }
        }
      }

      const nextCardRecurrence = {
        ...cardRecurrence,
        ...seriesValues,
      };

      const seriesCards = await getSeriesCards();

      // eslint-disable-next-line no-restricted-syntax
      for (const seriesCard of seriesCards) {
        if (isInScope(seriesCard, fromDate)) {
          const cardValues = _.pickBy(fieldValues, (value, key) => seriesCard[key] !== value);

          if (isDatesChange) {
            const occurrenceDate = addDays(seriesCard.occurrenceDate, dayShift);

            // The edited card takes its dates as given, the others follow the new pattern
            const { startDate, dueDate } =
              seriesCard.id === card.id
                ? {
                    startDate: _.isUndefined(values.startDate) ? card.startDate : values.startDate,
                    dueDate: _.isUndefined(values.dueDate) ? card.dueDate : values.dueDate,
                  }
                : getOccurrenceCardDates(nextCardRecurrence, occurrenceDate);

            Object.assign(cardValues, {
              occurrenceDate,
              startDate: toISOString(startDate),
              dueDate: toISOString(dueDate),
            });
          }

          if (!_.isEmpty(cardValues)) {
            // eslint-disable-next-line no-await-in-loop
            const nextSeriesCard = await updateCard(seriesCard, cardValues);
            changedCardIds.add(seriesCard.id);

            if (nextSeriesCard && nextSeriesCard.id === card.id) {
              card = nextSeriesCard;
            }
          }
        }
      }

      cardRecurrence = nextCardRecurrence;
    }

    // ---- Step 3: members and labels ----

    if (values.userToAdd || values.userToRemove || values.labelToAdd || values.labelToRemove) {
      const seriesCards = (await getSeriesCards()).filter((seriesCard) =>
        isInScope(seriesCard, card.occurrenceDate),
      );

      const seriesCardIds = sails.helpers.utils.mapRecords(seriesCards);

      if (values.userToAdd || values.userToRemove) {
        const cardMemberships = await CardMembership.qm.getByCardIds(seriesCardIds);
        const cardMembershipByCardIdAndUserId = _.keyBy(
          cardMemberships,
          ({ cardId, userId }) => `${cardId}:${userId}`,
        );

        // eslint-disable-next-line no-restricted-syntax
        for (const seriesCard of seriesCards) {
          const list = listById[seriesCard.listId];

          // Being added to or removed from a series is one piece of news, not one per card
          const skipAction = seriesCard.id !== card.id;

          if (
            values.userToAdd &&
            !cardMembershipByCardIdAndUserId[`${seriesCard.id}:${values.userToAdd.id}`]
          ) {
            // eslint-disable-next-line no-await-in-loop
            await sails.helpers.cardMemberships.createOne
              .with({
                webhooks,
                skipAction,
                list,
                project: inputs.project,
                board: inputs.board,
                values: {
                  card: seriesCard,
                  user: values.userToAdd,
                },
                actorUser: inputs.actorUser,
              })
              .tolerate('userAlreadyCardMember');

            changedCardIds.add(seriesCard.id);
          }

          const cardMembership =
            values.userToRemove &&
            cardMembershipByCardIdAndUserId[`${seriesCard.id}:${values.userToRemove.id}`];

          if (cardMembership) {
            // eslint-disable-next-line no-await-in-loop
            await sails.helpers.cardMemberships.deleteOne.with({
              webhooks,
              skipAction,
              list,
              project: inputs.project,
              board: inputs.board,
              record: cardMembership,
              user: values.userToRemove,
              card: seriesCard,
              actorUser: inputs.actorUser,
            });

            changedCardIds.add(seriesCard.id);
          }
        }
      }

      if (values.labelToAdd || values.labelToRemove) {
        const cardLabels = await CardLabel.qm.getByCardIds(seriesCardIds);
        const cardLabelByCardIdAndLabelId = _.keyBy(
          cardLabels,
          ({ cardId, labelId }) => `${cardId}:${labelId}`,
        );

        // eslint-disable-next-line no-restricted-syntax
        for (const seriesCard of seriesCards) {
          const list = listById[seriesCard.listId];

          if (
            values.labelToAdd &&
            !cardLabelByCardIdAndLabelId[`${seriesCard.id}:${values.labelToAdd.id}`]
          ) {
            // eslint-disable-next-line no-await-in-loop
            await sails.helpers.cardLabels.createOne
              .with({
                list,
                project: inputs.project,
                board: inputs.board,
                values: {
                  card: seriesCard,
                  label: values.labelToAdd,
                },
                actorUser: inputs.actorUser,
              })
              .tolerate('labelAlreadyInCard');

            changedCardIds.add(seriesCard.id);
          }

          const cardLabel =
            values.labelToRemove &&
            cardLabelByCardIdAndLabelId[`${seriesCard.id}:${values.labelToRemove.id}`];

          if (cardLabel) {
            // eslint-disable-next-line no-await-in-loop
            await sails.helpers.cardLabels.deleteOne.with({
              list,
              project: inputs.project,
              board: inputs.board,
              record: cardLabel,
              card: seriesCard,
              actorUser: inputs.actorUser,
            });

            changedCardIds.add(seriesCard.id);
          }
        }
      }
    }

    // ---- Step 4: repeat rule and end date ----

    const nextWeekdays = values.weekdays && [...values.weekdays].sort((a, b) => a - b);
    const isWeekdaysChange = !!nextWeekdays && !_.isEqual(nextWeekdays, cardRecurrence.weekdays);
    const isEndsOnChange = !!values.endsOn && values.endsOn !== cardRecurrence.endsOn;

    if (isWeekdaysChange || isEndsOnChange) {
      const nextCardRecurrence = {
        ...cardRecurrence,
        weekdays: nextWeekdays || cardRecurrence.weekdays,
        endsOn: nextEndsOn,
      };

      // Days already past stay as they are
      const fromDate = laterDate(
        today,
        scope === CardRecurrence.Scopes.FOLLOWING ? card.occurrenceDate : cardRecurrence.startsOn,
      );

      const weekdaysSet = new Set(nextCardRecurrence.weekdays);
      const seriesCards = await getSeriesCards();

      const existingDatesSet = new Set(seriesCards.map(({ occurrenceDate }) => occurrenceDate));

      const missingDates = buildOccurrenceDates(nextCardRecurrence, {
        from: isWeekdaysChange ? fromDate : laterDate(today, addDays(cardRecurrence.endsOn, 1)),
      }).filter((date) => !existingDatesSet.has(date));

      const cardsToDelete = seriesCards.filter((seriesCard) => {
        if (seriesCard.id !== card.id && !isOpen(seriesCard)) {
          return false;
        }

        if (seriesCard.occurrenceDate > nextCardRecurrence.endsOn) {
          return true;
        }

        return (
          isWeekdaysChange &&
          seriesCard.occurrenceDate >= fromDate &&
          !weekdaysSet.has(getWeekday(seriesCard.occurrenceDate))
        );
      });

      // Rather than going away, the edited card moves to the first day the new rule adds
      const cardIndex = cardsToDelete.findIndex(({ id }) => id === card.id);

      if (cardIndex !== -1 && missingDates.length > 0) {
        const occurrenceDate = missingDates.shift();
        const { startDate, dueDate } = getOccurrenceCardDates(nextCardRecurrence, occurrenceDate);

        cardsToDelete.splice(cardIndex, 1);
        changedCardIds.add(card.id);

        card = await updateCard(card, {
          occurrenceDate,
          startDate: toISOString(startDate),
          dueDate: toISOString(dueDate),
        });
      }

      // New cards are copies of the edited card, so they're made before it may be deleted
      if (missingDates.length > 0) {
        const targetList = await sails.helpers.cardRecurrences.getTargetList(inputs.board, [
          cardRecurrence.listId,
          card.listId,
        ]);

        if (!targetList) {
          throw 'openListMustBePresent';
        }

        const createdCards = await sails.helpers.cardRecurrences.createOccurrences.with({
          webhooks,
          record: nextCardRecurrence,
          sourceCard: card,
          dates: missingDates,
          project: inputs.project,
          board: inputs.board,
          list: targetList,
          actorUser: inputs.actorUser,
        });

        createdCards.forEach(({ id }) => changedCardIds.add(id));
      }

      const deletedCards = await sails.helpers.cardRecurrences.deleteCards.with({
        listById,
        records: cardsToDelete,
        project: inputs.project,
        board: inputs.board,
        actorUser: inputs.actorUser,
      });

      deletedCards.forEach(({ id }) => changedCardIds.add(id));

      if (cardsToDelete.some(({ id }) => id === card.id)) {
        card = null;
      }

      Object.assign(seriesValues, _.pick(nextCardRecurrence, ['weekdays', 'endsOn']));
    }

    // ---- Step 5: save the series ----

    if (!_.isEmpty(seriesValues)) {
      const prevCardRecurrence = inputs.record;
      cardRecurrence = await CardRecurrence.qm.updateOne(prevCardRecurrence.id, seriesValues);

      if (cardRecurrence) {
        sails.sockets.broadcast(
          `board:${inputs.board.id}`,
          'cardRecurrenceUpdate',
          {
            item: cardRecurrence,
          },
          inputs.request,
        );

        sails.helpers.utils.sendWebhooks.with({
          webhooks,
          event: Webhook.Events.CARD_RECURRENCE_UPDATE,
          buildData: () => ({
            item: cardRecurrence,
            included: {
              projects: [inputs.project],
              boards: [inputs.board],
            },
          }),
          buildPrevData: () => ({
            item: prevCardRecurrence,
            included: {
              projects: [inputs.project],
              boards: [inputs.board],
            },
          }),
          user: inputs.actorUser,
        });
      }
    }

    // ---- Step 6: one activity entry for the edit, on the edited card ----

    // A card that left the series with the edit takes its activity with it, so there's nowhere
    // to log that case
    if (card && changedCardIds.size > 0) {
      await sails.helpers.actions.createOne.with({
        webhooks,
        values: {
          type: Action.Types.UPDATE_CARD_RECURRENCE,
          data: {
            card: _.pick(card, ['name']),
            scope,
            cardsTotal: changedCardIds.size,
          },
          user: inputs.actorUser,
          card,
        },
        project: inputs.project,
        board: inputs.board,
        list: listById[card.listId],
      });
    }

    return {
      cardRecurrence,
      card,
    };
  },
};
