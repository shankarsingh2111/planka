/*!
 * Copyright (c) 2024 PLANKA Software GmbH
 * Licensed under the Fair Use License: https://github.com/plankanban/planka/blob/master/LICENSE.md
 */

import React, { useCallback } from 'react';
import PropTypes from 'prop-types';
import classNames from 'classnames';

import { getTicketUrl } from '../../../utils/hippo';

import styles from './TicketChip.module.scss';

// "#43886", linking to the ticket: its own link when that is a web link, otherwise Hippo's page
// for the number. Following the link must not also open the card the chip sits on.
const TicketChip = React.memo(({ number, url, className }) => {
  const safeUrl = getTicketUrl(url, number);

  const handleLinkClick = useCallback((event) => {
    event.stopPropagation();
  }, []);

  if (safeUrl) {
    return (
      <a
        href={safeUrl}
        target="_blank"
        rel="noopener noreferrer"
        className={classNames(styles.wrapper, styles.wrapperLink, className)}
        onClick={handleLinkClick}
      >
        #{number}
      </a>
    );
  }

  return <span className={classNames(styles.wrapper, className)}>#{number}</span>;
});

TicketChip.propTypes = {
  number: PropTypes.string.isRequired,
  url: PropTypes.string,
  className: PropTypes.string,
};

TicketChip.defaultProps = {
  url: undefined,
  className: undefined,
};

export default TicketChip;
