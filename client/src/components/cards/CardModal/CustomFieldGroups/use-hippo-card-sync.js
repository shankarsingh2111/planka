/*!
 * Copyright (c) 2024 PLANKA Software GmbH
 * Licensed under the Fair Use License: https://github.com/plankanban/planka/blob/master/LICENSE.md
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { useSelector } from 'react-redux';

import api from '../../../../api';
import selectors from '../../../../selectors';
import { waitForQueuedRequests } from '../../../../sagas/core/request';

const INITIAL_STATE = {
  hasSynced: null,
  syncedAt: null,
  isSyncing: false,
  isForced: false,
  error: null,
};

/**
 * A card's sync with its Hippo ticket. Opening the card sends one quiet refresh, which the server
 * skips when it is not due; syncNow always reaches Hippo. Only the latest call settles the state,
 * and only syncNow reports errors. Calls go straight to the server, past the request queue, once
 * the changes already in it are saved: a Ticket # typed just before the click must reach it first.
 */
export default (cardId, isEnabled) => {
  const accessToken = useSelector(selectors.selectAccessToken);

  const [state, setState] = useState(INITIAL_STATE);
  const requestIdRef = useRef(0);

  const sync = useCallback(
    async (force) => {
      requestIdRef.current += 1;
      const requestId = requestIdRef.current;

      setState((prevState) => ({
        ...prevState,
        isSyncing: true,
        isForced: force,
        error: null,
      }));

      try {
        await waitForQueuedRequests();

        const { item } = await api.syncHippoCard(
          cardId,
          {
            force,
          },
          {
            Authorization: `Bearer ${accessToken}`,
          },
        );

        if (requestId === requestIdRef.current) {
          setState({
            hasSynced: item.hasSynced,
            syncedAt: item.syncedAt ? new Date(item.syncedAt) : null,
            isSyncing: false,
            isForced: false,
            error: null,
          });
        }
      } catch (error) {
        if (requestId === requestIdRef.current) {
          setState((prevState) => ({
            ...prevState,
            isSyncing: false,
            isForced: false,
            error: force ? error : null,
          }));
        }
      }
    },
    [cardId, accessToken],
  );

  const syncNow = useCallback(() => {
    sync(true);
  }, [sync]);

  useEffect(() => {
    setState(INITIAL_STATE);

    if (isEnabled) {
      sync(false);
    }
  }, [cardId, isEnabled]); // eslint-disable-line react-hooks/exhaustive-deps

  return [state, syncNow];
};
