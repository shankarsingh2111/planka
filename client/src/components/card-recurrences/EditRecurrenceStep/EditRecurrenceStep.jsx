/*!
 * Copyright (c) 2024 PLANKA Software GmbH
 * Licensed under the Fair Use License: https://github.com/plankanban/planka/blob/master/LICENSE.md
 */

import React, { useCallback, useMemo, useState } from 'react';
import PropTypes from 'prop-types';
import classNames from 'classnames';
import { useTranslation } from 'react-i18next';
import DatePicker from 'react-datepicker';
import { Button, Form, Radio } from 'semantic-ui-react';
import { Popup } from '../../../lib/custom-ui';

import {
  EVERY_DAY,
  WORKING_DAYS,
  buildOccurrenceDates,
  fromDateString,
  getMaxEndDate,
  getSeriesStartDate,
  sortWeekdays,
  toDateString,
} from '../../../utils/recurrence';
import { CardRecurrenceScopes } from '../../../constants/Enums';
import { getOrderedWeekdays, getWeekdayName } from '../weekdays';

import styles from './EditRecurrenceStep.module.scss';

/**
 * Picks the weekdays a card repeats on and the last day it does. For a card not repeating yet,
 * the series starts on the card's own day (or today, if that is past); for a card of a series,
 * the new rule applies from that card on, or to all the cards still to come.
 */
