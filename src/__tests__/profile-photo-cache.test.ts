import { replaceMainPhoto } from '../profile/photoCache';

it('смена аватара сразу меняет первое фото и сохраняет галерею', () => {
  expect(replaceMainPhoto(['old', 'second', 'third'], 'new')).toEqual(['new', 'second', 'third']);
  expect(replaceMainPhoto(['old', 'new', 'third'], 'new')).toEqual(['new', 'third']);
  expect(replaceMainPhoto(undefined, 'new')).toEqual(['new']);
});
