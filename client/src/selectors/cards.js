/*!
 * Copyright (c) 2024 PLANKA Software GmbH
 * Licensed under the Fair Use License: https://github.com/plankanban/planka/blob/master/LICENSE.md
 */

import { createSelector } from 'redux-orm';

import orm from '../orm';
import { selectRecentCardId } from './core';
import { selectPath } from './router';
import { selectCurrentUserId } from './users';
import { buildCustomFieldValueId } from '../models/CustomFieldValue';
import { isLocalId } from '../utils/local-id';
import { getHippoTicketForCardModel } from './hippo';
import { HIPPO_GROUP_NAME, TICKET_CHIP_FIELD_NAMES } from '../utils/hippo';

// The ticket chip shows these two Hippo fields, so the custom field chips leave them out
const isShownAsTicketChip = (customFieldGroupModel, customFieldModel) =>
  customFieldGroupModel.name === HIPPO_GROUP_NAME &&
  TICKET_CHIP_FIELD_NAMES.includes(customFieldModel.name);

export const makeSelectCardById = () =>
  createSelector(
    orm,
    (_, id) => id,
    ({ Card }, id) => {
      const cardModel = Card.withId(id);

      if (!cardModel) {
        return cardModel;
      }

      return {
        ...cardModel.ref,
        isPersisted: !isLocalId(id),
      };
    },
  );

export const selectCardById = makeSelectCardById();

export const makeSelectCardIndexById = () =>
  createSelector(
    orm,
    (_, id) => id,
    ({ Card }, id) => {
      const cardModel = Card.withId(id);

      if (!cardModel) {
        return cardModel;
      }

      return cardModel.list
        .getCardsModelArray()
        .findIndex((cardModelItem) => cardModelItem.id === cardModel.id);
    },
  );

export const selectCardIndexById = makeSelectCardIndexById();

export const makeSelectUserIdsByCardId = () =>
  createSelector(
    orm,
    (_, id) => id,
    ({ Card }, id) => {
      const cardModel = Card.withId(id);

      if (!cardModel) {
        return cardModel;
      }

      return cardModel.users.toRefArray().map((user) => user.id);
    },
  );

export const selectUserIdsByCardId = makeSelectUserIdsByCardId();

export const makeSelectLabelIdsByCardId = () =>
  createSelector(
    orm,
    (_, id) => id,
    ({ Card }, id) => {
      const cardModel = Card.withId(id);

      if (!cardModel) {
        return cardModel;
      }

      return cardModel.labels.toRefArray().map((label) => label.id);
    },
  );

export const selectLabelIdsByCardId = makeSelectLabelIdsByCardId();

export const makeSelectShownOnFrontOfCardTaskListIdsByCardId = () =>
  createSelector(
    orm,
    (_, id) => id,
    ({ Card }, id) => {
      const cardModel = Card.withId(id);

      if (!cardModel) {
        return cardModel;
      }

      return cardModel.getShownOnFrontOfCardTaskListsModelArray().map((taskList) => taskList.id);
    },
  );

export const selectShownOnFrontOfCardTaskListIdsByCardId =
  makeSelectShownOnFrontOfCardTaskListIdsByCardId();

export const makeSelectAttachmentsTotalByCardId = () =>
  createSelector(
    orm,
    (_, id) => id,
    ({ Card }, id) => {
      const cardModel = Card.withId(id);

      if (!cardModel) {
        return cardModel;
      }

      return cardModel.attachments.count();
    },
  );

export const selectAttachmentsTotalByCardId = makeSelectAttachmentsTotalByCardId();

