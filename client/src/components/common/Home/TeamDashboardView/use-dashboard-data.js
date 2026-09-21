/*!
 * Copyright (c) 2024 PLANKA Software GmbH
 * Licensed under the Fair Use License: https://github.com/plankanban/planka/blob/master/LICENSE.md
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { useSelector } from 'react-redux';

import api from '../../../../api';
import selectors from '../../../../selectors';

const CLOSED_WITHIN_DAYS = 30;

// The dashboard spans boards whose contents aren't in the redux store (Planka only loads the
// current board), so it keeps its own snapshot fetched from GET /api/dashboard.
export default () => {
  const accessToken = useSelector(selectors.selectAccessToken);

  const [data, setData] = useState(null);
  const [isFetching, setIsFetching] = useState(true);
  const [error, setError] = useState(null);

  const requestIdRef = useRef(0);

  const getHeaders = useCallback(
    () => ({
      Authorization: `Bearer ${accessToken}`,
    }),
    [accessToken],
  );

  const refetch = useCallback(async () => {
    requestIdRef.current += 1;
    const requestId = requestIdRef.current;

    setIsFetching(true);

    try {
      const body = await api.getDashboard({ closedWithinDays: CLOSED_WITHIN_DAYS }, getHeaders());

      if (requestId === requestIdRef.current) {
        setData({
          cards: body.items,
          ...body.included,
        });

        setError(null);
      }
    } catch (fetchError) {
      if (requestId === requestIdRef.current) {
        setError(fetchError);
      }
    } finally {
      if (requestId === requestIdRef.current) {
        setIsFetching(false);
      }
    }
  }, [getHeaders]);

  useEffect(() => {
    refetch();
  }, [refetch]);

  const patchCard = useCallback((id, patch) => {
    setData(
      (prevData) =>
        prevData && {
          ...prevData,
          cards: prevData.cards.map((card) => (card.id === id ? { ...card, ...patch } : card)),
        },
    );
  }, []);

  const updateCardDates = useCallback(
    async (id, { startDate, dueDate }) => {
      const prevCard = data.cards.find((card) => card.id === id);

      patchCard(id, { startDate, dueDate });

      try {
        await api.updateCard(
          id,
          {
            startDate: startDate || null,
            dueDate: dueDate || null,
          },
          getHeaders(),
        );
      } catch (updateError) {
        patchCard(id, {
          startDate: prevCard.startDate,
          dueDate: prevCard.dueDate,
        });

        setError(updateError);
      }
    },
    [data, patchCard, getHeaders],
  );

  const createCardDependency = useCallback(
    async (predecessorCardId, successorCardId) => {
      try {
        const { item } = await api.createCardDependency(
          successorCardId,
          { predecessorCardId },
          getHeaders(),
        );

        setData((prevData) => ({
          ...prevData,
          cardDependencies: [...prevData.cardDependencies, item],
        }));
      } catch (createError) {
        setError(createError);
      }
    },
    [getHeaders],
  );

  const deleteCardDependency = useCallback(
    async (id) => {
      try {
        await api.deleteCardDependency(id, getHeaders());

        setData((prevData) => ({
          ...prevData,
          cardDependencies: prevData.cardDependencies.filter(
            (cardDependency) => cardDependency.id !== id,
          ),
        }));
      } catch (deleteError) {
        setError(deleteError);
      }
    },
    [getHeaders],
  );

  const dismissError = useCallback(() => {
    setError(null);
  }, []);

  return {
    data,
    isFetching,
    error,
    refetch,
    dismissError,
    updateCardDates,
    createCardDependency,
    deleteCardDependency,
  };
};
