/*!
 * Copyright (c) 2024 PLANKA Software GmbH
 * Licensed under the Fair Use License: https://github.com/plankanban/planka/blob/master/LICENSE.md
 */

import { useCallback, useRef, useState } from 'react';
import { useSelector } from 'react-redux';

import api from '../../../api';
import selectors from '../../../selectors';

// Looks a ticket up through the server; only the latest lookup may settle the state
export default (boardId) => {
  const accessToken = useSelector(selectors.selectAccessToken);

  const [isFetching, setIsFetching] = useState(false);
  const [error, setError] = useState(null);

  const requestIdRef = useRef(0);

  const fetchTicket = useCallback(
    async (ticketNumber) => {
      requestIdRef.current += 1;
      const requestId = requestIdRef.current;

      setIsFetching(true);
      setError(null);

      try {
        const { item } = await api.getHippoTicket(boardId, ticketNumber, {
          Authorization: `Bearer ${accessToken}`,
        });

        return requestId === requestIdRef.current ? item : null;
      } catch (fetchError) {
        if (requestId === requestIdRef.current) {
          setError(fetchError);
        }

        return null;
      } finally {
        if (requestId === requestIdRef.current) {
          setIsFetching(false);
        }
      }
    },
    [boardId, accessToken],
  );

  return [fetchTicket, isFetching, error];
};
