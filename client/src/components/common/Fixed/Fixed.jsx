/*!
 * Copyright (c) 2026 PLANKA Software GmbH
 * Licensed under the Fair Use License: https://github.com/plankanban/planka/blob/master/LICENSE.md
 */

import React from 'react';
import { useSelector } from 'react-redux';

import selectors from '../../../selectors';
import { useIsBoardTimelineExpanded } from '../../../utils/timeline-expanded';
import Header from '../Header';
import Favorites from '../Favorites';
import HomeActions from '../HomeActions';
import Project from '../../projects/Project';
import BoardActions from '../../boards/BoardActions';

import styles from './Fixed.module.scss';

const Fixed = React.memo(() => {
  const { projectId } = useSelector(selectors.selectPath);
  const board = useSelector(selectors.selectCurrentBoard);

  // An expanded timeline moves the board tabs into the header; the board actions take their place
  const withBoards = !useIsBoardTimelineExpanded(board);

  return (
    <div className={styles.wrapper}>
      <Header />
      <Favorites />
      {projectId === undefined && <HomeActions />}
      {projectId && <Project withBoards={withBoards} />}
      {board && !board.isFetching && <BoardActions />}
    </div>
  );
});

export default Fixed;
