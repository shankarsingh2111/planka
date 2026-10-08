import { call, select } from 'redux-saga/effects';

import { syncCommentToHippo, syncTicketStateToHippo } from './hippo-sync';
import api from '../../../api';
import selectors from '../../../selectors';

// The real modules pull in the whole app; only their identities matter here
jest.mock('../../../api', () => ({ syncHippoNote: jest.fn(), syncHippoStatus: jest.fn() }));
jest.mock('../../../selectors', () => ({ selectAccessToken: jest.fn() }));
jest.mock('../request', () => jest.fn());
jest.mock('react-hot-toast', () => jest.fn());

// Hippo may take up to its 10s timeout; the push must not hold the shared request queue every
// other Planka change waits in
describe('hippo-sync', () => {
  it('posts a comment to Hippo directly, outside the request queue', () => {
    const saga = syncCommentToHippo('1', '2');

    expect(saga.next().value).toEqual(select(selectors.selectAccessToken));

    expect(saga.next('token').value).toEqual(
      call(api.syncHippoNote, '1', { commentId: '2' }, { Authorization: 'Bearer token' }),
    );
  });

  it('pushes a ticket state to Hippo directly, outside the request queue', () => {
    const saga = syncTicketStateToHippo('1');

    expect(saga.next().value).toEqual(select(selectors.selectAccessToken));

    expect(saga.next('token').value).toEqual(
      call(api.syncHippoStatus, '1', { Authorization: 'Bearer token' }),
    );
  });
});
