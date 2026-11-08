import { config } from '../lib/config';

/** Verified Supabase public-image transformer. Videos, signed URLs and other hosts keep their original URL. */
export function imageUrl(uri: string, width?: number): string {
  if (width == null || !Number.isFinite(width) || width <= 0) return uri;
  try {
    const url = new URL(uri);
    if (url.origin !== new URL(config.supabaseUrl).origin || !url.pathname.startsWith('/storage/v1/object/public/') || !/\.(jpe?g|png|webp|avif)$/i.test(url.pathname)) return uri;
    url.pathname = url.pathname.replace('/object/public/', '/render/image/public/');
    url.searchParams.set('width', String(Math.min(1600, Math.max(64, Math.ceil(width / 64) * 64))));
    url.searchParams.set('quality', '82');
    url.searchParams.set('resize', 'contain');
    return url.toString();
  } catch { return uri; }
}
