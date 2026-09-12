/*!
 * Copyright (c) 2024 PLANKA Software GmbH
 * Licensed under the Fair Use License: https://github.com/plankanban/planka/blob/master/LICENSE.md
 */

import upperFirst from 'lodash/upperFirst';
import React from 'react';
import PropTypes from 'prop-types';
import classNames from 'classnames';
import { useTranslation } from 'react-i18next';

import getDateFormat from '../../../utils/get-date-format';

import styles from '../DueDateChip/DueDateChip.module.scss';

const Sizes = {
  TINY: 'tiny',
  SMALL: 'small',
  MEDIUM: 'medium',
};

const LONG_DATE_FORMAT_BY_SIZE = {
  [Sizes.TINY]: 'longDate',
  [Sizes.SMALL]: 'longDate',
  [Sizes.MEDIUM]: 'longDateTime',
};

const FULL_DATE_FORMAT_BY_SIZE = {
  [Sizes.TINY]: 'fullDate',
  [Sizes.SMALL]: 'fullDate',
  [Sizes.MEDIUM]: 'fullDateTime',
};

const StartDateChip = React.memo(
  ({ value, size, isDisabled, onClick }) => {
    const [t] = useTranslation();

    const dateFormat = getDateFormat(
      value,
      LONG_DATE_FORMAT_BY_SIZE[size],
      FULL_DATE_FORMAT_BY_SIZE[size],
    );

    const contentNode = (
      <span
        className={classNames(
          styles.wrapper,
          styles[`wrapper${upperFirst(size)}`],
          onClick && styles.wrapperHoverable,
        )}
      >
        {t(`format:${dateFormat}`, {
          value,
          postProcess: 'formatDate',
        })}
      </span>
    );

    return onClick ? (
      <button type="button" disabled={isDisabled} className={styles.button} onClick={onClick}>
        {contentNode}
      </button>
    ) : (
      contentNode
    );
  },
);

StartDateChip.propTypes = {
  value: PropTypes.instanceOf(Date).isRequired,
  size: PropTypes.oneOf(Object.values(Sizes)),
  isDisabled: PropTypes.bool,
  onClick: PropTypes.func,
};

StartDateChip.defaultProps = {
  size: Sizes.MEDIUM,
  isDisabled: false,
  onClick: undefined,
};

export default StartDateChip;
