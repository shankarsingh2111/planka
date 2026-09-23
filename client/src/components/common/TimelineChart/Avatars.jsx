/*!
 * Copyright (c) 2024 PLANKA Software GmbH
 * Licensed under the Fair Use License: https://github.com/plankanban/planka/blob/master/LICENSE.md
 */

import React from 'react';
import PropTypes from 'prop-types';
import classNames from 'classnames';

import UserAvatar from '../../users/UserAvatar';

import styles from './Avatars.module.scss';

const MAX_VISIBLE = 3;

/**
 * Overlapping member circles for a timeline bar or an unscheduled card. UserAvatar already
 * derives the initials and a colour from the name, so this only handles stacking and overflow.
 */
const Avatars = React.memo(({ userIds, className }) => {
  if (userIds.length === 0) {
    return null;
  }

  const visibleUserIds = userIds.slice(0, MAX_VISIBLE);
  const hiddenTotal = userIds.length - visibleUserIds.length;

  return (
    <span className={classNames(styles.wrapper, className)}>
      {visibleUserIds.map((userId) => (
        <UserAvatar key={userId} id={userId} size="tiny" className={styles.avatar} />
      ))}
      {hiddenTotal > 0 && <span className={styles.overflow}>+{hiddenTotal}</span>}
    </span>
  );
});

Avatars.propTypes = {
  userIds: PropTypes.arrayOf(PropTypes.string).isRequired,
  className: PropTypes.string,
};

Avatars.defaultProps = {
  className: undefined,
};

export default Avatars;
