import { createSignedMediaCache } from '../data/signedMedia';

it('переиспользует подписанные ссылки и подписывает только новые пути', async () => {
  const cache = createSignedMediaCache(3, 100);
  const sign = jest.fn(async (paths: string[]) => paths.map(path => ({ path, signedUrl: `signed:${path}` })));
  await cache.resolve('alice', ['a', 'a', 'b'], sign, 0);
  expect(sign).toHaveBeenLastCalledWith(['a', 'b']);
  expect((await cache.resolve('alice', ['a', 'c'], sign, 10)).get('a')).toBe('signed:a');
  expect(sign).toHaveBeenLastCalledWith(['c']);
  await cache.resolve('alice', ['a'], sign, 101);
  expect(sign).toHaveBeenCalledTimes(3);
});

it('объединяет одновременные запросы одного вложения', async () => {
  const cache = createSignedMediaCache();
  const sign = jest.fn(async (paths: string[]) => paths.map(path => ({ path, signedUrl: path })));
  const results = await Promise.all([cache.resolve('alice', ['a', 'b'], sign), cache.resolve('alice', ['b', 'c'], sign)]);
  expect(sign.mock.calls.map(call => call[0])).toEqual([['a', 'b'], ['c']]);
  expect(results[1].get('b')).toBe('b');
});

it('очищает ошибку для повтора, ограничивает LRU и разделяет пользователей', async () => {
  const cache = createSignedMediaCache(1);
  const sign = jest.fn(async (paths: string[]) => paths.map(path => ({ path, signedUrl: path })));
  await expect(cache.resolve('alice', ['a'], async () => { throw new Error('offline'); })).rejects.toThrow('offline');
  await cache.resolve('alice', ['a', 'b'], sign);
  await cache.resolve('alice', ['a'], sign);
  expect(sign).toHaveBeenCalledTimes(2);
  await cache.resolve('bob', ['a'], sign);
  expect(sign).toHaveBeenCalledTimes(3);
  cache.clear();
  await cache.resolve('bob', ['a'], sign);
  expect(sign).toHaveBeenCalledTimes(4);
});

it('поздний ответ предыдущего аккаунта не засоряет кэш нового', async () => {
  const cache = createSignedMediaCache();
  let finish!: (value: { path: string; signedUrl: string }[]) => void;
  const old = cache.resolve('alice', ['a'], () => new Promise(resolve => { finish = resolve; }));
  await Promise.resolve();
  const sign = jest.fn(async (paths: string[]) => paths.map(path => ({ path, signedUrl: 'bob-url' })));
  await cache.resolve('bob', ['a'], sign);
  finish([{ path: 'a', signedUrl: 'alice-url' }]);
  await old;
  expect((await cache.resolve('bob', ['a'], sign)).get('a')).toBe('bob-url');
  expect(sign).toHaveBeenCalledTimes(1);
});
