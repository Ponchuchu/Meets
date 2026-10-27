import { getFriendRequests, getPersonDetails } from '../data/remote';

const mockPeer = { id: 'peer', name: 'Денис QA', handle: 'denis_qa', photo_url: null, about: 'QA' };
const mockClient = {
  rpc: jest.fn(async () => ({ data: [], error: null })),
  from: (table: string) => {
    let selection = ''; let id: string | undefined;
    const result = () => ({ error: null, data: table === 'friendships' ? [] : table === 'friend_requests' ? [{ from_id: 'peer', note: 'QA' }] : [mockPeer] });
    const query = {
      select: (fields: string) => { selection = fields; return query; },
      eq: (key: string, value: string) => { if (key === 'id') id = value; return query; },
      or: () => query, in: () => query,
      maybeSingle: async () => ({ data: selection === 'tags' ? { tags: [] } : id === 'peer' ? mockPeer : null, error: null }),
      then: (resolve: (value: ReturnType<typeof result>) => unknown) => Promise.resolve(result()).then(resolve),
    };
    return query;
  },
};
jest.mock('../data/client', () => ({
  requireUser: async () => 'me', supabase: () => mockClient, withTimeout: (value: unknown) => value,
}));

test('a public profile can supply its header without being in the friends/chat directory', async () => {
  const details = await getPersonDetails('peer');
  expect(details?.person).toMatchObject({ id: 'peer', name: 'Денис QA', handle: 'denis_qa', isFriend: false });
  expect(details?.birthday).toBeUndefined();
});

test('an unavailable profile does not create a fictional public header', async () => {
  expect(await getPersonDetails('hidden')).toBeNull();
});

test('a new request carries its sender while the independently cached people list is stale', async () => {
  const requests = await getFriendRequests();
  expect(requests).toHaveLength(1);
  expect(requests[0]).toMatchObject({ personId: 'peer', note: 'QA', person: { id: 'peer', name: 'Денис QA', isFriend: false } });
});