const EditRecurrenceStep = React.memo(
  ({
    startDate,
    dueDate,
    occurrenceDate,
    defaultValue,
    onUpdate,
    onRemove,
    onEnd,
    onBack,
    onClose,
  }) => {
    const [t, i18n] = useTranslation();

    const isSeries = !!occurrenceDate;

    // The first day the rule can land on, which is also as early as it can end
    const firstDate = useMemo(
      () =>
        getSeriesStartDate(
          isSeries
            ? {
                dueDate: fromDateString(occurrenceDate),
              }
            : {
                startDate,
                dueDate,
              },
        ),
      [isSeries, occurrenceDate, startDate, dueDate],
    );

    const [weekdays, setWeekdays] = useState(() =>
      defaultValue ? defaultValue.weekdays : [firstDate.getDay()],
    );

    const [endDate, setEndDate] = useState(() => {
      if (defaultValue) {
        return fromDateString(defaultValue.endsOn);
      }

      const date = new Date(firstDate);
      date.setMonth(date.getMonth() + 1);

      return date;
    });

    const [scope, setScope] = useState(CardRecurrenceScopes.FOLLOWING);

    const dates = useMemo(
      () => buildOccurrenceDates(weekdays, firstDate, endDate),
      [weekdays, firstDate, endDate],
    );

    const orderedWeekdays = useMemo(() => getOrderedWeekdays(i18n), [i18n]);

    const formatDate = useCallback(
      (date) =>
        `${getWeekdayName(i18n, date.getDay())} ${t('format:longDate', {
          value: date,
          postProcess: 'formatDate',
        })}`,
      [t, i18n],
    );

    const handleWeekdayClick = useCallback((weekday) => {
      setWeekdays((prevWeekdays) =>
        prevWeekdays.includes(weekday)
          ? prevWeekdays.filter((prevWeekday) => prevWeekday !== weekday)
          : [...prevWeekdays, weekday],
      );
    }, []);

    const handleScopeChange = useCallback((_, { value }) => {
      setScope(value);
    }, []);

    const handleSubmit = useCallback(() => {
      if (dates.length === 0) {
        return;
      }

      onUpdate(
        {
          weekdays: sortWeekdays(weekdays),
          endsOn: toDateString(endDate),
        },
        scope,
      );

      onClose();
    }, [onUpdate, onClose, dates.length, weekdays, endDate, scope]);

    const handleRemoveClick = useCallback(() => {
      onRemove();
      onClose();
    }, [onRemove, onClose]);

    const handleEndClick = useCallback(() => {
      onEnd();
      onClose();
    }, [onEnd, onClose]);

    return (
      <>
        <Popup.Header onBack={onBack}>
          {t('common.repeat', {
            context: 'title',
          })}
        </Popup.Header>
        <Popup.Content>
          {dueDate ? (
            <Form onSubmit={handleSubmit}>
              <div className={styles.text}>{t('common.repeatOn')}</div>
              <div className={styles.weekdays}>
                {orderedWeekdays.map((weekday) => (
                  <button
                    key={weekday}
                    type="button"
                    className={classNames(
                      styles.weekday,
                      weekdays.includes(weekday) && styles.weekdayActive,
                    )}
                    onClick={() => handleWeekdayClick(weekday)}
                  >
                    {getWeekdayName(i18n, weekday, 'EEEEEE')}
                  </button>
                ))}
              </div>
              <div className={styles.presets}>
                <button
                  type="button"
                  className={styles.preset}
                  onClick={() => setWeekdays(EVERY_DAY)}
                >
                  {t('common.everyDay')}
                </button>
                <button
                  type="button"
                  className={styles.preset}
                  onClick={() => setWeekdays(WORKING_DAYS)}
                >
                  {t('common.workingDays')}
                </button>
              </div>
              <div className={styles.text}>{t('common.until')}</div>
              <DatePicker
                inline
                disabledKeyboardNavigation
                selected={endDate}
                minDate={firstDate}
                maxDate={getMaxEndDate(firstDate)}
                onChange={setEndDate}
              />
              <div className={styles.preview}>
                {dates.length > 0
                  ? t('common.seriesPreview', {
                      count: dates.length,
                      from: formatDate(dates[0]),
                      to: formatDate(dates[dates.length - 1]),
                    })
                  : t('common.noDaysToRepeatOn')}
              </div>
              {isSeries && (
                <>
                  <div className={styles.text}>{t('common.applyTo')}</div>
                  <div className={styles.scopes}>
                    <Radio
                      name="scope"
                      value={CardRecurrenceScopes.FOLLOWING}
                      checked={scope === CardRecurrenceScopes.FOLLOWING}
                      label={t('common.thisAndFollowingCards')}
                      className={styles.scope}
                      onChange={handleScopeChange}
                    />
                    <Radio
                      name="scope"
                      value={CardRecurrenceScopes.ALL}
                      checked={scope === CardRecurrenceScopes.ALL}
                      label={t('common.allCards')}
                      className={styles.scope}
                      onChange={handleScopeChange}
                    />
                  </div>
                  <div className={styles.hint}>{t('common.newRepeatRuleReplacesCards')}</div>
                </>
              )}
              <Button positive disabled={dates.length === 0} content={t('action.save')} />
            </Form>
          ) : (
            <div className={styles.hint}>{t('common.dueDateIsNeededToRepeat')}</div>
          )}
          {onRemove && (
            <Button
              negative
              content={t('action.doNotRepeat')}
              className={styles.secondaryButton}
              onClick={handleRemoveClick}
            />
          )}
          {onEnd && (
            <Button
              content={t('action.endSeriesAfterThisCard')}
              className={styles.secondaryButton}
              onClick={handleEndClick}
            />
          )}
        </Popup.Content>
      </>
    );
  },
);

EditRecurrenceStep.propTypes = {
  startDate: PropTypes.instanceOf(Date),
  dueDate: PropTypes.instanceOf(Date),
  occurrenceDate: PropTypes.string,
  defaultValue: PropTypes.shape({
    weekdays: PropTypes.arrayOf(PropTypes.number).isRequired,
    endsOn: PropTypes.string.isRequired,
  }),
  onUpdate: PropTypes.func.isRequired,
  onRemove: PropTypes.func,
  onEnd: PropTypes.func,
  onBack: PropTypes.func,
  onClose: PropTypes.func.isRequired,
};

EditRecurrenceStep.defaultProps = {
  startDate: undefined,
  dueDate: undefined,
  occurrenceDate: undefined,
  defaultValue: undefined,
  onRemove: undefined,
  onEnd: undefined,
  onBack: undefined,
};

export default EditRecurrenceStep;
