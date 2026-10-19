import type { MessageKind } from '../data/types';
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';

/** Ограничиваем длинную сторону без увеличения маленьких фото; JPEG убирает тяжёлый HEIC/PNG. */
export function photoSize(width: number, height: number, max = 1080) {
  const scale = Math.min(1, max / Math.max(width, height));
  return { width: Math.max(1, Math.round(width * scale)), height: Math.max(1, Math.round(height * scale)) };
}

export async function preparePhoto(uri: string, width: number, height: number): Promise<string> {
  if (!(width > 0 && height > 0)) throw new Error('invalid-image-size');
  const context = ImageManipulator.manipulate(uri);
  context.resize(photoSize(width, height));
  const rendered = await context.renderAsync();
  try {
    return (await rendered.saveAsync({ compress: 0.78, format: SaveFormat.JPEG })).uri;
  } finally {
    rendered.release();
    context.release();
  }
}

/** file:// на Android часто отдаёт пустой или общий MIME; расширение сохраняет формат записи. */
export function mediaFormat(uri: string, kind: MessageKind = 'photo', reported?: string | null): { contentType: string; ext: string } {
  const suffix = uri.split(/[?#]/)[0].match(/\.([a-z0-9]+)$/i)?.[1]?.toLowerCase();
  const formats: Record<string,string> = { jpg:'image/jpeg',jpeg:'image/jpeg',png:'image/png',webp:'image/webp',heic:'image/heic',mp4:'video/mp4',mov:'video/quicktime',m4a:'audio/mp4',aac:'audio/aac',ogg:'audio/ogg',wav:'audio/wav' };
  if (suffix && formats[suffix]) return { contentType: formats[suffix], ext: suffix === 'jpeg' ? 'jpg' : suffix };
  const fallback = kind === 'voice' ? { contentType:'audio/mp4',ext:'m4a' } : kind === 'circle' || kind === 'video' ? { contentType:'video/mp4',ext:'mp4' } : { contentType:'image/jpeg',ext:'jpg' };
  if (reported && /^(image|audio|video)\//.test(reported)) return { contentType: reported, ext: reported.split('/')[1].replace('jpeg','jpg').replace('quicktime','mov').replace('mp4',kind==='voice'?'m4a':'mp4') };
  return fallback;
}
