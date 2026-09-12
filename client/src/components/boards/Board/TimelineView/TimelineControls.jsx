/*!
 * Copyright (c) 2024 PLANKA Software GmbH
 * Licensed under the Fair Use License: https://github.com/plankanban/planka/blob/master/LICENSE.md
 */

import React from 'react';
import PropTypes from 'prop-types';
import { useTranslation } from 'react-i18next';
import { Button, Icon, Dropdown } from 'semantic-ui-react';

import { ZoomLevels, GroupByOptions } from './constants';

import styles from './TimelineView.module.scss';

const TimelineControls = React.memo(
  ({ zoomLevel, groupBy, unscheduledCount, onZoomChange, onGroupByChange, onTodayClick }) => {
    const [t] = useTranslation();

    const zoomOptions = [
      { key: ZoomLevels.DAY, value: ZoomLevels.DAY, text: t('common.day') },
      { key: ZoomLevels.WEEK, value: ZoomLevels.WEEK, text: t('common.week') },
      { key: ZoomLevels.MONTH, value: ZoomLevels.MONTH, text: t('common.month') },
    ];

    const groupByOptions = [
      { key: GroupByOptions.LIST, value: GroupByOptions.LIST, text: t('common.list') },
      { key: GroupByOptions.USER, value: GroupByOptions.USER, text: t('common.members') },
      { key: GroupByOptions.LABEL, value: GroupByOptions.LABEL, text: t('common.labels') },
    ];

    return (
      <div className={styles.controls}>
        <div className={styles.controlsLeft}>
          <Button.Group size="mini" basic>
            {zoomOptions.map((opt) => (
              <Button
                key={opt.key}
                active={zoomLevel === opt.value}
                onClick={() => onZoomChange(opt.value)}
              >
                {opt.text}
              </Button>
            ))}
          </Button.Group>
          <Button size="mini" basic onClick={onTodayClick} className={styles.todayButton}>
            <Icon name="crosshairs" />
            {t('common.today')}
          </Button>
        </div>
        <div className={styles.controlsRight}>
          {unscheduledCount > 0 && (
            <span className={styles.unscheduledBadge}>
              <Icon name="calendar times outline" />
              {t('common.unscheduledCards', { count: unscheduledCount })}
            </span>
          )}
          <Dropdown
            inline
            options={groupByOptions}
            value={groupBy}
            onChange={(e, { value }) => onGroupByChange(value)}
            className={styles.groupByDropdown}
          />
        </div>
      </div>
    );
  },
);

TimelineControls.propTypes = {
  zoomLevel: PropTypes.string.isRequired,
  groupBy: PropTypes.string.isRequired,
  unscheduledCount: PropTypes.number.isRequired,
  onZoomChange: PropTypes.func.isRequired,
  onGroupByChange: PropTypes.func.isRequired,
  onTodayClick: PropTypes.func.isRequired,
};

export default TimelineControls;
