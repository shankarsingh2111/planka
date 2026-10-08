/*!
 * Copyright (c) 2024 PLANKA Software GmbH
 * Licensed under the Fair Use License: https://github.com/plankanban/planka/blob/master/LICENSE.md
 */

import React from 'react';
import PropTypes from 'prop-types';
import classNames from 'classnames';
import { Icon } from 'semantic-ui-react';

import { hasAvatars } from './utils';
import { DragModes } from './use-bar-drag';
import Avatars from './Avatars';

import styles from './TimelineChart.module.scss';

const Bar = React.memo(
  ({
    item,
    laneKey,
    range,
    left,
    width,
    top,
    height,
    isEditable,
    isLinkable,
    isCritical,
    isDragging,
    isCompact,
    isDimmed,
    isSeriesHighlighted,
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

    // Members sit on their own line under the name, so the two never compete for width. A
    // compact bar is only a mark on its series' strip, with the details left to the tooltip.
    const withAvatars = !isCompact && hasAvatars(item);
    const withHandles = !isCompact && isEditable;

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
          [styles.barWithAvatars]: withAvatars,
          [styles.barCompact]: isCompact,
          [styles.barDimmed]: isDimmed,
          [styles.barSeriesHighlighted]: isSeriesHighlighted,
        })}
        style={{ left, width, top, height }}
        onPointerDown={(event) => onPointerDown(event, item.id, DragModes.MOVE, laneKey)}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerEnter={() => onPointerEnter(item.id)}
        onPointerLeave={() => onPointerLeave(null)}
        onKeyDown={(event) => onKeyDown(event, item.id)}
      >
        {!isCompact && progress !== null && (
          <span className={styles.barProgress} style={{ width: `${progress * 100}%` }} />
        )}
        {/* No start date yet: the bar only stands in for the due day until one is set */}
        {!isCompact && range.isStartMissing && <span className={styles.startMissingDot} />}
        {!isCompact && (
          <span className={styles.barLabel}>
            {item.seriesId && <Icon name="sync alternate" className={styles.barRecurringIcon} />}
            {item.ticketNumber && <span className={styles.barTicket}>#{item.ticketNumber}</span>}
            {item.name}
          </span>
        )}
        {withAvatars && <Avatars userIds={item.memberIds} className={styles.barAvatars} />}
        {withHandles && (
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
        {!isCompact && isLinkable && (
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
  height: PropTypes.number.isRequired,
  isEditable: PropTypes.bool,
  isLinkable: PropTypes.bool,
  isCritical: PropTypes.bool,
  isDragging: PropTypes.bool,
  isCompact: PropTypes.bool,
  isDimmed: PropTypes.bool,
  isSeriesHighlighted: PropTypes.bool,
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
  isCompact: false,
  isDimmed: false,
  isSeriesHighlighted: false,
};

export default Bar;