export const makeSelectShownOnFrontOfCardCustomFieldValueIdsByCardId = () =>
  createSelector(
    orm,
    (_, id) => id,
    ({ Card, CustomFieldValue }, id) => {
      if (!id) {
        return id;
      }

      const cardModel = Card.withId(id);

      if (!cardModel) {
        return cardModel;
      }

      return [
        ...cardModel.board
          .getCustomFieldGroupsQuerySet()
          .toModelArray()
          .flatMap((customFieldGroupModel) =>
            customFieldGroupModel
              .getShownOnFrontOfCardCustomFieldsModelArray()
              .flatMap((customFieldModel) => {
                if (isShownAsTicketChip(customFieldGroupModel, customFieldModel)) {
                  return [];
                }

                const customFieldValue = CustomFieldValue.withId(
                  buildCustomFieldValueId({
                    cardId: id,
                    customFieldGroupId: customFieldGroupModel.id,
                    customFieldId: customFieldModel.id,
                  }),
                );

                return customFieldValue ? customFieldValue.id : [];
              }),
          ),
        ...cardModel
          .getCustomFieldGroupsQuerySet()
          .toModelArray()
          .flatMap((customFieldGroupModel) =>
            customFieldGroupModel
              .getShownOnFrontOfCardCustomFieldsModelArray()
              .flatMap((customFieldModel) => {
                if (isShownAsTicketChip(customFieldGroupModel, customFieldModel)) {
                  return [];
                }

                const customFieldValue = CustomFieldValue.withId(
                  buildCustomFieldValueId({
                    cardId: id,
                    customFieldGroupId: customFieldGroupModel.id,
                    customFieldId: customFieldModel.id,
                  }),
                );

                return customFieldValue ? customFieldValue.id : [];
              }),
          ),
      ];
    },
  );

export const selectShownOnFrontOfCardCustomFieldValueIdsByCardId =
  makeSelectShownOnFrontOfCardCustomFieldValueIdsByCardId();

export const makeSelectNotificationsByCardId = () =>
  createSelector(
    orm,
    (_, id) => id,
    ({ Card }, id) => {
      const cardModel = Card.withId(id);

      if (!cardModel) {
        return cardModel;
      }

      return cardModel.getUnreadNotificationsQuerySet().toRefArray();
    },
  );

export const selectNotificationsByCardId = makeSelectNotificationsByCardId();

export const makeSelectNotificationsTotalByCardId = () =>
  createSelector(
    orm,
    (_, id) => id,
    ({ Card }, id) => {
      const cardModel = Card.withId(id);

      if (!cardModel) {
        return cardModel;
      }

      return cardModel.getUnreadNotificationsQuerySet().count();
    },
  );

export const selectNotificationsTotalByCardId = makeSelectNotificationsTotalByCardId();

export const makeSelectIsCardWithIdRecent = () =>
  createSelector(
    orm,
    (_, id) => id,
    (state) => selectRecentCardId(state),
    ({ Card }, id, recentCardId) => {
      const cardModel = Card.withId(id);

      if (!cardModel) {
        return false;
      }

      return cardModel.id === recentCardId;
    },
  );

export const selectIsCardWithIdRecent = makeSelectIsCardWithIdRecent();

export const selectIsCardWithIdAvailableForCurrentUser = createSelector(
  orm,
  (_, id) => id,
  (state) => selectCurrentUserId(state),
  ({ Card, User }, id, currentUserId) => {
    const cardModel = Card.withId(id);

    if (!cardModel) {
      return false;
    }

    const currentUserModel = User.withId(currentUserId);
    return cardModel.isAvailableForUser(currentUserModel);
  },
);

export const selectCurrentCard = createSelector(
  orm,
  (state) => selectPath(state).cardId,
  ({ Card }, id) => {
    if (!id) {
      return id;
    }

    const cardModel = Card.withId(id);

    if (!cardModel) {
      return cardModel;
    }

    return cardModel.ref;
  },
);

export const selectUserIdsForCurrentCard = createSelector(
  orm,
  (state) => selectPath(state).cardId,
  ({ Card }, id) => {
    if (!id) {
      return id;
    }

    const cardModel = Card.withId(id);

    if (!cardModel) {
      return cardModel;
    }

    return cardModel.users.toRefArray().map((user) => user.id);
  },
);

