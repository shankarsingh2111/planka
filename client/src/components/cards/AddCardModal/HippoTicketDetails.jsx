/*!
 * Copyright (c) 2024 PLANKA Software GmbH
 * Licensed under the Fair Use License: https://github.com/plankanban/planka/blob/master/LICENSE.md
 */

import React, { useCallback, useMemo } from 'react';
import PropTypes from 'prop-types';
import { useTranslation } from 'react-i18next';
import { Button, Checkbox, Dropdown, Icon } from 'semantic-ui-react';

import { getFirstLine, getUnmatchedAssigneeNames } from '../../../utils/hippo';
import TicketChip from '../../hippo/TicketChip';

import cardStyles from '../CardModal/ProjectContent.module.scss';
import styles from './HippoTicketDetails.module.scss';

// What the new card takes from the ticket beyond its title, description and dates
const HippoTicketDetails = React.memo(
  ({
    ticket,
    ticketUrl,
    ticketState,
    stateOptions,
    selectedEntryIds,
    onTicketStateChange,
    onSelectedEntryIdsChange,
  }) => {
    const [t] = useTranslation();

    const unmatchedNames = useMemo(() => getUnmatchedAssigneeNames(ticket), [ticket]);
    const isAllSelected = selectedEntryIds.length === ticket.entries.length;

    const handleStateChange = useCallback(
      (_, { value }) => {
        onTicketStateChange(value || null);
      },
      [onTicketStateChange],
    );

    const handleAllToggle = useCallback(() => {
      onSelectedEntryIdsChange(isAllSelected ? [] : ticket.entries.map((entry) => entry.id));
    }, [isAllSelected, ticket.entries, onSelectedEntryIdsChange]);

    const toggleEntry = (entryId) => {
      onSelectedEntryIdsChange(
        selectedEntryIds.includes(entryId)
          ? selectedEntryIds.filter((id) => id !== entryId)
          : [...selectedEntryIds, entryId],
      );
    };

    return (
      <div className={cardStyles.contentModule}>
        <div className={cardStyles.moduleWrapper}>
          <Icon name="ticket alternate" className={cardStyles.moduleIcon} />
          <div className={cardStyles.moduleHeader}>
            {t('common.hippoTicket', {
              context: 'title',
            })}
            <TicketChip number={ticket.number} url={ticketUrl} className={styles.ticketChip} />
          </div>
          <div className={styles.fields}>
            <div className={styles.field}>
              <div className={styles.label}>{t('common.ticketState')}</div>
              <Dropdown
                fluid
                selection
                options={stateOptions.map((option) => ({
                  key: option,
                  text: option,
                  value: option,
                }))}
                value={ticketState || ''}
                placeholder={t('common.selectOption')}
                onChange={handleStateChange}
              />
            </div>
            <div className={styles.field}>
              <div className={styles.label}>{t('common.priority')}</div>
              <div className={styles.value}>{ticket.priority || '—'}</div>
            </div>
          </div>
          {unmatchedNames.length > 0 && (
            <div className={styles.hint}>
              {t('common.notOnThisBoard', {
                names: unmatchedNames.join(', '),
              })}
            </div>
          )}
          {ticket.entries.length > 0 && (
            <div className={styles.entries}>
              <div className={styles.entriesHeader}>
                {t('common.notesAndComments', {
                  context: 'title',
                })}
                <Button
                  basic
                  type="button"
                  size="mini"
                  content={isAllSelected ? t('action.selectNone') : t('action.selectAll')}
                  onClick={handleAllToggle}
                />
              </div>
              {ticket.entries.map((entry) => (
                <div key={entry.id} className={styles.entry}>
                  <Checkbox
                    checked={selectedEntryIds.includes(entry.id)}
                    onChange={() => toggleEntry(entry.id)}
                  />
                  <div className={styles.entryContent}>
                    <span className={styles.entryBadge}>
                      {entry.kind === 'note'
                        ? t('common.hippoNoteBadge')
                        : t('common.hippoCommentBadge')}
                    </span>
                    <span>{entry.authorName}</span>
                    {entry.date && (
                      <span className={styles.entryDate}>
                        {t('format:fullDateTime', {
                          value: new Date(entry.date),
                          postProcess: 'formatDate',
                        })}
                      </span>
                    )}
                    <div className={styles.entryText}>{getFirstLine(entry.markdown)}</div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    );
  },
);

HippoTicketDetails.propTypes = {
  ticket: PropTypes.object.isRequired, // eslint-disable-line react/forbid-prop-types
  ticketUrl: PropTypes.string,
  ticketState: PropTypes.string,
  stateOptions: PropTypes.arrayOf(PropTypes.string).isRequired,
  selectedEntryIds: PropTypes.arrayOf(PropTypes.string).isRequired,
  onTicketStateChange: PropTypes.func.isRequired,
  onSelectedEntryIdsChange: PropTypes.func.isRequired,
};

HippoTicketDetails.defaultProps = {
  ticketUrl: null,
  ticketState: null,
};

export default HippoTicketDetails;
