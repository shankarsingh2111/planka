/*!
 * Copyright (c) 2024 PLANKA Software GmbH
 * Licensed under the Fair Use License: https://github.com/plankanban/planka/blob/master/LICENSE.md
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { useSelector } from 'react-redux';

import api from '../../../../api';
import selectors from '../../../../selectors';

const INITIAL_STATE = {
  hasSynced: null,
  syncedAt: null,
  isSyncing: false,
  error: null,
};

/**
 * A card's sync with its Hippo ticket. Opening the card sends one quiet refresh, which the server
 * skips when it is not due; syncNow always reaches Hippo. Only the latest call settles the state,
 * and only syncNow reports errors. Calls go straight to the server, past the request queue.
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
        error: null,
      }));

      try {
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
            error: null,
          });
        }
      } catch (error) {
        if (requestId === requestIdRef.current) {
          setState((prevState) => ({
            ...prevState,
            isSyncing: false,
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
