import { imageUrl } from '../data/imageUrl';
import { config } from '../lib/config';
const base = config.supabaseUrl;
it('requests a bounded proportional thumbnail for a public project image', () => {
  const url = new URL(imageUrl(`${base}/storage/v1/object/public/event-media/poster.jpg?v=2`, 365));
  expect(url.pathname).toBe('/storage/v1/render/image/public/event-media/poster.jpg');
  expect(url.searchParams.get('width')).toBe('384');
  expect(url.searchParams.get('resize')).toBe('contain');
  expect(url.searchParams.get('v')).toBe('2');
  expect(new URL(imageUrl(`${base}/storage/v1/object/public/event-media/poster.jpg`, 4000)).searchParams.get('width')).toBe('1600');
});
it.each([
  'https://example.com/photo.jpg',
  `${base}/storage/v1/object/sign/media/photo.jpg?token=private`,
  `${base}/storage/v1/object/public/event-media/video.mp4`,
  `${base}/storage/v1/object/public/event-media/animated.gif`,
  'file:///tmp/photo.jpg',
])('keeps foreign, signed, local and non-still-image sources untouched', uri => {
  expect(imageUrl(uri, 1080)).toBe(uri);
});
it('keeps original images when no preview width was requested', () => {
  const uri = `${base}/storage/v1/object/public/event-media/poster.jpg`;
  expect(imageUrl(uri)).toBe(uri);
  expect(imageUrl(uri, NaN)).toBe(uri);
});
