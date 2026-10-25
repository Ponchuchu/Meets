// Сообщения чата по DirectChat / EventChat: текст, фото, видео, кружок, голосовое, стикер, приглашение, опрос, системное.
import { memo, useEffect, useId, useState, type ReactNode } from 'react';
import { useAudioPlayer, useAudioPlayerStatus } from 'expo-audio';
import { useVideoPlayer, VideoView } from 'expo-video';
import { Image, Modal, Pressable, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import Animated, { Easing, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import Svg, { Circle } from 'react-native-svg';
import { photo } from '../../data/photos';
import type { Message, Person } from '../../data/types';
import { colors, fonts } from '../../theme';
import { Avatar } from '../../ui/Avatar';
import { Ic } from '../../ui/Ic';
import { stickerByLabel } from '../../stickers/catalog';
import { config } from '../../lib/config';
import { registerPlayback, usePlayback } from '../playback';
import { VideoPreview } from './VideoPreview';
import { InteractiveSticker } from '../../stickers/InteractiveSticker';
import { vote } from '../rules';
import { Tick, type TickKind } from './Tick';

const WAVE = [6, 10, 14, 9, 16, 12, 18, 8, 13, 17, 10, 6, 12, 15, 9, 11, 7, 13, 10, 6, 9, 5];
const PLAY = 'M8 5v14l11-7z';

function secs(d?: string): number {
  const m = /^(\d+):(\d+)$/.exec(d ?? '');
  return m ? Number(m[1]) * 60 + Number(m[2]) : 5;
}

const isFile = (u?: string | null) => !!u && /^(https?:|file:|blob:|content:)/.test(u);
const mmss = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;

/** Настоящее голосовое: файл из Storage (подписанная ссылка) или только что записанный. */
function VoiceFile({ m, mine }: { m: Message; mine: boolean }) {
  const playbackId = useId();
  const player = useAudioPlayer(m.media!);
  const st = useAudioPlayerStatus(player);
  useEffect(() => registerPlayback(playbackId, () => player.pause()), [playbackId, player]);
  const active = usePlayback(s => s.active === playbackId);
  useEffect(() => { if (active) player.play(); else player.pause(); }, [active, player]);
  const total = st.duration || secs(m.duration);
  const part = total ? Math.min(1, st.currentTime / total) : 0;
  const fg = mine ? colors.paper : colors.ink;
  const toggle = () => {
    if (active) { usePlayback.getState().play(null); return; }
    if (st.didJustFinish || part >= 0.99) void player.seekTo(0);
    usePlayback.getState().play(playbackId);
  };
  return (
    <View style={[styles.voice, mine ? styles.meBox : styles.themBox]}>
      <Pressable onPress={toggle} style={[styles.play, { backgroundColor: mine ? colors.paper : colors.ink }]} accessibilityRole="button" accessibilityLabel={st.playing ? 'Пауза' : `Голосовое, ${m.duration ?? mmss(total)}`}>
        <Ic d={st.playing ? 'M8 5h3v14H8zM13 5h3v14h-3z' : PLAY} size={16} color={mine ? colors.ink : colors.paper} fill={mine ? colors.ink : colors.paper} w={1} />
      </Pressable>
      <View style={{ flex: 1, gap: 6 }}>
        <View style={styles.wave}>
          {WAVE.map((h, i) => <View key={i} style={{ width: 3, height: h, borderRadius: 2, backgroundColor: fg, opacity: i / WAVE.length < part ? 1 : 0.35 }} />)}
        </View>
        <View style={styles.row}><Text style={[styles.meta, { color: mine ? '#BDB8AD' : colors.muted }]}>{st.playing ? mmss(st.currentTime) : m.duration ?? mmss(total)}</Text><Text style={[styles.meta, { color: mine ? '#BDB8AD' : colors.muted }]}>{m.time}</Text></View>
      </View>
    </View>
  );
}

function CirclePlayer({ uri, id }: { uri: string; id: string }) {
  const player = useVideoPlayer(uri, p => { p.loop = true; p.muted = false; p.play(); });
  useEffect(() => registerPlayback(id, () => player.pause()), [id, player]);
  return <VideoView player={player} style={StyleSheet.absoluteFill} contentFit="cover" surfaceType="textureView" nativeControls={false} />;
}

/** Текстурный слой Android обрезается кругом; декодер создаётся только после нажатия.
 *  Как в Telegram: нажал — кружок плавно вырастает почти на ширину экрана, пауза — возвращается. */
function CircleVideo({ m, blurred, onReveal }: { m: Message; blurred: boolean; onReveal: () => void }) {
  const playing = usePlayback(s => s.active === m.id);
  const { width } = useWindowDimensions();
  const big = Math.min(300, width - 64);
  const grow = useSharedValue(0);
  useEffect(() => { grow.set(withTiming(playing ? 1 : 0, { duration: 260, easing: Easing.bezier(0.2, 0.9, 0.3, 1) })); }, [playing, grow]);
  const box = useAnimatedStyle(() => { const d = 176 + (big - 176) * grow.get(); return { width: d, height: d }; });
  const inner = useAnimatedStyle(() => { const d = 166 + (big - 176) * grow.get(); return { width: d, height: d, borderRadius: d / 2 }; });
  const tap = () => { if (blurred) onReveal(); else usePlayback.getState().play(playing ? null : m.id, !playing); };
  return <Pressable onPress={tap} accessibilityRole="button" accessibilityLabel={`Кружок, ${m.duration ?? ''}. ${playing ? 'Пауза' : 'Воспроизвести'}`}>
    <Animated.View style={[styles.circleWrap, box]}>
      <Svg width="100%" height="100%" viewBox="0 0 176 176" style={StyleSheet.absoluteFill}><Circle cx={88} cy={88} r={86.5} stroke={playing ? colors.accent : colors.ink} strokeWidth={playing ? 2.4 : 3} fill="none" /></Svg>
      <Animated.View style={[{ overflow: 'hidden' }, inner]}>
        {blurred ? <View style={[StyleSheet.absoluteFill, { backgroundColor: colors.ink }]} /> : playing ? <CirclePlayer uri={m.media!} id={m.id} /> : <VideoPreview id={m.id} uri={m.media!} />}
      </Animated.View>
      <View style={[styles.pill, { left: 10 }]}><Text style={styles.durText}>{m.duration ?? ''}</Text></View>
      <View style={[styles.pill, { right: 10 }]}><Text style={styles.durText}>{m.time}</Text></View>
    </Animated.View>
  </Pressable>;
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

function VideoFile({uri}:{uri:string}) {
  const player=useVideoPlayer(uri);
  useEffect(() => { const id = `video:${uri}`; usePlayback.getState().play(id, true); const unregister = registerPlayback(id, () => player.pause()); return () => { unregister(); if (usePlayback.getState().active === id) usePlayback.getState().play(null); }; }, [uri, player]);
  return <VideoView player={player} style={{width:'100%',height:250}} contentFit="contain" surfaceType="textureView" nativeControls fullscreenOptions={{enable:true}}/>;
}
function MediaBubble({m,mine,blurred,onReveal}:{m:Message;mine:boolean;blurred:boolean;onReveal:()=>void}) {
  const [ratio,setRatio]=useState(1);
  const [open,setOpen]=useState(false);
  useEffect(() => {
    let active = true;
    const source = photo(m.media);
    if (!source) return;
    const asset = typeof Image.resolveAssetSource === 'function' ? Image.resolveAssetSource(source) : Array.isArray(source) ? source[0] : typeof source === 'object' ? source : null;
    if (asset?.uri) Image.getSize(asset.uri, (w,h) => { if (active && w && h) setRatio(w/h); }, () => undefined);
    return () => { active = false; };
  }, [m.media]);
  return <>
    <Pressable onPress={() => { if (usePlayback.getState().recording) return; if (blurred) onReveal(); else setOpen(true); }} style={[styles.media,mine?styles.meBox:styles.themBox]} accessibilityRole="button" accessibilityLabel={blurred?'Показать медиа':'Открыть медиа'}>
      {m.kind==='video' && isFile(m.media) && !blurred ? <View style={{ height: 180, width: '100%' }}><VideoPreview id={m.id} uri={m.media!}/></View> : <View style={{aspectRatio:Math.max(0.55,Math.min(2,ratio)),width:'100%'}}>
        <Image source={photo(m.media)} style={{width:'100%',height:'100%'}} resizeMode="contain" blurRadius={blurred?30:0} onLoad={e=>{const {width,height}=e.nativeEvent.source ?? {};if(width&&height)setRatio(width/height);}}/>
        {blurred&&<View style={styles.blur}><Text style={styles.blurText}>Нажми, чтобы показать</Text></View>}
        {!m.text&&<View style={[styles.pill,{bottom:8,right:8}]}><Text style={styles.durText}>{m.time}</Text></View>}
      </View>}
      {!!m.text&&<View style={styles.caption}><Text style={[styles.text,{flex:1},mine&&{color:colors.paper}]}>{m.text}</Text><Text style={[styles.time,mine&&{color:'#BDB8AD'}]}>{m.time}</Text></View>}
    </Pressable>
    <Modal visible={open} transparent animationType="fade" onRequestClose={()=>setOpen(false)}>
      <View style={{flex:1,backgroundColor:'rgba(23,22,26,0.96)',padding:16,justifyContent:'center'}}>
        <Pressable style={{position:'absolute',right:20,top:55,zIndex:1,padding:12}} onPress={()=>setOpen(false)} accessibilityLabel="Закрыть медиа"><Text style={{color:colors.paper,fontSize:28}}>×</Text></Pressable>
        {m.kind==='video' && isFile(m.media)?<VideoFile uri={m.media!}/>:<Image source={photo(m.media)} style={{width:'100%',height:'80%'}} resizeMode="contain"/>}
      </View>
    </Modal>
  </>;
}

export const Bubble = memo(function Bubble({ m, author, mine, friendChat, showAuthor, revealed, onReveal, onInvite, voteState, onVote, onOpenEvent, onAvatar, tick }: {
  m: Message; author?: Person; mine: boolean; friendChat: boolean; showAuthor?: boolean; tick?: TickKind;
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

  if (!m.media && config.dataMode !== 'demo' && ['voice', 'circle', 'photo', 'video'].includes(m.kind)) return wrap(<View style={styles.themBox}><Text style={[styles.text, { padding: 14 }]}>Вложение не загрузилось. Обнови чат</Text></View>);
  switch (m.kind) {
    case 'system':
      return <View style={styles.system}><Text style={styles.systemText}>{m.text}</Text></View>;
    case 'text':
      return wrap(
        <View style={[styles.bubble, mine ? styles.me : styles.them]}>
          {authorLine}
          <Text style={[styles.text, mine && { color: colors.paper }]}>{m.text}</Text>
          <View style={styles.timeRow}>
            <Text style={[styles.time, mine && { color: '#BDB8AD' }]}>{m.editedAt ? `изменено ${m.time}` : m.time}</Text>
            {mine && tick && <Tick kind={tick} />}
          </View>
        </View>,
      );
    case 'voice':
      return wrap(isFile(m.media) ? <VoiceFile m={m} mine={mine} /> : <Voice m={m} mine={mine} />);
    case 'sticker': {
      const st = stickerByLabel(m.text);
      return (
        <View style={{ alignItems: align }}>
          <InteractiveSticker st={st} />
        </View>
      );
    }
    case 'photo':
    case 'video':
      return wrap(<MediaBubble m={m} mine={mine} blurred={blurred} onReveal={onReveal}/>);
    case 'circle':
      if (isFile(m.media)) return <View style={{ alignItems: align }}><CircleVideo m={m} blurred={blurred} onReveal={onReveal} /></View>;
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
              <Text style={styles.sub}>{m.sub ?? (mine ? 'Ты пригласил · нажми, чтобы открыть' : 'Приглашает тебя · нажми, чтобы открыть')}</Text>
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
});

/** Входящие сообщения — светлые, почти белые, с мягкой тенью вместо серой рамки (FIX5). */
const BUBBLE_IN = '#FBFAF6';

const styles = StyleSheet.create({
  line: { flexDirection: 'row', alignItems: 'flex-end', gap: 8 },
  bubble: { maxWidth: '80%', paddingTop: 9, paddingHorizontal: 14, paddingBottom: 7, borderRadius: 22, gap: 3 },
  me: { backgroundColor: colors.ink, borderBottomRightRadius: 7, boxShadow: '0 2px 6px -2px rgba(23,22,26,0.35)' },
  them: { backgroundColor: BUBBLE_IN, borderBottomLeftRadius: 7, boxShadow: '0 1px 2px rgba(23,22,26,0.08), 0 3px 10px -6px rgba(23,22,26,0.18)' },
  meBox: { backgroundColor: colors.ink, boxShadow: '0 2px 6px -2px rgba(23,22,26,0.35)' },
  themBox: { backgroundColor: BUBBLE_IN, boxShadow: '0 1px 2px rgba(23,22,26,0.08), 0 3px 10px -6px rgba(23,22,26,0.18)' },
  author: { fontFamily: fonts.body700, fontSize: 13 },
  text: { fontFamily: fonts.body400, fontSize: 15.5, lineHeight: 21.5, color: colors.ink },
  timeRow: { alignSelf: 'flex-end', flexDirection: 'row', alignItems: 'center', gap: 4 },
  time: { alignSelf: 'flex-end', fontFamily: fonts.mono500, fontSize: 10, color: colors.muted },
  voice: { width: 268, flexDirection: 'row', alignItems: 'center', gap: 10, padding: 10, paddingRight: 14, borderRadius: 24 },
  play: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  wave: { flexDirection: 'row', alignItems: 'center', gap: 3, height: 20 },
  waveCover: { position: 'absolute', left: 0, top: 0, bottom: 0, backgroundColor: 'rgba(240,82,31,0.35)', borderRadius: 3 },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  meta: { fontFamily: fonts.mono500, fontSize: 10 },
  sticker: { height: 48, paddingHorizontal: 18, borderRadius: 14, borderWidth: 3, borderColor: '#FFFFFF', justifyContent: 'center', shadowColor: colors.ink, shadowOpacity: 0.2, shadowRadius: 6, shadowOffset: { width: 0, height: 4 }, elevation: 4 },
  stickerText: { fontFamily: fonts.display800, fontSize: 18 },
  cap: { fontFamily: fonts.mono600, fontSize: 10, letterSpacing: 0.5, color: colors.muted },
  media: { width: 264, maxWidth: '82%', borderRadius: 22, overflow: 'hidden', backgroundColor: BUBBLE_IN, boxShadow: '0 1px 2px rgba(23,22,26,0.1), 0 4px 12px -6px rgba(23,22,26,0.25)' },
  fill: { position: 'absolute', left: 0, top: 0, width: '100%', height: '100%' },
  videoDark: { position: 'absolute', left: 0, top: 0, right: 0, bottom: 0, backgroundColor: colors.ink, opacity: 0.92 },
  videoBig: { position: 'absolute', left: 14, bottom: 12, fontFamily: fonts.display800, fontSize: 24, lineHeight: 22, color: '#55524C' },
  dur: { position: 'absolute', right: 10, top: 10, flexDirection: 'row', alignItems: 'center', gap: 4 },
  durText: { fontFamily: fonts.mono600, fontSize: 10.5, color: '#FFFFFF' },
  bigPlay: { position: 'absolute', left: '50%', top: '50%', marginLeft: -24, marginTop: -24, width: 48, height: 48, borderRadius: 24, backgroundColor: colors.card, alignItems: 'center', justifyContent: 'center' },
  blur: { position: 'absolute', left: 0, top: 0, right: 0, bottom: 0, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(23,22,26,0.3)' },
  blurText: { fontFamily: fonts.body600, fontSize: 13, color: '#FFFFFF', backgroundColor: 'rgba(23,22,26,0.6)', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 10, overflow: 'hidden' },
  caption: { flexDirection: 'row', alignItems: 'flex-end', gap: 8, paddingHorizontal: 14, paddingVertical: 9 },
  circleWrap: { width: 176, height: 176, alignItems: 'center', justifyContent: 'center' },
  circle: { width: 166, height: 166, borderRadius: 83 },
  pill: { position: 'absolute', bottom: 10, paddingHorizontal: 7, paddingVertical: 3, borderRadius: 10, backgroundColor: 'rgba(23,22,26,0.7)' },
  invite: { width: 264, borderRadius: 22, overflow: 'hidden', backgroundColor: BUBBLE_IN, boxShadow: '0 1px 2px rgba(23,22,26,0.1), 0 6px 16px -8px rgba(23,22,26,0.3)' },
  inviteHead: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 14, paddingVertical: 10, backgroundColor: colors.accent },
  inviteCap: { fontFamily: fonts.mono600, fontSize: 10.5, letterSpacing: 0.5, color: colors.ink },
  inviteTitle: { fontFamily: fonts.display700, fontSize: 18, color: colors.ink },
  sub: { fontFamily: fonts.body400, fontSize: 13, color: colors.muted },
  answer: { flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'flex-start', marginTop: 8, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 12, backgroundColor: colors.softGreen },
  answerText: { fontFamily: fonts.body600, fontSize: 13, color: colors.ink },
  invBtn: { flex: 1, height: 38, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  invBtnText: { fontFamily: fonts.body600, fontSize: 13, color: colors.ink },
  poll: { width: 300, padding: 14, gap: 8, borderRadius: 22, backgroundColor: BUBBLE_IN, boxShadow: '0 1px 2px rgba(23,22,26,0.1), 0 6px 16px -8px rgba(23,22,26,0.3)' },
  pollQ: { fontFamily: fonts.display700, fontSize: 16, color: colors.ink },
  opt: { height: 42, borderRadius: 14, backgroundColor: colors.card, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, overflow: 'hidden' },
  optFill: { position: 'absolute', left: 0, top: 0, bottom: 0, backgroundColor: colors.sand },
  optText: { flex: 1, fontFamily: fonts.body500, fontSize: 14, color: colors.ink },
  optN: { fontFamily: fonts.mono600, fontSize: 12, color: colors.ink },
  system: { alignSelf: 'center', paddingHorizontal: 12, paddingVertical: 5, borderRadius: 12, backgroundColor: 'rgba(23,22,26,0.07)' },
  systemText: { fontFamily: fonts.mono600, fontSize: 10, letterSpacing: 0.5, color: colors.muted },
});
