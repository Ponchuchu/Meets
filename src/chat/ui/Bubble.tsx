// Сообщения чата по DirectChat / EventChat: текст, фото, видео, кружок, голосовое, стикер, приглашение, опрос, системное.
import { useEffect, useState, type ReactNode } from 'react';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, { Easing, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import Svg, { Circle } from 'react-native-svg';
import { photo } from '../../data/photos';
import type { Message, Person } from '../../data/types';
import { colors, fonts } from '../../theme';
import { Avatar } from '../../ui/Avatar';
import { Ic } from '../../ui/Ic';
import { STICKERS } from '../../map/ui/FriendCard';
import { vote } from '../rules';

const WAVE = [6, 10, 14, 9, 16, 12, 18, 8, 13, 17, 10, 6, 12, 15, 9, 11, 7, 13, 10, 6, 9, 5];
const PLAY = 'M8 5v14l11-7z';

function secs(d?: string): number {
  const m = /^(\d+):(\d+)$/.exec(d ?? '');
  return m ? Number(m[1]) * 60 + Number(m[2]) : 5;
}

function Voice({ m, mine }: { m: Message; mine: boolean }) {
  const [playing, setPlaying] = useState(false);
  const p = useSharedValue(0);
  useEffect(() => {
    if (!playing) return;
    p.set(0);
    p.set(withTiming(1, { duration: secs(m.duration) * 1000, easing: Easing.linear }));
    const t = setTimeout(() => setPlaying(false), secs(m.duration) * 1000);
    return () => clearTimeout(t);
  }, [playing, m.duration, p]);
  const bar = useAnimatedStyle(() => ({ width: `${p.value * 100}%` }));
  const fg = mine ? colors.paper : colors.ink;
  return (
    <View style={[styles.voice, mine ? styles.meBox : styles.themBox]}>
      <Pressable onPress={() => setPlaying(!playing)} style={[styles.play, { backgroundColor: mine ? colors.paper : colors.ink }]} accessibilityRole="button" accessibilityLabel={playing ? 'Пауза' : `Голосовое, ${m.duration}`}>
        <Ic d={playing ? 'M8 5h3v14H8zM13 5h3v14h-3z' : PLAY} size={16} color={mine ? colors.ink : colors.paper} fill={mine ? colors.ink : colors.paper} w={1} />
      </Pressable>
      <View style={{ flex: 1, gap: 6 }}>
        <View style={styles.wave}>
          {WAVE.map((h, i) => <View key={i} style={{ width: 3, height: h, borderRadius: 2, backgroundColor: fg, opacity: i < 8 ? 1 : 0.35 }} />)}
          <Animated.View pointerEvents="none" style={[styles.waveCover, bar]} />
        </View>
        <View style={styles.row}><Text style={[styles.meta, { color: mine ? '#BDB8AD' : colors.muted }]}>{m.duration}</Text><Text style={[styles.meta, { color: mine ? '#BDB8AD' : colors.muted }]}>{m.time}</Text></View>
      </View>
    </View>
  );
}

export function Bubble({ m, author, mine, friendChat, showAuthor, revealed, onReveal, onInvite, voteState, onVote, onOpenEvent, onAvatar }: {
  m: Message; author?: Person; mine: boolean; friendChat: boolean; showAuthor?: boolean;
  revealed: boolean; onReveal: () => void;
  onInvite?: (a: 'yes' | 'no') => void; voteState?: number; onVote?: (i: number) => void; onOpenEvent?: () => void; onAvatar?: () => void;
}) {
  const align = mine ? 'flex-end' : 'flex-start';
  const blurred = !mine && !friendChat && !revealed && (m.kind === 'photo' || m.kind === 'video' || m.kind === 'circle');
  const wrap = (child: ReactNode) => (
    <View style={[styles.line, { justifyContent: align }]}>
      {showAuthor && !mine && (author ? <Pressable onPress={onAvatar} accessibilityRole="button" accessibilityLabel={author.name}><Avatar p={author} size={30} /></Pressable> : <View style={{ width: 30 }} />)}
      {child}
    </View>
  );
  const authorLine = showAuthor && !mine && author ? <Text style={[styles.author, { color: author.isFriend ? colors.accentText : colors.friend }]}>{author.name}</Text> : null;

  switch (m.kind) {
    case 'system':
      return <View style={styles.system}><Text style={styles.systemText}>{m.text}</Text></View>;
    case 'text':
      return wrap(
        <View style={[styles.bubble, mine ? styles.me : styles.them]}>
          {authorLine}
          <Text style={[styles.text, mine && { color: colors.paper }]}>{m.text}</Text>
          <Text style={[styles.time, mine && { color: '#BDB8AD' }]}>{m.time}</Text>
        </View>,
      );
    case 'voice':
      return wrap(<Voice m={m} mine={mine} />);
    case 'sticker': {
      const st = STICKERS.find((x) => x.label === m.text) ?? STICKERS[0];
      return (
        <View style={{ alignItems: align, gap: 6 }}>
          {st.look === 'big'
            ? <Text style={{ fontSize: 64, lineHeight: 76, transform: [{ rotate: `${st.rot}deg` }] }}>{m.text}</Text>
            : <View style={[styles.sticker, { backgroundColor: st.bg, transform: [{ rotate: `${st.rot}deg` }] }, st.look === 'outline' && { borderColor: st.fg }]}><Text style={[styles.stickerText, { color: st.fg }]}>{m.text}</Text></View>}
          <Text style={styles.cap}>СТИКЕР С КАРТЫ · {m.time}</Text>
        </View>
      );
    }
    case 'photo':
    case 'video':
      return wrap(
        <Pressable onPress={blurred ? onReveal : undefined} style={[styles.media, mine ? styles.meBox : styles.themBox]} accessibilityRole={blurred ? 'button' : undefined} accessibilityLabel={blurred ? 'Показать фото' : undefined}>
          <View style={{ height: m.kind === 'video' ? 150 : 170, backgroundColor: colors.ink }}>
            {m.media && <Image source={photo(m.media)} style={styles.fill} blurRadius={blurred ? 30 : 0} resizeMode="cover" />}
            {m.kind === 'video' && !blurred && (
              <>
                <View style={styles.videoDark} />
                <Text style={styles.videoBig}>ОТКРЫТЫЙ{'\n'}МИКРОФОН</Text>
                <View style={styles.dur}><Ic d="M3 7h12v10H3zM15 10l6-3v10l-6-3z" size={11} color="#FFFFFF" w={2} /><Text style={styles.durText}>{m.duration}</Text></View>
                <View style={styles.bigPlay}><Ic d={PLAY} size={20} color={colors.ink} fill={colors.ink} w={1} /></View>
              </>
            )}
            {blurred && <View style={styles.blur}><Text style={styles.blurText}>Нажми, чтобы показать</Text></View>}
          </View>
          <View style={styles.caption}>
            <Text style={[styles.text, { flex: 1 }, mine && { color: colors.paper }]}>{m.text}</Text>
            <Text style={[styles.time, mine && { color: '#BDB8AD' }]}>{m.time}</Text>
          </View>
        </Pressable>,
      );
    case 'circle':
      return (
        <View style={{ alignItems: align }}>
          <Pressable onPress={blurred ? onReveal : undefined} style={styles.circleWrap} accessibilityLabel="Кружок, 7 секунд">
            <Svg width={176} height={176} style={StyleSheet.absoluteFill}>
              <Circle cx={88} cy={88} r={86} stroke={colors.ink} strokeWidth={3} fill="none" />
              <Circle cx={88} cy={88} r={86} stroke={colors.accent} strokeWidth={3} fill="none" strokeDasharray={`${2 * Math.PI * 86 * 0.3} 999`} rotation={-90} origin="88, 88" />
            </Svg>
            <Image source={photo(m.media ?? 'krug')} style={styles.circle} blurRadius={blurred ? 30 : 0} />
            <View style={[styles.pill, { left: 10 }]}><Text style={styles.durText}>{m.duration ?? '0:07'}</Text></View>
            <View style={[styles.pill, { right: 10 }]}><Text style={styles.durText}>{m.time}</Text></View>
          </Pressable>
        </View>
      );
    case 'invite':
      return (
        <View style={{ alignItems: align }}>
          <View style={styles.invite}>
            <View style={styles.inviteHead}><Ic d="M9 18V5l11-2v13M6 21a3 3 0 100-6 3 3 0 000 6zM17 19a3 3 0 100-6 3 3 0 000 6z" size={16} color={colors.ink} w={2} /><Text style={styles.inviteCap}>ПРИГЛАШЕНИЕ</Text></View>
            <Pressable onPress={onOpenEvent} style={{ padding: 14, gap: 4 }} accessibilityRole="button">
              <Text style={styles.inviteTitle}>{m.text}</Text>
              <Text style={styles.sub}>{m.sub}</Text>
              {m.answer && <View style={styles.answer}><Ic d="M5 12l5 5 9-10" size={14} color={colors.ok} w={2.4} /><Text style={styles.answerText}>{m.answer}</Text></View>}
              {!m.answer && onInvite && (
                <View style={{ flexDirection: 'row', gap: 8, marginTop: 8 }}>
                  <Pressable onPress={() => onInvite('yes')} style={[styles.invBtn, { backgroundColor: colors.ink }]} accessibilityRole="button"><Text style={[styles.invBtnText, { color: colors.paper }]}>Иду</Text></Pressable>
                  <Pressable onPress={() => onInvite('no')} style={[styles.invBtn, { borderWidth: 1.5, borderColor: colors.ink }]} accessibilityRole="button"><Text style={styles.invBtnText}>Не смогу</Text></Pressable>
                </View>
              )}
            </Pressable>
          </View>
        </View>
      );
    case 'poll': {
      const res = m.poll ? (voteState != null ? vote(m.poll.options, null, voteState) : { options: m.poll.options, mine: null, total: m.poll.options.reduce((a, b) => a + b.votes, 0) }) : null;
      if (!res || !m.poll) return null;
      const max = Math.max(...res.options.map((o) => o.votes));
      return wrap(
        <View style={styles.poll}>
          <View style={styles.row}><Text style={styles.pollQ}>{m.poll.question}</Text><Text style={styles.cap}>ОПРОС · {res.total} ГОЛОСОВ</Text></View>
          {res.options.map((o, i) => {
            const on = voteState === i || (voteState == null && o.votes === max && false);
            return (
              <Pressable key={o.text} onPress={() => onVote?.(i)} style={[styles.opt, (on || (voteState == null && i === 0)) && { borderColor: colors.ink, borderWidth: 1.5 }]} accessibilityRole="radio" accessibilityState={{ selected: on }}>
                <View style={[styles.optFill, { width: `${(o.votes / Math.max(1, max)) * 70}%` }]} />
                <Text style={[styles.optText, on && { fontFamily: fonts.body700 }]}>{o.text}</Text>
                <Text style={styles.optN}>{o.votes}</Text>
              </Pressable>
            );
          })}
        </View>,
      );
    }
    default:
      return null;
  }
}

const styles = StyleSheet.create({
  line: { flexDirection: 'row', alignItems: 'flex-end', gap: 8 },
  bubble: { maxWidth: '80%', paddingTop: 10, paddingHorizontal: 12, paddingBottom: 8, borderRadius: 18, gap: 4 },
  me: { backgroundColor: colors.ink, borderBottomRightRadius: 6 },
  them: { backgroundColor: colors.card, borderWidth: 1, borderColor: colors.line, borderBottomLeftRadius: 6 },
  meBox: { backgroundColor: colors.ink },
  themBox: { backgroundColor: colors.card, borderWidth: 1, borderColor: colors.line },
  author: { fontFamily: fonts.body700, fontSize: 13 },
  text: { fontFamily: fonts.body400, fontSize: 15, lineHeight: 21, color: colors.ink },
  time: { alignSelf: 'flex-end', fontFamily: fonts.mono500, fontSize: 10, color: colors.muted },
  voice: { width: 276, flexDirection: 'row', alignItems: 'center', gap: 10, padding: 12, borderRadius: 18 },
  play: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  wave: { flexDirection: 'row', alignItems: 'center', gap: 3, height: 20 },
  waveCover: { position: 'absolute', left: 0, top: 0, bottom: 0, backgroundColor: 'rgba(240,82,31,0.35)', borderRadius: 3 },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  meta: { fontFamily: fonts.mono500, fontSize: 10 },
  sticker: { height: 48, paddingHorizontal: 18, borderRadius: 14, borderWidth: 3, borderColor: '#FFFFFF', justifyContent: 'center', shadowColor: colors.ink, shadowOpacity: 0.2, shadowRadius: 6, shadowOffset: { width: 0, height: 4 }, elevation: 4 },
  stickerText: { fontFamily: fonts.display800, fontSize: 18 },
  cap: { fontFamily: fonts.mono600, fontSize: 10, letterSpacing: 0.5, color: colors.muted },
  media: { width: 238, borderRadius: 18, overflow: 'hidden' },
  fill: { position: 'absolute', left: 0, top: 0, width: '100%', height: '100%' },
  videoDark: { position: 'absolute', left: 0, top: 0, right: 0, bottom: 0, backgroundColor: colors.ink, opacity: 0.92 },
  videoBig: { position: 'absolute', left: 14, bottom: 12, fontFamily: fonts.display800, fontSize: 24, lineHeight: 22, color: '#55524C' },
  dur: { position: 'absolute', right: 10, top: 10, flexDirection: 'row', alignItems: 'center', gap: 4 },
  durText: { fontFamily: fonts.mono600, fontSize: 10.5, color: '#FFFFFF' },
  bigPlay: { position: 'absolute', left: '50%', top: '50%', marginLeft: -24, marginTop: -24, width: 48, height: 48, borderRadius: 24, backgroundColor: colors.card, alignItems: 'center', justifyContent: 'center' },
  blur: { position: 'absolute', left: 0, top: 0, right: 0, bottom: 0, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(23,22,26,0.3)' },
  blurText: { fontFamily: fonts.body600, fontSize: 13, color: '#FFFFFF', backgroundColor: 'rgba(23,22,26,0.6)', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 10, overflow: 'hidden' },
  caption: { flexDirection: 'row', alignItems: 'flex-end', gap: 8, padding: 12 },
  circleWrap: { width: 176, height: 176, alignItems: 'center', justifyContent: 'center' },
  circle: { width: 166, height: 166, borderRadius: 83 },
  pill: { position: 'absolute', bottom: 10, paddingHorizontal: 7, paddingVertical: 3, borderRadius: 10, backgroundColor: 'rgba(23,22,26,0.7)' },
  invite: { width: 264, borderRadius: 18, overflow: 'hidden', backgroundColor: colors.card, borderWidth: 1, borderColor: colors.line },
  inviteHead: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 14, paddingVertical: 10, backgroundColor: colors.accent },
  inviteCap: { fontFamily: fonts.mono600, fontSize: 10.5, letterSpacing: 0.5, color: colors.ink },
  inviteTitle: { fontFamily: fonts.display700, fontSize: 18, color: colors.ink },
  sub: { fontFamily: fonts.body400, fontSize: 13, color: colors.muted },
  answer: { flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'flex-start', marginTop: 8, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 12, backgroundColor: colors.softGreen },
  answerText: { fontFamily: fonts.body600, fontSize: 13, color: colors.ink },
  invBtn: { flex: 1, height: 38, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  invBtnText: { fontFamily: fonts.body600, fontSize: 13, color: colors.ink },
  poll: { width: 306, padding: 14, gap: 8, borderRadius: 18, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.line },
  pollQ: { fontFamily: fonts.display700, fontSize: 16, color: colors.ink },
  opt: { height: 40, borderRadius: 12, borderWidth: 1, borderColor: colors.line, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, overflow: 'hidden' },
  optFill: { position: 'absolute', left: 0, top: 0, bottom: 0, backgroundColor: colors.sand },
  optText: { flex: 1, fontFamily: fonts.body500, fontSize: 14, color: colors.ink },
  optN: { fontFamily: fonts.mono600, fontSize: 12, color: colors.ink },
  system: { alignSelf: 'center', paddingHorizontal: 12, paddingVertical: 5, borderRadius: 12, backgroundColor: colors.sand },
  systemText: { fontFamily: fonts.mono600, fontSize: 10, letterSpacing: 0.5, color: colors.muted },
});
