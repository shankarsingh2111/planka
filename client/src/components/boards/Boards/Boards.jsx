/*!
 * Copyright (c) 2024 PLANKA Software GmbH
 * Licensed under the Fair Use License: https://github.com/plankanban/planka/blob/master/LICENSE.md
 */

import React, { useCallback, useRef } from 'react';
import PropTypes from 'prop-types';
import classNames from 'classnames';
import { useDispatch, useSelector } from 'react-redux';
import { DragDropContext, Droppable } from 'react-beautiful-dnd';
import { Button } from 'semantic-ui-react';
import { closePopup, usePopup } from '../../../lib/popup';

import selectors from '../../../selectors';
import entryActions from '../../../entry-actions';
import DroppableTypes from '../../../constants/DroppableTypes';
import Item from './Item';
import AddBoardStep from '../AddBoardStep';

import styles from './Boards.module.scss';
import globalStyles from '../../../styles.module.scss';

const Boards = React.memo(({ isCompact }) => {
  const boardIds = useSelector(selectors.selectBoardIdsForCurrentProject);

  const canAdd = useSelector((state) => {
    const isEditModeEnabled = selectors.selectIsEditModeEnabled(state); // TODO: move out?

    if (!isEditModeEnabled) {
      return isEditModeEnabled;
    }

    return selectors.selectIsCurrentUserManagerForCurrentProject(state);
  });

  const dispatch = useDispatch();

  const tabsWrapperRef = useRef(null);

  const handleDragStart = useCallback(() => {
    document.body.classList.add(globalStyles.dragging);
    closePopup();
  }, []);

  const handleDragEnd = useCallback(
    ({ draggableId, source, destination }) => {
      document.body.classList.remove(globalStyles.dragging);

      if (!destination || source.index === destination.index) {
        return;
      }

      dispatch(entryActions.moveBoard(draggableId, destination.index));
    },
    [dispatch],
  );

  const handleWheel = useCallback(({ deltaY }) => {
    tabsWrapperRef.current.scrollBy({
      left: deltaY,
    });
  }, []);

  const AddBoardPopup = usePopup(AddBoardStep);

  return (
    <div
      className={classNames(styles.wrapper, isCompact && styles.wrapperCompact)}
      onWheel={handleWheel}
    >
      <div
        ref={tabsWrapperRef}
        className={classNames(styles.tabsWrapper, isCompact && styles.tabsWrapperCompact)}
      >
        <DragDropContext onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
          <Droppable droppableId="boards" type={DroppableTypes.BOARD} direction="horizontal">
            {({ innerRef, droppableProps, placeholder }) => (
              <div
                {...droppableProps} // eslint-disable-line react/jsx-props-no-spreading
                ref={innerRef}
                className={classNames(styles.tabs, isCompact && styles.tabsCompact)}
              >
                {boardIds.map((boardId, index) => (
                  <Item key={boardId} id={boardId} index={index} isCompact={isCompact} />
                ))}
                {placeholder}
                {canAdd && (
                  <AddBoardPopup>
                    <Button
                      icon="plus"
                      className={classNames(styles.addButton, isCompact && styles.addButtonCompact)}
                    />
                  </AddBoardPopup>
                )}
              </div>
            )}
          </Droppable>
        </DragDropContext>
      </div>
    </div>
  );
});

// Compact is the strip an expanded timeline puts in the header: the same tabs, sized like the view
// switcher so they fit beside the project name
Boards.propTypes = {
  isCompact: PropTypes.bool,
};

Boards.defaultProps = {
  isCompact: false,
};

export default Boards;
