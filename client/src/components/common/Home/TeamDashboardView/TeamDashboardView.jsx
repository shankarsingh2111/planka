/*!
 * Copyright (c) 2024 PLANKA Software GmbH
 * Licensed under the Fair Use License: https://github.com/plankanban/planka/blob/master/LICENSE.md
 */

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import classNames from 'classnames';
import { useSelector } from 'react-redux';
import { useNavigate } from 'react-router';
import { useTranslation } from 'react-i18next';
import { Loader, Message } from 'semantic-ui-react';

import selectors from '../../../../selectors';
import Paths from '../../../../constants/Paths';
import useDashboardData from './use-dashboard-data';
import { DateRanges, buildDashboardModel, filterEntries } from './build-dashboard-model';
import DashboardFilters from './DashboardFilters';
import SummaryCards from './SummaryCards';
import StatusBoard from './StatusBoard';
import TeamTimeline from './TeamTimeline';
import WorkloadHeatmap from './WorkloadHeatmap';

import styles from './TeamDashboardView.module.scss';

const Tabs = {
  STATUS: 'status',
  TIMELINE: 'timeline',
  WORKLOAD: 'workload',
};

const FILTERS_STORAGE_KEY = 'teamDashboardFilters';

const DEFAULT_FILTERS = {
  userIds: [],
  projectIds: [],
  dateRange: DateRanges.ALL,
  includeDone: true,
};

// Per-viewer convenience only; the dashboard works the same when storage is unavailable
const loadStoredState = () => {
  try {
    const value = JSON.parse(window.localStorage.getItem(FILTERS_STORAGE_KEY));

    return value
      ? {
          tab: Object.values(Tabs).includes(value.tab) ? value.tab : Tabs.STATUS,
          filters: { ...DEFAULT_FILTERS, ...value.filters },
        }
      : null;
  } catch {
    return null;
  }
};

const storeState = (state) => {
  try {
    window.localStorage.setItem(FILTERS_STORAGE_KEY, JSON.stringify(state));
  } catch {
    /* empty */
  }
};

const TeamDashboardView = React.memo(() => {
  const currentUserId = useSelector(selectors.selectCurrentUserId);

  const navigate = useNavigate();
  const [t] = useTranslation();

  const [storedState] = useState(loadStoredState);
  const [activeTab, setActiveTab] = useState(storedState ? storedState.tab : Tabs.STATUS);
  const [filters, setFilters] = useState(storedState ? storedState.filters : DEFAULT_FILTERS);
  const [activeSummaryKey, setActiveSummaryKey] = useState(null);

  const {
    data,
    isFetching,
    error,
    refetch,
    dismissError,
    updateCardDates,
    createCardDependency,
    deleteCardDependency,
  } = useDashboardData();

  useEffect(() => {
    storeState({ tab: activeTab, filters });
  }, [activeTab, filters]);

  const model = useMemo(
    () => (data ? buildDashboardModel(data, currentUserId) : null),
    [data, currentUserId],
  );

  const filteredEntries = useMemo(
    () => (model ? filterEntries(model.entries, filters) : []),
    [model, filters],
  );

  const summaryCounts = useMemo(
    () =>
      filteredEntries.reduce((result, entry) => {
        entry.summaryKeys.forEach((key) => {
          result[key] = (result[key] || 0) + 1; // eslint-disable-line no-param-reassign
        });

        return result;
      }, {}),
    [filteredEntries],
  );

  const visibleEntries = useMemo(
    () =>
      activeSummaryKey
        ? filteredEntries.filter((entry) => entry.summaryKeys.has(activeSummaryKey))
        : filteredEntries,
    [filteredEntries, activeSummaryKey],
  );

  const sortedUsers = useMemo(
    () => (model ? model.users.slice().sort((a, b) => a.name.localeCompare(b.name)) : []),
    [model],
  );

  const sortedProjects = useMemo(
    () => (model ? model.projects.slice().sort((a, b) => a.name.localeCompare(b.name)) : []),
    [model],
  );

  const handleFiltersChange = useCallback((patch) => {
    setFilters((prevFilters) => ({
      ...prevFilters,
      ...patch,
    }));
  }, []);

  const handleCardClick = useCallback(
    (cardId) => {
      navigate(Paths.CARDS.replace(':id', cardId));
    },
    [navigate],
  );

  const tabs = [
    { key: Tabs.STATUS, label: t('common.statusBoard') },
    { key: Tabs.TIMELINE, label: t('common.teamTimeline') },
    { key: Tabs.WORKLOAD, label: t('common.workload') },
  ];

  return (
    <div className={styles.wrapper}>
      <div className={styles.header}>
        <h2 className={styles.title}>{t('common.teamDashboard')}</h2>
        {model && (
          <DashboardFilters
            filters={filters}
            users={sortedUsers}
            projects={sortedProjects}
            currentUserId={currentUserId}
            isFetching={isFetching}
            onChange={handleFiltersChange}
            onRefresh={refetch}
          />
        )}
      </div>
      {error && (
        <Message negative size="small" onDismiss={dismissError}>
          {error.message || t('common.somethingWentWrong')}
        </Message>
      )}
      {!model ? (
        isFetching && <Loader active inverted inline="centered" />
      ) : (
        <>
          <SummaryCards
            counts={summaryCounts}
            activeKey={activeSummaryKey}
            onSelect={setActiveSummaryKey}
          />
          <div className={styles.tabBar} role="tablist">
            {tabs.map((tab) => (
              <button
                key={tab.key}
                type="button"
                role="tab"
                aria-selected={activeTab === tab.key}
                className={classNames(styles.tab, {
                  [styles.tabActive]: activeTab === tab.key,
                })}
                onClick={() => setActiveTab(tab.key)}
              >
                {tab.label}
              </button>
            ))}
          </div>
          <div className={styles.tabContent}>
            {activeTab === Tabs.STATUS && (
              <StatusBoard
                entries={visibleEntries}
                userById={model.userById}
                onCardClick={handleCardClick}
              />
            )}
            {activeTab === Tabs.TIMELINE && (
              <TeamTimeline
                entries={visibleEntries}
                cardDependencies={model.cardDependencies}
                userById={model.userById}
                onCardClick={handleCardClick}
                onCardDatesChange={updateCardDates}
                onDependencyCreate={createCardDependency}
                onDependencyDelete={deleteCardDependency}
              />
            )}
            {activeTab === Tabs.WORKLOAD && (
              <WorkloadHeatmap entries={visibleEntries} userById={model.userById} />
            )}
          </div>
        </>
      )}
    </div>
  );
});

export default TeamDashboardView;
