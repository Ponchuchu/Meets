import { createAudioPlayer, type AudioPlayer } from 'expo-audio';
import * as Haptics from 'expo-haptics';
import type { StickerSound } from './catalog';
 
const files: Record<StickerSound, number> = {
  heart: require('../../assets/stickers/sfx/heart.mp3'), punch: require('../../assets/stickers/sfx/punch.mp3'), squeak: require('../../assets/stickers/sfx/squeak.mp3'),
  confetti: require('../../assets/stickers/sfx/confetti.mp3'), sizzle: require('../../assets/stickers/sfx/sizzle.mp3'), clap: require('../../assets/stickers/sfx/clap.mp3'),
  laugh: require('../../assets/stickers/sfx/laugh.mp3'), rattle: require('../../assets/stickers/sfx/rattle.mp3'), pop: require('../../assets/stickers/sfx/pop.mp3'),
  whoosh: require('../../assets/stickers/sfx/whoosh.mp3'), boing: require('../../assets/stickers/sfx/boing.mp3'), chime: require('../../assets/stickers/sfx/chime.mp3'),
  snore: require('../../assets/stickers/sfx/snore.mp3'), slam: require('../../assets/stickers/sfx/slam.mp3'),
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
