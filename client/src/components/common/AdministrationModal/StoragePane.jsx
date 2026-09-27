/*!
 * Copyright (c) 2024 PLANKA Software GmbH
 * Licensed under the Fair Use License: https://github.com/plankanban/planka/blob/master/LICENSE.md
 */

import React, { useCallback, useEffect, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useTranslation } from 'react-i18next';
import { Button, Checkbox, Divider, Header, Message, Progress, Tab } from 'semantic-ui-react';

import selectors from '../../../selectors';
import entryActions from '../../../entry-actions';
import { usePopupInClosableContext } from '../../../hooks';
import ConfirmationStep from '../ConfirmationStep';

import styles from './StoragePane.module.scss';

const POLL_INTERVAL = 2000;

const ExportStatuses = {
  RUNNING: 'running',
  COMPLETED: 'completed',
  FAILED: 'failed',
};

const StoragePane = React.memo(() => {
  const { storage, isExportSubmitting, error } = useSelector(selectors.selectStorageState);

  const dispatch = useDispatch();
  const [t] = useTranslation();
  const [deleteLocalFiles, setDeleteLocalFiles] = useState(false);

  const s3Export = storage && storage.s3Export;
  const isExportRunning = !!s3Export && s3Export.status === ExportStatuses.RUNNING;

  useEffect(() => {
    dispatch(entryActions.fetchStorage());
  }, [dispatch]);

  useEffect(() => {
    if (!isExportRunning) {
      return undefined;
    }

    const interval = setInterval(() => {
      dispatch(entryActions.fetchStorage());
    }, POLL_INTERVAL);

    return () => {
      clearInterval(interval);
    };
  }, [isExportRunning, dispatch]);

  const handleDeleteLocalFilesChange = useCallback((_, { checked }) => {
    setDeleteLocalFiles(checked);
  }, []);

  const handleExport = useCallback(() => {
    dispatch(
      entryActions.exportStorageToS3({
        deleteLocalFiles,
      }),
    );
  }, [deleteLocalFiles, dispatch]);

  const ConfirmationPopup = usePopupInClosableContext(ConfirmationStep);

  if (!storage) {
    return (
      <Tab.Pane attached={false} loading={!error} className={styles.wrapper}>
        {error && <Message negative size="small" content={error.message} />}
      </Tab.Pane>
    );
  }

  let location = t('common.localDisk');
  if (storage.isS3Enabled) {
    location = t('common.s3Bucket', {
      bucket: storage.s3Bucket,
    });

    if (storage.s3Region) {
      location += ` (${storage.s3Region})`;
    }
  }

  const exportButton = (
    <Button
      positive={!deleteLocalFiles}
      negative={deleteLocalFiles}
      content={t(
        deleteLocalFiles ? 'action.exportAndDeleteLocalCopies' : 'action.exportLocalFilesToS3',
      )}
      loading={isExportSubmitting || isExportRunning}
      disabled={isExportSubmitting || isExportRunning}
      onClick={deleteLocalFiles ? undefined : handleExport}
    />
  );

  return (
    <Tab.Pane attached={false} className={styles.wrapper}>
      <div className={styles.text}>{t('common.storageLocation')}</div>
      <div className={styles.value}>{location}</div>
      <div className={styles.text}>{t('common.lastExportedToS3')}</div>
      <div className={styles.value}>
        {storage.s3LastExportedAt ? (
          <>
            {t('format:fullDateTime', {
              value: new Date(storage.s3LastExportedAt),
              postProcess: 'formatDate',
            })}
            {storage.s3LastExportResult && (
              <div className={styles.details}>
                {t('common.s3LastExportResult', storage.s3LastExportResult)}
              </div>
            )}
          </>
        ) : (
          t('common.never')
        )}
      </div>
      {storage.isS3Enabled ? (
        <>
          <Divider horizontal section>
            <Header as="h4">
              {t('common.exportLocalFilesToS3', {
                context: 'title',
              })}
            </Header>
          </Divider>
          <p className={styles.description}>{t('common.exportLocalFilesToS3Description')}</p>
          <Checkbox
            checked={deleteLocalFiles}
            label={t('common.deleteLocalCopiesOnceVerifiedInS3')}
            disabled={isExportRunning}
            className={styles.checkbox}
            onChange={handleDeleteLocalFilesChange}
          />
          {deleteLocalFiles && !isExportSubmitting && !isExportRunning ? (
            <ConfirmationPopup
              title="common.deleteLocalCopies"
              content="common.areYouSureYouWantToDeleteLocalCopies"
              buttonType="negative"
              buttonContent="action.exportAndDeleteLocalCopies"
              onConfirm={handleExport}
            >
              {exportButton}
            </ConfirmationPopup>
          ) : (
            exportButton
          )}
          {error && <Message negative size="small" content={error.message} />}
          {s3Export && (
            <div className={styles.export}>
              {s3Export.status === ExportStatuses.RUNNING &&
                (s3Export.total === null ? (
                  <p>{t('common.listingLocalFiles')}</p>
                ) : (
                  <>
                    <Progress
                      indicating
                      size="small"
                      value={s3Export.processed}
                      total={Math.max(s3Export.total, 1)}
                      className={styles.progress}
                    />
                    <p>
                      {t('common.s3ExportProgress', {
                        ...s3Export,
                        count: s3Export.total,
                      })}
                    </p>
                  </>
                ))}
              {s3Export.status === ExportStatuses.COMPLETED && (
                <Message
                  positive={s3Export.failed === 0}
                  warning={s3Export.failed > 0}
                  size="small"
                  content={t(
                    s3Export.failed === 0
                      ? 'common.s3ExportCompleted'
                      : 'common.s3ExportCompletedWithFailures',
                    {
                      ...s3Export,
                      count: s3Export.failed,
                    },
                  )}
                />
              )}
              {s3Export.status === ExportStatuses.FAILED && (
                <Message
                  negative
                  size="small"
                  content={t('common.s3ExportFailed', {
                    error: s3Export.error,
                  })}
                />
              )}
              {s3Export.orphaned > 0 && (
                <p className={styles.details}>
                  {t('common.s3ExportLeftOutFiles', {
                    count: s3Export.orphaned,
                  })}
                </p>
              )}
              {s3Export.failures.length > 0 && (
                <>
                  <Header as="h5">
                    {t('common.failedFiles', {
                      context: 'title',
                    })}
                  </Header>
                  <ul className={styles.failures}>
                    {s3Export.failures.map(({ pathSegment, message }) => (
                      <li key={pathSegment}>
                        <code>{pathSegment}</code>: {message}
                      </li>
                    ))}
                    {s3Export.failed > s3Export.failures.length && (
                      <li>
                        {t('common.andMoreFailedFiles', {
                          number: s3Export.failed - s3Export.failures.length,
                        })}
                      </li>
                    )}
                  </ul>
                </>
              )}
            </div>
          )}
        </>
      ) : (
        <Message info size="small" content={t('common.s3IsNotEnabled')} />
      )}
    </Tab.Pane>
  );
});

export default StoragePane;
