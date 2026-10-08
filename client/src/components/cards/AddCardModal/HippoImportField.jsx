/*!
 * Copyright (c) 2024 PLANKA Software GmbH
 * Licensed under the Fair Use License: https://github.com/plankanban/planka/blob/master/LICENSE.md
 */

import React, { useCallback, useEffect, useState } from 'react';
import PropTypes from 'prop-types';
import classNames from 'classnames';
import { useTranslation } from 'react-i18next';
import { Button, Form, Icon } from 'semantic-ui-react';
import { Input } from '../../../lib/custom-ui';

import { useNestedRef } from '../../../hooks';
import {
  buildTicketUrl,
  getHippoErrorText,
  isTicketUrl,
  parseTicketNumber,
  toTicketUrlPattern,
} from '../../../utils/hippo';
import { readTicketUrlPattern, writeTicketUrlPattern } from './ticket-url-pattern-storage';
import useHippoTicketLookup from './use-hippo-ticket-lookup';

import cardStyles from '../CardModal/ProjectContent.module.scss';
import styles from './HippoImportField.module.scss';

const HippoImportField = React.memo(({ boardId, projectId, autoFocus, onFetch }) => {
  const [t] = useTranslation();
  const [value, setValue] = useState('');
  const [inputErrorText, setInputErrorText] = useState(null);
  const [isOpened, setIsOpened] = useState(autoFocus);
  const [fetchTicket, isFetching, fetchError] = useHippoTicketLookup(boardId);

  const [fieldRef, handleFieldRef] = useNestedRef('inputRef');

  const handleChange = useCallback((_, { value: nextValue }) => {
    setValue(nextValue);
    setInputErrorText(null);
  }, []);

  const handleSubmit = useCallback(async () => {
    const ticketNumber = parseTicketNumber(value);

    if (!ticketNumber) {
      setInputErrorText(t('common.enterTicketNumberOrUrl'));
      fieldRef.current.select();
      return;
    }

    const ticket = await fetchTicket(ticketNumber);

    if (!ticket) {
      return;
    }

    let ticketUrl;

    if (isTicketUrl(value)) {
      ticketUrl = value.trim();

      const pattern = toTicketUrlPattern(ticketUrl, ticketNumber);

      if (pattern) {
        writeTicketUrlPattern(projectId, pattern);
      }
    } else {
      ticketUrl = buildTicketUrl(readTicketUrlPattern(projectId), ticketNumber);
    }

    onFetch(ticket, ticketUrl);
  }, [value, projectId, fetchTicket, onFetch, fieldRef, t]);

  const handleToggleClick = useCallback(() => {
    setIsOpened((prevIsOpened) => !prevIsOpened);
  }, []);

  // Opening it, whether by a click or from a list's Hippo button, puts the cursor in the field
  useEffect(() => {
    if (isOpened) {
      fieldRef.current.focus();
    }
  }, [isOpened, fieldRef]);

  const errorText = inputErrorText || (fetchError && getHippoErrorText(fetchError, t));

  return (
    <div className={cardStyles.contentModule}>
      <div className={cardStyles.moduleWrapper}>
        <Icon name="ticket alternate" className={cardStyles.moduleIcon} />
        <button
          type="button"
          className={classNames(cardStyles.moduleHeader, styles.toggleButton)}
          onClick={handleToggleClick}
        >
          {t('action.importFromHippo')}
          <Icon name={isOpened ? 'chevron up' : 'chevron down'} className={styles.toggleIcon} />
        </button>
        {isOpened && (
          <Form className={styles.wrapper} onSubmit={handleSubmit}>
            <Input
              ref={handleFieldRef}
              value={value}
              placeholder={t('common.ticketNumberOrUrl')}
              maxLength={1024}
              className={styles.field}
              onChange={handleChange}
            />
            <Button
              type="submit"
              loading={isFetching}
              disabled={isFetching}
              content={t('action.fetch')}
              className={styles.button}
            />
            {errorText && <div className={styles.error}>{errorText}</div>}
          </Form>
        )}
      </div>
    </div>
  );
});

HippoImportField.propTypes = {
  boardId: PropTypes.string.isRequired,
  projectId: PropTypes.string.isRequired,
  autoFocus: PropTypes.bool,
  onFetch: PropTypes.func.isRequired,
};

HippoImportField.defaultProps = {
  autoFocus: false,
};

export default HippoImportField;
