/*!
 * Copyright (c) 2024 PLANKA Software GmbH
 * Licensed under the Fair Use License: https://github.com/plankanban/planka/blob/master/LICENSE.md
 */

import React, { useCallback } from 'react';
import classNames from 'classnames';
import { useDispatch, useSelector } from 'react-redux';
import { useTranslation } from 'react-i18next';
import { Icon } from 'semantic-ui-react';

import selectors from '../../../../selectors';
import entryActions from '../../../../entry-actions';
import { BoardContexts, BoardViews } from '../../../../constants/Enums';
import { BoardViewIcons } from '../../../../constants/Icons';

import styles from './ViewSwitcher.module.scss';

const ViewSwitcher = React.memo(() => {
  const board = useSelector(selectors.selectCurrentBoard);
  const withExtraViews = useSelector(
    (state) => selectors.selectCurrentUser(state).showExtraBoardViews,
  );

  const dispatch = useDispatch();
  const [t] = useTranslation();

  const handleSelectViewClick = useCallback(
    ({ currentTarget: { value: view } }) => {
      if (view !== board.view) {
        dispatch(entryActions.updateViewInCurrentBoard(view));
      }
    },
    [board.view, dispatch],
  );

  const views = [BoardViews.TIMELINE];
  if (board.context === BoardContexts.BOARD) {
    views.unshift(BoardViews.KANBAN);
  }

  // Extra views stay hidden unless enabled in preferences, but the current one is always
  // shown so the board never sits in a view with no button for it
  [BoardViews.GRID, BoardViews.LIST].forEach((view) => {
    if (withExtraViews || board.view === view) {
      views.splice(views.length - 1, 0, view);
    }
  });

  return (
    <div className={styles.wrapper}>
      {views.map((view) => {
        const isActive = view === board.view;

        return (
          <button
            key={view}
            type="button"
            value={view}
            aria-pressed={isActive}
            // The actions bar clips overflow, so a custom tooltip would be cut off
            title={t(`common.${view}ViewHint`)}
            className={classNames(styles.button, isActive && styles.buttonActive)}
            onClick={handleSelectViewClick}
          >
            <Icon fitted name={BoardViewIcons[view]} className={styles.icon} />
            <span className={styles.label}>{t(`common.${view}`)}</span>
          </button>
        );
      })}
    </div>
  );
});

export default ViewSwitcher;
