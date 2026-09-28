// Публичное веб-превью Telegram-канала: t.me/s/<канал>. Бот чужие каналы не читает — берём превью (TECH.md).
// Храним краткий текст и ссылку, картинки — только адреса (для чтения афиши ИИ).
import type { RawPost } from './types.ts';

const ENTITIES: Record<string, string> = { amp: '&', lt: '<', gt: '>', quot: '"', '#39': "'", nbsp: ' ', laquo: '«', raquo: '»', mdash: '—', ndash: '–' };

export function htmlToText(html: string): string {
  return html
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&(#\d+|#x[0-9a-f]+|\w+);/gi, (m, e: string) => {
      if (ENTITIES[e]) return ENTITIES[e];
      if (e.startsWith('#x')) return String.fromCodePoint(parseInt(e.slice(2), 16));
      if (e.startsWith('#')) return String.fromCodePoint(Number(e.slice(1)));
      return m;
    })
    .replace(/[ \t]+\n/g, '\n')
    .trim();
}

/** Посты со страницы превью, от старых к новым. `after` — курсор: номер последнего прочитанного поста. */
export function parseChannel(html: string, sourceId: string, after: string | null = null): RawPost[] {
  const posts: RawPost[] = [];
  const blocks = html.split(/(?=<div class="tgme_widget_message [^"]*"[^>]*data-post=")/);
  for (const b of blocks) {
    const id = /data-post="([^"]+)\/(\d+)"/.exec(b);
    if (!id) continue;
    const [, channel, num] = id;
    if (after && Number(num) <= Number(after)) continue;
    const text = /<div class="tgme_widget_message_text[^"]*"[^>]*>([\s\S]*?)<\/div>/.exec(b);
    const images = [...b.matchAll(/tgme_widget_message_photo_wrap[^>]*background-image:url\('([^']+)'\)/g)].map((m) => m[1]);
    const time = /<time[^>]*datetime="([^"]+)"/.exec(b);
    if (!text && !images.length) continue;
    posts.push({
      sourceId,
      externalId: num,
      url: `https://t.me/${channel}/${num}`,
      text: text ? htmlToText(text[1]) : '',
      images,
      postedAt: time ? new Date(time[1]).toISOString() : null,
    });
  }
  return posts.sort((a, b) => Number(a.externalId) - Number(b.externalId));
}

export async function fetchChannel(handle: string, sourceId: string, after: string | null): Promise<RawPost[]> {
  const res = await fetch(`https://t.me/s/${encodeURIComponent(handle)}`, { headers: { 'User-Agent': 'ryadom-worker/0.1', 'Accept-Language': 'ru' } });
  if (!res.ok) throw new Error(`t.me/s/${handle}: ${res.status}`);
  return parseChannel(await res.text(), sourceId, after);
}
