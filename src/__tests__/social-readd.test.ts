import { useSocial } from '../state/social';

test('removing a friend clears only their previous request decisions so they can be added again', () => {
  useSocial.setState({
    answered: { denis: 'accepted', other: 'declined' },
    sent: { denis: true, other: true },
    removed: {},
  });
  useSocial.getState().removeFriend('denis');
  expect(useSocial.getState().answered).toEqual({ other: 'declined' });
  expect(useSocial.getState().sent).toEqual({ other: true });
  expect(useSocial.getState().removed.denis).toBe(true);
  useSocial.getState().toggleRequest('denis');
  expect(useSocial.getState().sent.denis).toBe(true);
});
