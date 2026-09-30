/*!
 * Copyright (c) 2024 PLANKA Software GmbH
 * Licensed under the Fair Use License: https://github.com/plankanban/planka/blob/master/LICENSE.md
 */

import React from 'react';
import PropTypes from 'prop-types';
import classNames from 'classnames';
import { useTranslation } from 'react-i18next';
import { Icon } from 'semantic-ui-react';

import { fromDateString } from '../../../utils/recurrence';
import { formatWeekdays } from '../weekdays';

import styles from './RecurrenceChip.module.scss';

const RecurrenceChip = React.memo(({ weekdays, endsOn, position, onClick }) => {
  const [t, i18n] = useTranslation();

  const contentNode = (
    <span className={classNames(styles.wrapper, onClick && styles.wrapperHoverable)}>
      <Icon name="sync alternate" className={styles.icon} />
      {t('common.repeatsUntil', {
        days: formatWeekdays(t, i18n, weekdays),
        date: t('format:longDate', {
          value: fromDateString(endsOn),
          postProcess: 'formatDate',
        }),
      })}
      {position && position.total > 1 && (
        <span className={styles.position}>
          {t('common.cardOfSeries', {
            index: position.index,
            total: position.total,
          })}
        </span>
      )}
    </span>
  );

  return onClick ? (
    <button type="button" className={styles.button} onClick={onClick}>
      {contentNode}
    </button>
  ) : (
    contentNode
  );
});

RecurrenceChip.propTypes = {
  weekdays: PropTypes.arrayOf(PropTypes.number).isRequired,
  endsOn: PropTypes.string.isRequired,
  position: PropTypes.shape({
    index: PropTypes.number.isRequired,
    total: PropTypes.number.isRequired,
  }),
  onClick: PropTypes.func,
};

RecurrenceChip.defaultProps = {
  position: undefined,
  onClick: undefined,
};

export default RecurrenceChip;
