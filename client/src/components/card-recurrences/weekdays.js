/*!
 * Copyright (c) 2024 PLANKA Software GmbH
 * Licensed under the Fair Use License: https://github.com/plankanban/planka/blob/master/LICENSE.md
 */

import { EVERY_DAY, WORKING_DAYS, isSameWeekdays, sortWeekdays } from '../../utils/recurrence';

// 4 January 2026 is a Sunday, so the date of each weekday of that week names it
const getWeekdayDate = (weekday) => new Date(2026, 0, 4 + weekday);

export const getWeekStartsOn = (i18n) => {
  const locale = i18n.dateFns.getLocale();
  return (locale && locale.options && locale.options.weekStartsOn) || 0;
};

export const getWeekdayName = (i18n, weekday, format = 'EEE') =>
  i18n.dateFns.format(getWeekdayDate(weekday), format);

export const getOrderedWeekdays = (i18n) => sortWeekdays(EVERY_DAY, getWeekStartsOn(i18n));

export const formatWeekdays = (t, i18n, weekdays) => {
  if (isSameWeekdays(weekdays, EVERY_DAY)) {
    return t('common.everyDay');
  }

  if (isSameWeekdays(weekdays, WORKING_DAYS)) {
    return t('common.workingDays');
  }

  return sortWeekdays(weekdays, getWeekStartsOn(i18n))
    .map((weekday) => getWeekdayName(i18n, weekday))
    .join(', ');
};
