import { createAudioPlayer, type AudioPlayer } from 'expo-audio';
import * as Haptics from 'expo-haptics';
import type { StickerSound } from './catalog';
 
const files: Record<StickerSound, number> = {
  heart: require('../../assets/stickers/sfx/heart.mp3'), punch: require('../../assets/stickers/sfx/punch.mp3'), squeak: require('../../assets/stickers/sfx/squeak.mp3'),
  confetti: require('../../assets/stickers/sfx/confetti.mp3'), sizzle: require('../../assets/stickers/sfx/sizzle.mp3'), clap: require('../../assets/stickers/sfx/clap.mp3'),
  laugh: require('../../assets/stickers/sfx/laugh.mp3'), rattle: require('../../assets/stickers/sfx/rattle.mp3'), pop: require('../../assets/stickers/sfx/pop.mp3'),
  whoosh: require('../../assets/stickers/sfx/whoosh.mp3'), boing: require('../../assets/stickers/sfx/boing.mp3'), chime: require('../../assets/stickers/sfx/chime.mp3'),
  snore: require('../../assets/stickers/sfx/snore.mp3'), slam: require('../../assets/stickers/sfx/slam.mp3'), mognu: require('../../assets/stickers/sfx/mognu.wav'), sixseven: require('../../assets/stickers/sfx/sixseven.wav'), letsgo: require('../../assets/stickers/sfx/letsgo.wav'),
};
 
const players = new Map<StickerSound, AudioPlayer>();
let current: AudioPlayer | null = null;
let sequence = 0;
let cleanup: ReturnType<typeof setTimeout> | undefined;

function releasePlayers() {
  sequence++;
  for (const p of players.values()) p.remove();
  players.clear();
  current = null;
}

/** Звук и лёгкая вибрация по нажатию пользователя; одновременно звучит один стикер. */
export function playReaction(sound: StickerSound) {
  void Haptics.selectionAsync().catch(() => undefined);
  playSound(sound);
}

/** Только звук (вибрацию в такт задаёт сама анимация — StickerBlast). */
export function playSound(sound: StickerSound) {
  clearTimeout(cleanup);
  try {
    const turn = ++sequence;
    current?.pause();
    let player = players.get(sound);
    const cached = !!player;
    if (!player) {
      if (players.size >= 3) {
        const oldest = players.keys().next().value as StickerSound;
        players.get(oldest)?.remove();
        players.delete(oldest);
      }
      player = createAudioPlayer(files[sound]);
      player.volume = 0.45;
    } else players.delete(sound);
    players.set(sound, player);
    current = player;
    if (cached) {
      const selected = player;
      void selected.seekTo(0).then(() => { if (sequence === turn) selected.play(); }).catch(() => undefined);
    } else player.play();
    cleanup = setTimeout(releasePlayers, 30000);
  } catch { releasePlayers(); }
}
