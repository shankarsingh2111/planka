/*!
 * Copyright (c) 2024 PLANKA Software GmbH
 * Licensed under the Fair Use License: https://github.com/plankanban/planka/blob/master/LICENSE.md
 */

import React from 'react';
import PropTypes from 'prop-types';
import { useTranslation } from 'react-i18next';
import { Button, Icon } from 'semantic-ui-react';

import { ZoomLevels } from './utils';

import styles from './TimelineChart.module.scss';

const Toolbar = React.memo(
  ({
    zoomLevel,
    zoomLevels,
    unscheduledCount,
    withCriticalPath,
    isCriticalPathShown,
    withRepeatsCollapse,
    isRepeatsCollapsed,
    leadingChildren,
    actionChildren,
    children,
    onZoomLevelChange,
    onScrollToToday,
    onCriticalPathToggle,
    onRepeatsCollapseToggle,
  }) => {
    const [t] = useTranslation();

    return (
      <div className={styles.toolbar}>
        <div className={styles.toolbarGroup}>
          {leadingChildren}
          <Button.Group size="mini" basic>
            {zoomLevels.map((value) => (
              <Button
                key={value}
                active={zoomLevel === value}
                onClick={() => onZoomLevelChange(value)}
              >
                {t(`common.${value}`)}
              </Button>
            ))}
          </Button.Group>
          <Button size="mini" basic onClick={onScrollToToday}>
            <Icon name="crosshairs" />
            {t('common.today')}
          </Button>
          {withCriticalPath && (
            <Button size="mini" basic active={isCriticalPathShown} onClick={onCriticalPathToggle}>
              <Icon name="lightning" />
              {t('common.criticalPath')}
            </Button>
          )}
          {withRepeatsCollapse && (
            <Button
              size="mini"
              basic
              active={isRepeatsCollapsed}
              title={t('common.collapseRepeatsHint')}
              onClick={onRepeatsCollapseToggle}
            >
              <Icon name="sync alternate" />
              {t('common.collapseRepeats')}
            </Button>
          )}
          {/* Set apart from the view controls: these change the board, not how it is shown */}
          {actionChildren && <div className={styles.toolbarActions}>{actionChildren}</div>}
        </div>
        <div className={styles.toolbarGroup}>
          {unscheduledCount > 0 && (
            <span className={styles.unscheduledBadge}>
              <Icon name="calendar times outline" />
              {t('common.unscheduledCards', { count: unscheduledCount })}
            </span>
          )}
          {children}
        </div>
      </div>
    );
  },
);

Toolbar.propTypes = {
  zoomLevel: PropTypes.string.isRequired,
  zoomLevels: PropTypes.arrayOf(PropTypes.oneOf(Object.values(ZoomLevels))).isRequired,
  unscheduledCount: PropTypes.number,
  withCriticalPath: PropTypes.bool,
  isCriticalPathShown: PropTypes.bool,
  withRepeatsCollapse: PropTypes.bool,
  isRepeatsCollapsed: PropTypes.bool,
  leadingChildren: PropTypes.node,
  actionChildren: PropTypes.node,
  children: PropTypes.node,
  onZoomLevelChange: PropTypes.func.isRequired,
  onScrollToToday: PropTypes.func.isRequired,
  onCriticalPathToggle: PropTypes.func.isRequired,
  onRepeatsCollapseToggle: PropTypes.func,
};

Toolbar.defaultProps = {
  unscheduledCount: 0,
  withCriticalPath: false,
  isCriticalPathShown: false,
  withRepeatsCollapse: false,
  isRepeatsCollapsed: false,
  leadingChildren: undefined,
  actionChildren: undefined,
  children: undefined,
  onRepeatsCollapseToggle: undefined,
};

export default Toolbar;
