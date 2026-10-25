import { createAudioPlayer, type AudioPlayer } from 'expo-audio';
import * as Haptics from 'expo-haptics';
import type { Sticker } from './catalog';
const files = { punch: require('../../assets/stickers/punch.wav'), squeak: require('../../assets/stickers/squeak.wav'), heart: require('../../assets/stickers/heart.wav'), confetti: require('../../assets/stickers/confetti.wav') };
let player: AudioPlayer | null = null;
let cleanup: ReturnType<typeof setTimeout> | undefined;
/** Звук только по нажатию пользователя; одновременно звучит один стикер. */
export function playReaction(effect: Sticker['effect']) {
  if (!effect) return;
  void Haptics.selectionAsync().catch(() => undefined);
  playSound(effect);
}

/** Только звук (вибрацию в такт задаёт сама анимация — StickerBlast). */
export function playSound(effect: Sticker['effect']) {
  if (!effect) return;
  clearTimeout(cleanup);
  try {
    player?.remove();
    player = createAudioPlayer(files[effect]);
    player.volume = 0.45;
    player.play();
    cleanup = setTimeout(() => { player?.remove(); player = null; }, 3200);
  } catch { player = null; }
}
