/*!
 * Copyright (c) 2024 PLANKA Software GmbH
 * Licensed under the Fair Use License: https://github.com/plankanban/planka/blob/master/LICENSE.md
 */

import React, { useMemo } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useInView } from 'react-intersection-observer';
import { Comment, Loader } from 'semantic-ui-react';

import selectors from '../../../selectors';
import entryActions from '../../../entry-actions';
import { isListArchiveOrTrash } from '../../../utils/record-helpers';
import { BoardMembershipRoles } from '../../../constants/Enums';
import CommentItem from '../../comments/Comments/Item';
import AddComment from '../../comments/Comments/Add';
import ActivityItem from '../../activities/CardActivities/Item';

import styles from './CommentsAndActivities.module.scss';

const CommentsAndActivities = React.memo(() => {
  const selectListById = useMemo(() => selectors.makeSelectListById(), []);

  const items = useSelector(selectors.selectCommunicationItemsForCurrentCard);

  const { isCommentsFetching, isAllCommentsFetched, isActivitiesFetching, isAllActivitiesFetched } =
    useSelector(selectors.selectCurrentCard);

  const canAdd = useSelector((state) => {
    const { listId } = selectors.selectCurrentCard(state);
    const list = selectListById(state, listId);

    if (isListArchiveOrTrash(list)) {
      return false;
    }

    const boardMembership = selectors.selectCurrentUserMembershipForCurrentBoard(state);

    let isMember = false;
    let isEditor = false;

    if (boardMembership) {
      isMember = true;
      isEditor = boardMembership.role === BoardMembershipRoles.EDITOR;
    }

    return isEditor || (isMember && boardMembership.canComment);
  });

  const dispatch = useDispatch();

  const [inViewRef] = useInView({
    threshold: 1,
    onChange: (inView) => {
      if (!inView) {
        return;
      }

      if (!isAllCommentsFetched && !isCommentsFetching) {
        dispatch(entryActions.fetchCommentsInCurrentCard());
      }

      if (!isAllActivitiesFetched && !isActivitiesFetching) {
        dispatch(entryActions.fetchActivitiesInCurrentCard());
      }
    },
  });

  const isFetching = isCommentsFetching || isActivitiesFetching;
  const isAllFetched = isAllCommentsFetched && isAllActivitiesFetched;

  return (
    <>
      {canAdd && <AddComment />}
      <div className={styles.itemsWrapper}>
        <Comment.Group className={styles.items}>
          {items.map((item) =>
            item.type === 'comment' ? (
              <CommentItem key={`comment:${item.id}`} id={item.id} />
            ) : (
              <ActivityItem key={`activity:${item.id}`} id={item.id} />
            ),
          )}
        </Comment.Group>
      </div>
      <div className={styles.loaderWrapper}>
        {isFetching ? (
          <Loader active inverted inline="centered" size="small" />
        ) : (
          !isAllFetched && <div ref={inViewRef} />
        )}
      </div>
    </>
  );
});

export default CommentsAndActivities;