export const selectLabelIdsForCurrentCard = createSelector(
  orm,
  (state) => selectPath(state).cardId,
  ({ Card }, id) => {
    if (!id) {
      return id;
    }

    const cardModel = Card.withId(id);

    if (!cardModel) {
      return cardModel;
    }

    return cardModel.labels.toRefArray().map((label) => label.id);
  },
);

export const selectTaskListIdsForCurrentCard = createSelector(
  orm,
  (state) => selectPath(state).cardId,
  ({ Card }, id) => {
    if (!id) {
      return id;
    }

    const cardModel = Card.withId(id);

    if (!cardModel) {
      return cardModel;
    }

    return cardModel
      .getTaskListsQuerySet()
      .toRefArray()
      .map((taskList) => taskList.id);
  },
);

export const selectAttachmentIdsForCurrentCard = createSelector(
  orm,
  (state) => selectPath(state).cardId,
  ({ Card }, id) => {
    if (!id) {
      return id;
    }

    const cardModel = Card.withId(id);

    if (!cardModel) {
      return cardModel;
    }

    return cardModel
      .getAttachmentsQuerySet()
      .toRefArray()
      .map((attachment) => attachment.id);
  },
);

export const selectImageAttachmentIdsExceptCoverForCurrentCard = createSelector(
  orm,
  (state) => selectPath(state).cardId,
  ({ Card }, id) => {
    if (!id) {
      return id;
    }

    const cardModel = Card.withId(id);

    if (!cardModel) {
      return cardModel;
    }

    return cardModel
      .getAttachmentsQuerySet()
      .toModelArray()
      .filter(
        (attachmentModel) =>
          attachmentModel.data && attachmentModel.data.image && !attachmentModel.coveredCard,
      )
      .map((attachmentModel) => attachmentModel.id);
  },
);

export const selectAttachmentsForCurrentCard = createSelector(
  orm,
  (state) => selectPath(state).cardId,
  ({ Card }, id) => {
    if (!id) {
      return id;
    }

    const cardModel = Card.withId(id);

    if (!cardModel) {
      return cardModel;
    }

    return cardModel.getAttachmentsQuerySet().toRefArray();
  },
);

export const selectCustomFieldGroupIdsForCurrentCard = createSelector(
  orm,
  (state) => selectPath(state).cardId,
  ({ Card }, id) => {
    if (!id) {
      return id;
    }

    const cardModel = Card.withId(id);

    if (!cardModel) {
      return cardModel;
    }

    return cardModel
      .getCustomFieldGroupsQuerySet()
      .toRefArray()
      .map((customFieldGroup) => customFieldGroup.id);
  },
);

export const selectCommentIdsForCurrentCard = createSelector(
  orm,
  (state) => selectPath(state).cardId,
  ({ Card }, id) => {
    if (!id) {
      return id;
    }

    const cardModel = Card.withId(id);

    if (!cardModel) {
      return cardModel;
    }

    return cardModel.getCommentsModelArray().map((commentModel) => commentModel.id);
  },
);

export const selectActivityIdsForCurrentCard = createSelector(
  orm,
  (state) => selectPath(state).cardId,
  ({ Card }, id) => {
    if (!id) {
      return id;
    }

    const cardModel = Card.withId(id);

    if (!cardModel) {
      return cardModel;
    }

    return cardModel.getActivitiesModelArray().map((activity) => activity.id);
  },
);

