import { createAudioPlayer, type AudioPlayer } from 'expo-audio';
import * as Haptics from 'expo-haptics';
import type { StickerSound } from './catalog';
 
const files: Record<StickerSound, number> = {
  heart: require('../../assets/stickers/sfx/heart.wav'), punch: require('../../assets/stickers/sfx/punch.wav'), squeak: require('../../assets/stickers/sfx/squeak.wav'),
  confetti: require('../../assets/stickers/sfx/confetti.wav'), sizzle: require('../../assets/stickers/sfx/sizzle.wav'), clap: require('../../assets/stickers/sfx/clap.wav'),
  laugh: require('../../assets/stickers/sfx/laugh.wav'), rattle: require('../../assets/stickers/sfx/rattle.wav'), pop: require('../../assets/stickers/sfx/pop.wav'),
  whoosh: require('../../assets/stickers/sfx/whoosh.wav'), boing: require('../../assets/stickers/sfx/boing.wav'), chime: require('../../assets/stickers/sfx/chime.wav'),
  snore: require('../../assets/stickers/sfx/snore.wav'), slam: require('../../assets/stickers/sfx/slam.wav'),
};
 
let player: AudioPlayer | null = null;
let cleanup: ReturnType<typeof setTimeout> | undefined;

/** Звук и лёгкая вибрация по нажатию пользователя; одновременно звучит один стикер. */
export function playReaction(sound: StickerSound) {
  void Haptics.selectionAsync().catch(() => undefined);
  playSound(sound);
}

/** Только звук (вибрацию в такт задаёт сама анимация — StickerBlast). */
export function playSound(sound: StickerSound) {
  clearTimeout(cleanup);
  try {
    player?.remove();
    player = createAudioPlayer(files[sound]);
    player.volume = 0.45;
    player.play();
    cleanup = setTimeout(() => { player?.remove(); player = null; }, 3200);
  } catch { player = null; }
}
