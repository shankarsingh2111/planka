/*!
 * Copyright (c) 2024 PLANKA Software GmbH
 * Licensed under the Fair Use License: https://github.com/plankanban/planka/blob/master/LICENSE.md
 */

import React, { useCallback, useMemo, useState } from 'react';
import { useSelector } from 'react-redux';
import { useTranslation } from 'react-i18next';
import { Button, Form, Header, Message, Tab } from 'semantic-ui-react';
import { Input } from '../../../lib/custom-ui';

import selectors from '../../../selectors';
import api from '../../../api';
import { useForm, useNestedRef } from '../../../hooks';
import { getHippoErrorText } from '../../../utils/hippo';

import styles from './IntegrationsPane.module.scss';

const DEFAULT_DATA = {
  appSecretKey: '',
};

// Talks to the server directly, as the team dashboard does. Whether a key is set comes back
// through the projectUpdate socket event; the key itself never comes back.
const IntegrationsPane = React.memo(() => {
  const project = useSelector(selectors.selectCurrentProject);
  const accessToken = useSelector(selectors.selectAccessToken);

  const [t] = useTranslation();
  const [data, handleFieldChange, setData] = useForm(DEFAULT_DATA);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [message, setMessage] = useState(null);

  const [keyFieldRef, handleKeyFieldRef] = useNestedRef('inputRef');

  const headers = useMemo(
    () => ({
      Authorization: `Bearer ${accessToken}`,
    }),
    [accessToken],
  );

  const run = useCallback(
    async (sendRequest, successKey) => {
      setIsSubmitting(true);
      setMessage(null);

      try {
        await sendRequest();

        setMessage({
          isError: false,
          content: t(successKey),
        });
      } catch (error) {
        setMessage({
          isError: true,
          content: getHippoErrorText(error, t),
        });
      } finally {
        setIsSubmitting(false);
      }
    },
    [t],
  );

  const handleSubmit = useCallback(() => {
    const appSecretKey = data.appSecretKey.trim();

    if (!appSecretKey) {
      keyFieldRef.current.select();
      return;
    }

    run(
      () =>
        api.updateHippoConfig(
          project.id,
          {
            appSecretKey,
          },
          headers,
        ),
      'common.hippoKeySaved',
    );

    setData(DEFAULT_DATA);
  }, [project.id, headers, data, setData, run, keyFieldRef]);

  const handleTestClick = useCallback(() => {
    run(() => api.verifyHippoConfig(project.id, headers), 'common.hippoConnectionWorks');
  }, [project.id, headers, run]);

  const handleRemoveClick = useCallback(() => {
    run(() => api.deleteHippoConfig(project.id, headers), 'common.hippoKeyRemoved');
  }, [project.id, headers, run]);

  return (
    <Tab.Pane attached={false} className={styles.wrapper}>
      <Header as="h4">
        {t('common.hippo', {
          context: 'title',
        })}
      </Header>
      <p className={styles.status}>
        {project.isHippoConfigured ? t('common.hippoIsConfigured') : t('common.hippoNotConfigured')}
      </p>
      <Form onSubmit={handleSubmit}>
        <div className={styles.text}>{t('common.hippoAppSecretKey')}</div>
        <Input
          fluid
          ref={handleKeyFieldRef}
          type="password"
          name="appSecretKey"
          value={data.appSecretKey}
          maxLength={512}
          autoComplete="off"
          className={styles.field}
          onChange={handleFieldChange}
        />
        <Button positive type="submit" disabled={isSubmitting} content={t('action.save')} />
        {project.isHippoConfigured && (
          <>
            <Button
              type="button"
              disabled={isSubmitting}
              content={t('action.testConnection')}
              onClick={handleTestClick}
            />
            <Button
              type="button"
              disabled={isSubmitting}
              content={t('action.remove')}
              onClick={handleRemoveClick}
            />
          </>
        )}
      </Form>
      {message && (
        <Message
          visible
          size="tiny"
          positive={!message.isError}
          negative={message.isError}
          content={message.content}
          className={styles.message}
        />
      )}
    </Tab.Pane>
  );
});

export default IntegrationsPane;