export const selectCommunicationItemsForCurrentCard = createSelector(
  orm,
  (state) => selectPath(state).cardId,
  ({ Card }, id) => {
    if (!id) {
      return id;
    }

    const cardModel = Card.withId(id);

    if (!cardModel) {
      return cardModel;
    }

    if (cardModel.isAllCommentsFetched === null || cardModel.isAllActivitiesFetched === null) {
      return [];
    }

    const commentModels = cardModel.getCommentsModelArray();
    const activityModels = cardModel.getActivitiesModelArray();

    // Both lists are paginated newest-first, so anything older than the oldest loaded item of a
    // partially fetched list could still be missing its neighbours from that list - hide it until
    // that list is fetched further.
    let cutoffDate = null;

    [
      [commentModels, cardModel.isAllCommentsFetched],
      [activityModels, cardModel.isAllActivitiesFetched],
    ].forEach(([models, isAllFetched]) => {
      if (!isAllFetched && models.length > 0) {
        const { createdAt } = models[models.length - 1];

        if (!cutoffDate || createdAt > cutoffDate) {
          cutoffDate = createdAt;
        }
      }
    });

    return [
      ...commentModels.map((commentModel) => ({
        type: 'comment',
        id: commentModel.id,
        createdAt: commentModel.createdAt,
      })),
      ...activityModels.map((activityModel) => ({
        type: 'activity',
        id: activityModel.id,
        createdAt: activityModel.createdAt,
      })),
    ]
      .filter((item) => !cutoffDate || item.createdAt >= cutoffDate)
      .sort((a, b) => b.createdAt - a.createdAt);
  },
);

export const selectIsCurrentUserInCurrentCard = createSelector(
  orm,
  (state) => selectPath(state).cardId,
  (state) => selectCurrentUserId(state),
  ({ Card }, id, currentUserId) => {
    if (!id) {
      return false;
    }

    const cardModel = Card.withId(id);

    if (!cardModel) {
      return false;
    }

    return cardModel.hasUserWithId(currentUserId);
  },
);

export const selectTimelineCardsByIds = createSelector(
  orm,
  (_, ids) => ids,
  ({ Card, CustomFieldValue }, ids) => {
    if (!ids) {
      return [];
    }

    return ids.flatMap((id) => {
      const cardModel = Card.withId(id);

      if (!cardModel) {
        return [];
      }

      let tasksTotal = 0;
      let tasksCompleted = 0;

      cardModel.taskLists.toModelArray().forEach((taskListModel) => {
        taskListModel.tasks.toRefArray().forEach((task) => {
          tasksTotal += 1;

          if (task.isCompleted) {
            tasksCompleted += 1;
          }
        });
      });

      const hippoTicket = getHippoTicketForCardModel(cardModel, CustomFieldValue);

      return {
        ...cardModel.ref,
        userIds: cardModel.users.toRefArray().map((user) => user.id),
        labelIds: cardModel.labels.toRefArray().map((label) => label.id),
        list: cardModel.list && cardModel.list.ref,
        tasksTotal,
        tasksCompleted,
        ticketNumber: hippoTicket ? hippoTicket.number : null,
      };
    });
  },
);

export default {
  makeSelectCardById,
  selectCardById,
  makeSelectCardIndexById,
  selectCardIndexById,
  makeSelectUserIdsByCardId,
  selectUserIdsByCardId,
  makeSelectLabelIdsByCardId,
  selectLabelIdsByCardId,
  makeSelectShownOnFrontOfCardTaskListIdsByCardId,
  selectShownOnFrontOfCardTaskListIdsByCardId,
  makeSelectAttachmentsTotalByCardId,
  makeSelectShownOnFrontOfCardCustomFieldValueIdsByCardId,
  selectShownOnFrontOfCardCustomFieldValueIdsByCardId,
  selectAttachmentsTotalByCardId,
  makeSelectNotificationsByCardId,
  selectNotificationsByCardId,
  makeSelectNotificationsTotalByCardId,
  selectNotificationsTotalByCardId,
  makeSelectIsCardWithIdRecent,
  selectIsCardWithIdRecent,
  selectIsCardWithIdAvailableForCurrentUser,
  selectCurrentCard,
  selectUserIdsForCurrentCard,
  selectLabelIdsForCurrentCard,
  selectTaskListIdsForCurrentCard,
  selectAttachmentIdsForCurrentCard,
  selectImageAttachmentIdsExceptCoverForCurrentCard,
  selectAttachmentsForCurrentCard,
  selectCustomFieldGroupIdsForCurrentCard,
  selectCommentIdsForCurrentCard,
  selectActivityIdsForCurrentCard,
  selectCommunicationItemsForCurrentCard,
  selectIsCurrentUserInCurrentCard,
  selectTimelineCardsByIds,
};
