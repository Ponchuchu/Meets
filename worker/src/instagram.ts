// Instagram через Business Discovery (Graph API): публичные бизнес-/креатор-аккаунты по нику.
// Нужны секреты IG_TOKEN (токен Facebook Login) и IG_USER_ID (id нашего Instagram-бизнес-аккаунта).
import type { RawPost } from './types.ts';

const GRAPH = 'https://graph.facebook.com/v26.0';

type Media = { id: string; caption?: string; timestamp?: string; permalink?: string; media_type?: string; media_url?: string; thumbnail_url?: string };

export function parseMedia(items: Media[], sourceId: string, after: string | null = null): RawPost[] {
  return items
    .filter((m) => m.caption || m.media_url || m.thumbnail_url)
    .filter((m) => !after || (m.timestamp ?? '') > after)
    .map((m) => ({
      sourceId,
      externalId: m.id,
      url: m.permalink ?? '',
      text: m.caption ?? '',
      images: [m.media_url ?? m.thumbnail_url].filter((u): u is string => !!u),
      postedAt: m.timestamp ? new Date(m.timestamp).toISOString() : null,
    }))
    .sort((a, b) => (a.postedAt ?? '').localeCompare(b.postedAt ?? ''));
}

/** Свежие посты аккаунта. `after` — курсор: время последнего прочитанного поста (ISO). */
export async function fetchInstagram(handle: string, sourceId: string, after: string | null): Promise<RawPost[]> {
  const token = process.env.IG_TOKEN, me = process.env.IG_USER_ID;
  if (!token || !me) throw new Error('нет IG_TOKEN / IG_USER_ID');
  const fields = `business_discovery.username(${encodeURIComponent(handle)}){media.limit(25){caption,timestamp,permalink,media_type,media_url,thumbnail_url}}`;
  const res = await fetch(`${GRAPH}/${me}?fields=${fields}&access_token=${token}`);
  const body = (await res.json()) as { business_discovery?: { media?: { data?: Media[] } }; error?: { message: string } };
  if (!res.ok || body.error) throw new Error(`instagram @${handle}: ${body.error?.message ?? res.status}`);
  return parseMedia(body.business_discovery?.media?.data ?? [], sourceId, after);
}
