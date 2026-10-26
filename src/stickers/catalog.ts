// Стикеры (26 октября, набор нарисован в Figma): глянцевые наклейки с белой вырубкой, как в Telegram, — почти без текста.
// Текст только у отдельных мемов («67», «МОГНУ», «ГО?»…). У каждого стикера своя анимация и звук: на карте он «долетает»
// до друга и играет (StickerBlast), в чате — по нажатию (InteractiveSticker).
import type { ImageSourcePropType } from 'react-native';

export type StickerPack = 'reactions' | 'mood' | 'memes';
export type StickerAnim =
  | 'heartbeat' | 'punch' | 'wobble' | 'confetti' | 'flicker' | 'clap' | 'laugh' | 'rattle' | 'look' | 'pop'
  | 'launch' | 'steam' | 'sway' | 'shine' | 'float' | 'hug' | 'slam' | 'sixseven';
export type StickerSound =
  | 'heart' | 'punch' | 'squeak' | 'confetti' | 'sizzle' | 'clap' | 'laugh' | 'rattle' | 'pop' | 'whoosh' | 'boing' | 'chime' | 'snore' | 'slam';

export interface Sticker {
  id: string;
  /** Подпись: по ней стикер ищут, читает экранный диктор, и она же уходит в сообщение. */
  label: string;
  pack: StickerPack;
  level: number;
  /** Картинка-наклейка или… */
  img?: ImageSourcePropType;
  /** …текстовый мем: сам текст и цвет заливки. */
  text?: string;
  tint?: string;
  anim: StickerAnim;
  sound: StickerSound;
  rot: number;
}

export const PACKS = [
  { id: 'reactions' as const, title: 'Реакции', level: 1 },
  { id: 'mood' as const, title: 'Настроение', level: 1 },
  { id: 'memes' as const, title: 'Мемы', level: 1 },
];

 
const art = (id: string, label: string, pack: StickerPack, anim: StickerAnim, sound: StickerSound, img: ImageSourcePropType, level = 1, rot = 0): Sticker =>
  ({ id, label, pack, level, img, anim, sound, rot });
const meme = (id: string, text: string, tint: string, anim: StickerAnim, sound: StickerSound, level = 1, rot = -4): Sticker =>
  ({ id, label: text, pack: 'memes', level, text, tint, anim, sound, rot });

export const STICKERS: Sticker[] = [
  art('heart', 'Сердце', 'reactions', 'heartbeat', 'heart', require('../../assets/stickers/art/heart.png')),
  art('fire', 'Огонь', 'reactions', 'flicker', 'sizzle', require('../../assets/stickers/art/fire.png')),
  art('clap', 'Браво', 'reactions', 'clap', 'clap', require('../../assets/stickers/art/clap.png')),
  art('lol', 'Ору', 'reactions', 'laugh', 'laugh', require('../../assets/stickers/art/lol.png')),
  art('like', 'Класс', 'reactions', 'pop', 'chime', require('../../assets/stickers/art/like.png')),
  art('eyes', 'Глаза', 'reactions', 'look', 'pop', require('../../assets/stickers/art/eyes.png')),
  art('glove', 'Бокс', 'reactions', 'punch', 'punch', require('../../assets/stickers/art/glove.png')),
  art('eggplant', 'Баклажан', 'reactions', 'wobble', 'squeak', require('../../assets/stickers/art/eggplant.png')),
  art('popper', 'Праздник', 'mood', 'confetti', 'confetti', require('../../assets/stickers/art/popper.png')),
  art('skull', 'Я умер', 'mood', 'rattle', 'rattle', require('../../assets/stickers/art/skull.png')),
  art('rocket', 'Полетели', 'mood', 'launch', 'whoosh', require('../../assets/stickers/art/rocket.png')),
  art('coffee', 'Кофе?', 'mood', 'steam', 'pop', require('../../assets/stickers/art/coffee.png')),
  art('moon', 'Спать', 'mood', 'sway', 'snore', require('../../assets/stickers/art/moon.png'), 3),
  art('cool', 'Красавчик', 'mood', 'shine', 'chime', require('../../assets/stickers/art/cool.png'), 3),
  art('ghost', 'Бу!', 'mood', 'float', 'boing', require('../../assets/stickers/art/ghost.png'), 3),
  art('bear', 'Обнимаю', 'mood', 'hug', 'heart', require('../../assets/stickers/art/bear.png'), 3),
  meme('m67', '67', '#FFD23F', 'sixseven', 'boing', 1, -6),
  meme('mognu', 'МОГНУ', '#7FD1FF', 'slam', 'slam', 1, 4),
  meme('go', 'ГО?', '#FF8A5C', 'slam', 'slam', 1, -5),
  meme('lol-text', 'ЛОЛ', '#B79BFF', 'laugh', 'laugh', 1, 5),
  meme('imba', 'ИМБА', '#5DD39E', 'slam', 'slam', 3, -3),
  meme('baza', 'БАЗА', '#FF6FA0', 'slam', 'slam', 3, 4),
  meme('cringe', 'КРИНЖ', '#C9B48A', 'wobble', 'squeak', 3, -6),
  meme('wait', 'ЖДУ', '#9EE37D', 'sway', 'pop', 3, 3),
];
 

export const stickerUnlocked = (s: Pick<Sticker, 'level'>, level: number) => level >= s.level;

/** Стикер из сообщения по подписи. Старые стикеры (до 26 октября) показываем текстовым мемом с той же подписью. */
export function stickerByLabel(label: string): Sticker {
  return STICKERS.find((s) => s.label === label)
    ?? { id: `old-${label}`, label, pack: 'memes', level: 1, text: label.toUpperCase(), tint: '#FFE08A', anim: 'slam', sound: 'pop', rot: -3 };
}
