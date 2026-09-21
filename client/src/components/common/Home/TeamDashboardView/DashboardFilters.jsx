/*!
 * Copyright (c) 2024 PLANKA Software GmbH
 * Licensed under the Fair Use License: https://github.com/plankanban/planka/blob/master/LICENSE.md
 */

import React from 'react';
import PropTypes from 'prop-types';
import { useTranslation } from 'react-i18next';
import { Button, Checkbox, Dropdown, Icon } from 'semantic-ui-react';

import { DateRanges } from './build-dashboard-model';

import styles from './TeamDashboardView.module.scss';

const DashboardFilters = React.memo(
  ({ filters, users, projects, currentUserId, isFetching, onChange, onRefresh }) => {
    const [t] = useTranslation();

    const userOptions = users.map((user) => ({
      key: user.id,
      value: user.id,
      text: user.name,
    }));

    const projectOptions = projects.map((project) => ({
      key: project.id,
      value: project.id,
      text: project.name,
    }));

    const dateRangeOptions = [
      { value: DateRanges.ALL, text: t('common.anyDate') },
      { value: DateRanges.THIS_WEEK, text: t('common.thisWeek') },
      { value: DateRanges.NEXT_TWO_WEEKS, text: t('common.nextTwoWeeks') },
      { value: DateRanges.THIS_MONTH, text: t('common.thisMonth') },
      { value: DateRanges.THIS_QUARTER, text: t('common.thisQuarter') },
    ];

    const isOnlyMe = filters.userIds.length === 1 && filters.userIds[0] === currentUserId;

    return (
      <div className={styles.filters}>
        <Dropdown
          multiple
          search
          selection
          clearable
          options={userOptions}
          value={filters.userIds}
          placeholder={t('common.allMembers')}
          className={styles.filterDropdown}
          onChange={(_, { value }) => onChange({ userIds: value })}
        />
        <Dropdown
          multiple
          search
          selection
          clearable
          options={projectOptions}
          value={filters.projectIds}
          placeholder={t('common.allProjects')}
          className={styles.filterDropdown}
          onChange={(_, { value }) => onChange({ projectIds: value })}
        />
        <Dropdown
          selection
          options={dateRangeOptions}
          value={filters.dateRange}
          className={styles.filterDateRange}
          onChange={(_, { value }) => onChange({ dateRange: value })}
        />
        <Button
          basic
          size="small"
          active={isOnlyMe}
          onClick={() => onChange({ userIds: isOnlyMe ? [] : [currentUserId] })}
        >
          <Icon name="user" />
          {t('common.onlyMe')}
        </Button>
        <Checkbox
          toggle
          checked={filters.includeDone}
          label={t('common.showCompleted')}
          className={styles.filterToggle}
          onChange={(_, { checked }) => onChange({ includeDone: checked })}
        />
        <Button
          basic
          icon
          size="small"
          loading={isFetching}
          disabled={isFetching}
          title={t('common.refresh')}
          className={styles.refreshButton}
          onClick={onRefresh}
        >
          <Icon name="refresh" />
        </Button>
      </div>
    );
  },
);

DashboardFilters.propTypes = {
  /* eslint-disable react/forbid-prop-types */
  filters: PropTypes.object.isRequired,
  users: PropTypes.array.isRequired,
  projects: PropTypes.array.isRequired,
  /* eslint-enable react/forbid-prop-types */
  currentUserId: PropTypes.string.isRequired,
  isFetching: PropTypes.bool.isRequired,
  onChange: PropTypes.func.isRequired,
  onRefresh: PropTypes.func.isRequired,
};

export default DashboardFilters;
