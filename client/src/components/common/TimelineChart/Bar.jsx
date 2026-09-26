/*!
 * Copyright (c) 2024 PLANKA Software GmbH
 * Licensed under the Fair Use License: https://github.com/plankanban/planka/blob/master/LICENSE.md
 */

import React from 'react';
import PropTypes from 'prop-types';
import classNames from 'classnames';

import { BAR_HEIGHT } from './utils';
import { DragModes } from './use-bar-drag';
import Avatars from './Avatars';

import styles from './TimelineChart.module.scss';

const MIN_WIDTH_FOR_AVATARS = 70;

const Bar = React.memo(
  ({
    item,
    laneKey,
    range,
    left,
    width,
    top,
    isEditable,
    isLinkable,
    isCritical,
    isDragging,
    onPointerDown,
    onPointerMove,
    onPointerUp,
    onPointerEnter,
    onPointerLeave,
    onKeyDown,
    onLinkPointerDown,
  }) => {
    const progress =
      item.progress && item.progress.total > 0
        ? item.progress.completed / item.progress.total
        : null;

    // Below this the bar has no room left for the name once circles are in it
    const withAvatars = width >= MIN_WIDTH_FOR_AVATARS && item.memberIds;

    return (
      <div
        data-timeline-item-id={item.id}
        role="button"
        tabIndex={0}
        className={classNames(styles.bar, item.colorClassName, {
          [styles.barOpenEnded]: range.isOpenEnded,
          [styles.barCompleted]: item.isCompleted,
          [styles.barOverdue]: item.isOverdue,
          [styles.barCritical]: isCritical,
          [styles.barDragging]: isDragging,
          [styles.barEditable]: isEditable,
        })}
        style={{ left, width, top, height: BAR_HEIGHT }}
        onPointerDown={(event) => onPointerDown(event, item.id, DragModes.MOVE, laneKey)}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerEnter={() => onPointerEnter(item.id)}
        onPointerLeave={() => onPointerLeave(null)}
        onKeyDown={(event) => onKeyDown(event, item.id)}
      >
        {progress !== null && (
          <span className={styles.barProgress} style={{ width: `${progress * 100}%` }} />
        )}
        {/* No start date yet: the bar only stands in for the due day until one is set */}
        {range.isStartMissing && <span className={styles.startMissingDot} />}
        <span className={styles.barLabel}>{item.name}</span>
        {withAvatars && <Avatars userIds={item.memberIds} className={styles.barAvatars} />}
        {isEditable && (
          <>
            <span
              className={classNames(styles.barHandle, styles.barHandleStart)}
              onPointerDown={(event) =>
                onPointerDown(event, item.id, DragModes.RESIZE_START, laneKey)
              }
              onPointerMove={onPointerMove}
              onPointerUp={onPointerUp}
            />
            <span
              className={classNames(styles.barHandle, styles.barHandleEnd)}
              onPointerDown={(event) => onPointerDown(event, item.id, DragModes.RESIZE_END, laneKey)}
              onPointerMove={onPointerMove}
              onPointerUp={onPointerUp}
            />
          </>
        )}
        {isLinkable && (
          <span
            className={styles.linkDot}
            onPointerDown={(event) => onLinkPointerDown(event, item.id)}
          />
        )}
      </div>
    );
  },
);

Bar.propTypes = {
  /* eslint-disable react/forbid-prop-types */
  item: PropTypes.object.isRequired,
  range: PropTypes.object.isRequired,
  /* eslint-enable react/forbid-prop-types */
  laneKey: PropTypes.string.isRequired,
  left: PropTypes.number.isRequired,
  width: PropTypes.number.isRequired,
  top: PropTypes.number.isRequired,
  isEditable: PropTypes.bool,
  isLinkable: PropTypes.bool,
  isCritical: PropTypes.bool,
  isDragging: PropTypes.bool,
  onPointerDown: PropTypes.func.isRequired,
  onPointerMove: PropTypes.func.isRequired,
  onPointerUp: PropTypes.func.isRequired,
  onPointerEnter: PropTypes.func.isRequired,
  onPointerLeave: PropTypes.func.isRequired,
  onKeyDown: PropTypes.func.isRequired,
  onLinkPointerDown: PropTypes.func.isRequired,
};

Bar.defaultProps = {
  isEditable: false,
  isLinkable: false,
  isCritical: false,
  isDragging: false,
};

export default Bar;
