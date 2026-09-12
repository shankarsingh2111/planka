/*!
 * Copyright (c) 2024 PLANKA Software GmbH
 * Licensed under the Fair Use License: https://github.com/plankanban/planka/blob/master/LICENSE.md
 */

import React, { useState, useMemo } from 'react';
import { useSelector } from 'react-redux';
import { useTranslation } from 'react-i18next';

import selectors from '../../../../selectors';
import SummaryCards from './SummaryCards';
import StatusBoard from './StatusBoard';
import WorkloadHeatmap from './WorkloadHeatmap';

import styles from './TeamDashboardView.module.scss';

const Tabs = {
  STATUS: 'status',
  WORKLOAD: 'workload',
};

const TeamDashboardView = React.memo(() => {
  const [t] = useTranslation();
  const [activeTab, setActiveTab] = useState(Tabs.STATUS);

  // Get all projects/boards the user has access to
  const projectIds = useSelector(selectors.selectProjectIdsForCurrentUser);

  // Collect all cards across all boards using proper redux-orm selector
  const allCards = useSelector(selectors.selectAllCardsForCurrentUser);

  // Compute status categories
  const { doneCards, activeCards, upcomingCards, overdueCards, dueThisWeekCards } = useMemo(() => {
    const now = new Date();
    const weekFromNow = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

    const done = [];
    const active = [];
    const upcoming = [];
    const overdue = [];
    const dueThisWeek = [];

    allCards.forEach((card) => {
      if (card.isClosed) {
        done.push(card);
        return;
      }

      const dueDate = card.dueDate ? new Date(card.dueDate) : null;
      const startDate = card.startDate ? new Date(card.startDate) : null;

      // Overdue check
      if (dueDate && dueDate < now && !card.isDueCompleted) {
        overdue.push(card);
        active.push(card); // Overdue cards are still "active"
        return;
      }

      // Due this week
      if (dueDate && dueDate >= now && dueDate <= weekFromNow) {
        dueThisWeek.push(card);
      }

      // Active: has startDate <= now, or has been worked on recently
      if (startDate && startDate <= now) {
        active.push(card);
      } else if (!startDate && dueDate && dueDate > now && dueDate <= weekFromNow) {
        active.push(card);
      } else if (dueDate && dueDate > weekFromNow) {
        upcoming.push(card);
      } else if (startDate && startDate > now) {
        upcoming.push(card);
      } else if (!startDate && !dueDate) {
        // No dates — consider active (backlog)
        active.push(card);
      } else {
        active.push(card);
      }
    });

    return {
      doneCards: done,
      activeCards: active,
      upcomingCards: upcoming,
      overdueCards: overdue,
      dueThisWeekCards: dueThisWeek,
    };
  }, [allCards]);

  return (
    <div className={styles.wrapper}>
      <div className={styles.header}>
        <h2 className={styles.title}>
          {t('common.teamDashboard')}
        </h2>
      </div>

      <SummaryCards
        overdueCount={overdueCards.length}
        dueThisWeekCount={dueThisWeekCards.length}
        activeCount={activeCards.length}
        doneCount={doneCards.length}
        totalCount={allCards.length}
      />

      <div className={styles.tabBar}>
        <button
          type="button"
          className={`${styles.tab} ${activeTab === Tabs.STATUS ? styles.tabActive : ''}`}
          onClick={() => setActiveTab(Tabs.STATUS)}
        >
          <span>{t('common.statusBoard')}</span>
        </button>
        <button
          type="button"
          className={`${styles.tab} ${activeTab === Tabs.WORKLOAD ? styles.tabActive : ''}`}
          onClick={() => setActiveTab(Tabs.WORKLOAD)}
        >
          <span>{t('common.workload')}</span>
        </button>
      </div>

      <div className={styles.tabContent}>
        {activeTab === Tabs.STATUS && (
          <StatusBoard
            doneCards={doneCards}
            activeCards={activeCards}
            upcomingCards={upcomingCards}
          />
        )}
        {activeTab === Tabs.WORKLOAD && (
          <WorkloadHeatmap cards={allCards} />
        )}
      </div>
    </div>
  );
});

export default TeamDashboardView;
