/*!
 * Copyright (c) 2024 PLANKA Software GmbH
 * Licensed under the Fair Use License: https://github.com/plankanban/planka/blob/master/LICENSE.md
 */

const { idInput } = require('../../../utils/inputs');
const { mapTicket, matchAssignees } = require('../../../utils/hippo');
const {
  SkipReasons,
  getSkipReason,
  normalizeTicketNumber,
} = require('../../../utils/hippo-card-sync');
const {
  HippoErrors,
  HIPPO_ERROR_EXITS,
  interceptHippoExits,
} = require('../../../utils/hippo-errors');

const MAX_ENTRY_IDS = 1000;

const Errors = {
  NOT_ENOUGH_RIGHTS: {
    notEnoughRights: 'Not enough rights',
  },
  CARD_NOT_FOUND: {
    cardNotFound: 'Card not found',
  },
  NOT_A_TICKET_CARD: {
    notATicketCard: 'Not a ticket card',
  },
};

// Cards this server process is syncing right now; another request for one of them is skipped
const syncingCardIds = new Set();

const buildItem = (card, ticketNumber, syncRecord, extra) => {
  const isSameTicket = !!syncRecord && syncRecord.ticketNumber === ticketNumber;

  return {
    cardId: card.id,
    ticketNumber,
    hasSynced: isSameTicket,
    syncedAt: isSameTicket ? syncRecord.syncedAt : null,
    isSkipped: false,
    warnings: [],
    ...extra,
  };
};

module.exports = {
  inputs: {
    cardId: {
      ...idInput,
      required: true,
    },
    force: {
      type: 'boolean',
      defaultsTo: false,
    },
    entryIds: {
      type: ['string'],
      custom: (value) => value.length <= MAX_ENTRY_IDS,
    },
    ticketState: {
      type: 'string',
      isNotEmptyString: true,
      maxLength: 128,
    },
  },

  exits: {
    notEnoughRights: {
      responseType: 'forbidden',
    },
    cardNotFound: {
      responseType: 'notFound',
    },
    notATicketCard: {
      responseType: 'unprocessableEntity',
    },
    ...HIPPO_ERROR_EXITS,
  },

  async fn(inputs) {
    const { currentUser } = this.req;

    // ---- Step 1: Check the user may edit the card ----
    const { card, list, board, project } = await sails.helpers.cards
      .getPathToProjectById(inputs.cardId)
      .intercept('pathNotFound', () => Errors.CARD_NOT_FOUND);

    const boardMembership = await BoardMembership.qm.getOneByBoardIdAndUserId(
      board.id,
      currentUser.id,
    );

    if (!boardMembership) {
      throw Errors.CARD_NOT_FOUND; // Forbidden
    }

    if (boardMembership.role !== BoardMembership.Roles.EDITOR) {
      throw Errors.NOT_ENOUGH_RIGHTS;
    }

    // ---- Step 2: Find the card's ticket ----
    const ticketValuesByCardId = await sails.helpers.hippo.getTicketValuesByCards([card]);
    const ticketValues = ticketValuesByCardId[card.id];
    const ticketNumber = ticketValues && normalizeTicketNumber(ticketValues.ticketNumber);

    if (!ticketNumber) {
      throw Errors.NOT_A_TICKET_CARD;
    }

    // ---- Step 3: Skip a refresh that is not due, or a card already syncing ----
    const syncRecord = await HippoCardSync.qm.getOneByCardId(card.id);

    if (syncingCardIds.has(card.id)) {
      return {
        item: buildItem(card, ticketNumber, syncRecord, {
          isSkipped: true,
          skipReason: SkipReasons.IN_PROGRESS,
        }),
      };
    }

    const skipReason = getSkipReason({
      syncRecord,
      ticketNumber,
      force: inputs.force,
      now: Date.now(),
    });

    if (skipReason) {
      return {
        item: buildItem(card, ticketNumber, syncRecord, {
          isSkipped: true,
          skipReason,
        }),
      };
    }

    syncingCardIds.add(card.id);

    try {
      // ---- Step 4: Fetch the ticket from Hippo ----
      const appSecretKey = await sails.helpers.hippo
        .getAppSecretKey(project.id)
        .intercept('hippoNotConfigured', () => HippoErrors.HIPPO_NOT_CONFIGURED);

      const data = await interceptHippoExits(
        sails.helpers.hippo.fetchTicket.with({
          appSecretKey,
          ticketNumber,
        }),
      );

      if (!data) {
        throw HippoErrors.HIPPO_TICKET_NOT_FOUND;
      }

      // ---- Step 5: Match assignees to board members ----
      const ticket = {
        ...mapTicket(data, ticketNumber),
        // The number the card holds, so records and blocks stay tied to it
        number: ticketNumber,
      };

      const boardMemberships = await BoardMembership.qm.getByBoardId(board.id);

      const users = await User.qm.getByIds(
        sails.helpers.utils.mapRecords(boardMemberships, 'userId'),
        {
          withDeactivated: false,
        },
      );

      // ---- Step 6: Write the ticket into the card ----
      const { warnings } = await sails.helpers.hippo.applyTicketToCard.with({
        card,
        list,
        board,
        project,
        ticket: {
          ...ticket,
          assignees: matchAssignees(ticket.assignees, users),
        },
        customFieldGroupId: ticketValues.customFieldGroupId,
        users,
        ticketState: inputs.ticketState,
        entryIds: inputs.entryIds,
        actorUser: currentUser,
        request: this.req,
      });

      // ---- Step 7: Record the sync ----
      const nextSyncRecord = await HippoCardSync.qm.createOrUpdateOne(card.id, {
        ticketNumber,
        syncedAt: new Date().toISOString(),
      });

      return {
        item: buildItem(card, ticketNumber, nextSyncRecord, {
          warnings,
        }),
      };
    } finally {
      syncingCardIds.delete(card.id);
    }
  },
};
