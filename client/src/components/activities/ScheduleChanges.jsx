/*!
 * Copyright (c) 2024 PLANKA Software GmbH
 * Licensed under the Fair Use License: https://github.com/plankanban/planka/blob/master/LICENSE.md
 */

import React from 'react';
import PropTypes from 'prop-types';
import { useTranslation } from 'react-i18next';

const LABEL_KEY_BY_DATE_KEY = {
  startDate: 'common.startDateTime',
  dueDate: 'common.endDateTime',
};

// One line per date an updateCardSchedule action changed: "<label>: <from> → <to>"
const ScheduleChanges = React.memo(({ data }) => {
  const [t] = useTranslation();

  const formatDate = (value) =>
    value
      ? t('format:fullDateTime', {
          value: new Date(value),
          postProcess: 'formatDate',
        })
      : t('common.notSet');

  return Object.keys(LABEL_KEY_BY_DATE_KEY)
    .filter((key) => data[key])
    .map((key) => (
      <div key={key}>
        {t(LABEL_KEY_BY_DATE_KEY[key])}: {formatDate(data[key].from)} →{' '}
        {formatDate(data[key].to)}
      </div>
    ));
});

ScheduleChanges.propTypes = {
  data: PropTypes.object.isRequired, // eslint-disable-line react/forbid-prop-types
};

export default ScheduleChanges;
