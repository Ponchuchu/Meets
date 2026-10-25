// Образец всех значков карты (FIX5, docs/MAP-ICONS.md): для скриншотов и проверки на глаз. В приложении на неё не ведёт ни одна кнопка.
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import Svg, { Path, Rect } from 'react-native-svg';
import type { EventItem, FriendSpot, Person } from '../../data/types';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ATTRACTIONS } from '../../data/attractions';
import { demoEvents, FRIEND_SPOTS, PEOPLE } from '../../data/demo';
import { EventPin, FocusPin, FriendPin, TogetherPin } from '../../map/pins';
import { AttractionPin } from '../../map/ui/AttractionPin';
import { PlacePin } from '../../map/ui/PlacePin';
import { MallPin } from '../../map/ui/VenueSheet';
import { colors, fonts } from '../../theme';

const noop = () => undefined;

function Cell({ title, children, h = 110 }: { title: string; children: React.ReactNode; h?: number }) {
  return (
    <View style={styles.cell}>
      <View style={[styles.stage, { height: h }]}><View style={styles.point}>{children}</View></View>
      <Text style={styles.cap}>{title}</Text>
    </View>
  );
}


/** Нарисованная подложка района: кварталы, парк, река, проспекты — чтобы показать значки «на карте». */
function Ground({ h }: { h: number }) {
  return (
    <Svg width="100%" height={h} viewBox={`0 0 390 ${h}`} preserveAspectRatio="none" style={StyleSheet.absoluteFill}>
      <Rect x={0} y={0} width={390} height={h} fill="#E9E4D6" />
      <Path d={`M-10 ${h * 0.18} Q120 ${h * 0.12} 200 ${h * 0.3} T400 ${h * 0.42}`} stroke="#B9D3E3" strokeWidth={14} fill="none" />
      <Rect x={230} y={h * 0.55} width={130} height={h * 0.28} rx={18} fill="#CFE0C3" />
      <Rect x={22} y={h * 0.62} width={90} height={h * 0.2} rx={14} fill="#CFE0C3" />
      {[60, 150, 250, 330].map((x) => <Path key={`v${x}`} d={`M${x} 0 L${x + 12} ${h}`} stroke="#FFFFFF" strokeWidth={x === 150 ? 9 : 5} />)}
      {[0.25, 0.48, 0.7, 0.9].map((y) => <Path key={`h${y}`} d={`M0 ${h * y} L390 ${h * y - 14}`} stroke="#FFFFFF" strokeWidth={y === 0.48 ? 9 : 5} />)}
    </Svg>
  );
}

const PHOTOS = ['krug', 'hike', 'igor1', 'igor2', 'igor3', 'igor4', 'ainura', 'denis', 'anton', 'danil'];
/** Точки сцены: доля ширины/высоты, событие, обложка, время. */
const SPOTS: { x: number; y: number; id: string; cover?: string; time?: string; live?: boolean; kind?: 'plain' | 'labeled' | 'hot'; friend?: string; name?: string }[] = [
  { x: 0.16, y: 0.12, id: 'concert', cover: PHOTOS[0], time: 'идёт', live: true, kind: 'labeled' },
  { x: 0.42, y: 0.1, id: 'games', time: '20:00' },
  { x: 0.72, y: 0.16, id: 'food', cover: PHOTOS[1], time: '12:00' },
  { x: 0.88, y: 0.32, id: 'standup', time: '21:00' },
  { x: 0.3, y: 0.3, id: 'jazz', cover: PHOTOS[2], time: '19:30', kind: 'hot', friend: 'igor', name: 'Джаз во дворе' },
  { x: 0.6, y: 0.38, id: 'anime', cover: PHOTOS[3] },
  { x: 0.12, y: 0.45, id: 'bike', time: 'завтра 10:00' },
  { x: 0.45, y: 0.55, id: 'hike', cover: PHOTOS[4], time: 'завтра 08:00', name: 'Поход на Кок-Жайляу' },
  { x: 0.8, y: 0.6, id: 'games', cover: PHOTOS[5], time: '18:30' },
  { x: 0.24, y: 0.72, id: 'concert', time: '22:00' },
  { x: 0.6, y: 0.78, id: 'food', cover: PHOTOS[6], time: '19:00', friend: 'anton' },
  { x: 0.88, y: 0.86, id: 'standup', cover: PHOTOS[7], time: '20:30' },
  { x: 0.1, y: 0.9, id: 'jazz', time: '21:30' },
  { x: 0.4, y: 0.92, id: 'games' },
];

function Scene({ far, ev, person, spot }: { far?: boolean; ev: (id: string) => EventItem; person: (id: string) => Person; spot: (id: string) => FriendSpot }) {
  const h = far ? 300 : 560;
  return (
    <View style={[styles.scene, { height: h }]}>
      <Ground h={h} />
      {SPOTS.map((p, i) => (
        <View key={i} style={[styles.at, { left: `${p.x * 100}%`, top: p.y * h }]}>
          <EventPin e={{ ...ev(p.id), id: `${p.id}-${i}`, cover: p.cover ?? null }} kind={p.kind ?? 'plain'} phase={p.live ? 'live' : 'today'} showCompany={false} dark={false} onPress={noop}
            compact={far} time={far || !p.time ? null : { text: p.time, live: !!p.live }} friend={far || !p.friend ? undefined : person(p.friend)} name={far ? undefined : p.name} />
        </View>
      ))}
      {!far && <>
        <View style={[styles.at, { left: '70%', top: 0.5 * h }]}><FriendPin person={person('denis')} spot={spot('denis')} onPress={noop} /></View>
        <View style={[styles.at, { left: '20%', top: 0.6 * h }]}><FriendPin person={person('igor')} spot={spot('igor')} onPress={noop} /></View>
        <View style={[styles.at, { left: '76%', top: 0.28 * h }]}><FriendPin person={person('anton')} spot={spot('anton')} onPress={noop} /></View>
        <View style={[styles.at, { left: '52%', top: 0.24 * h }]}><EventPin e={{ ...ev('jazz'), cover: PHOTOS[8] }} kind="labeled" phase="today" showCompany={false} dark={false} onPress={noop} selected label="Вечеринка на крыше" when="сегодня, 22:00" friend={person('denis')} /></View>
      </>}
      {far && <>
        <View style={[styles.at, { left: '70%', top: 0.5 * h }]}><FriendPin person={person('denis')} spot={spot('denis')} onPress={noop} /></View>
        <View style={[styles.at, { left: '20%', top: 0.62 * h }]}><FriendPin person={person('igor')} spot={spot('igor')} onPress={noop} /></View>
      </>}
    </View>
  );
}

export default function PinsPreview() {
  const insets = useSafeAreaInsets();
  const ev = demoEvents();
  const e = (id: string) => ev.find((x) => x.id === id) ?? ev[0];
  const person = (id: string) => PEOPLE.find((p) => p.id === id) ?? PEOPLE[0];
  const spot = (id: string) => FRIEND_SPOTS.find((s) => s.personId === id) ?? FRIEND_SPOTS[0];
  const a = (id: string) => ATTRACTIONS.find((x) => x.id === id) ?? ATTRACTIONS[0];
  return (
    <ScrollView style={{ flex: 1, backgroundColor: '#E6E1D3' }} contentContainerStyle={{ paddingTop: insets.top + 12, paddingHorizontal: 12, paddingBottom: 40 }}>
      <Text style={styles.h}>Значки карты</Text>
      <Text style={styles.sec}>ПО ГОРОДУ — МНОГО СОБЫТИЙ</Text>
      <Scene ev={e} person={person} spot={spot} />
      <Text style={styles.sec}>ТОТ ЖЕ РАЙОН ИЗДАЛЕКА — ТОЧКИ</Text>
      <Scene far ev={e} person={person} spot={spot} />
      <Text style={styles.sec}>СОБЫТИЯ — МИНИ-АФИШИ</Text>
      <View style={styles.grid}>
        <Cell title="издалека — точка" h={70}><EventPin e={e('games')} kind="plain" phase="today" showCompany={false} dark={false} onPress={noop} compact /></Cell>
        <Cell title="обычное · время"><EventPin e={e('games')} kind="plain" phase="today" showCompany={false} dark={false} onPress={noop} time={{ text: '20:00', live: false }} /></Cell>
        <Cell title="идёт друг"><EventPin e={e('jazz')} kind="labeled" phase="soon" showCompany={false} dark={false} onPress={noop} friend={person('igor')} time={{ text: '19:30', live: false }} /></Cell>
        <Cell title="идёт сейчас"><EventPin e={{ ...e('concert'), cover: 'krug' }} kind="labeled" phase="live" showCompany={false} dark={false} onPress={noop} time={{ text: 'идёт', live: true }} /></Cell>
        <Cell title="своё / друзей сегодня"><EventPin e={e('concert')} kind="hot" phase="today" showCompany={false} dark={false} onPress={noop} /></Cell>
        <Cell title="вблизи — с названием"><View style={{ marginLeft: -60 }}><EventPin e={e('jazz')} kind="labeled" phase="today" showCompany={false} dark={false} onPress={noop} name="Джаз во дворе" /></View></Cell>
        <Cell title="несколько в одном месте"><EventPin e={e('food')} kind="plain" phase="today" showCompany={false} dark={false} onPress={noop} count={3} /></Cell>
      </View>
      <Cell title="выбранное — крупная афиша с подписью" h={170}><View style={{ marginTop: 40 }}><EventPin e={e('jazz')} kind="labeled" phase="today" showCompany={false} dark={false} onPress={noop} selected friend={person('igor')} label="Джаз во дворе" when="сегодня, 19:30" /></View></Cell>

      <Text style={styles.sec}>ДРУЗЬЯ — ЛИЦА С ХВОСТИКОМ</Text>
      <View style={styles.grid}>
        <Cell title="на месте · заряд" h={140}><View style={{ marginTop: 40 }}><FriendPin person={person('igor')} spot={spot('igor')} onPress={noop} /></View></Cell>
        <Cell title="едет · скорость" h={140}><View style={{ marginTop: 40 }}><FriendPin person={person('denis')} spot={spot('denis')} onPress={noop} /></View></Cell>
        <Cell title="давно не обновлялся" h={140}><View style={{ marginTop: 40 }}><FriendPin person={person('timur')} spot={spot('timur')} onPress={noop} /></View></Cell>
        <Cell title="заряжается" h={140}><View style={{ marginTop: 40 }}><FriendPin person={person('anton')} spot={spot('anton')} onPress={noop} /></View></Cell>
      </View>
      <View style={styles.grid}>
        <Cell title="друг в фокусе" h={170}><View style={{ marginTop: 60 }}><FocusPin person={person('igor')} ring={colors.friend} bubble={null} /></View></Cell>
        <Cell title="вместе" h={170}><TogetherPin people={[person('igor'), person('anton')]} onPress={noop} /></Cell>
      </View>

      <Text style={styles.sec}>МЕСТА — КРУГИ · МОИ — КАПЛИ · ТРЦ — ЗДАНИЕ</Text>
      <View style={styles.grid}>
        <Cell title="фото события"><EventPin e={{ ...e('hike'), cover: 'hike' }} kind="labeled" phase="today" showCompany={false} dark={false} onPress={noop} time={{ text: 'завтра 08:00', live: false }} /></Cell>
        <Cell title="парк"><AttractionPin a={a('terrenkur')} label={false} onPress={noop} /></Cell>
        <Cell title="горы, вблизи"><View style={{ marginLeft: -50 }}><AttractionPin a={a('shymbulak')} label onPress={noop} /></View></Cell>
        <Cell title="моё место"><View style={{ marginTop: 30 }}><PlacePin kind="home" title="Дом" label /></View></Cell>
        <Cell title="избранное"><View style={{ marginTop: 30 }}><PlacePin kind="fav" icon="coffee" title="Кофейня" label /></View></Cell>
        <Cell title="ТРЦ" h={120}><MallPin m={{ id: 'p', name: 'ЦУМ', address: '', hours: '', cover: null, lat: 0, lon: 0 }} onPress={noop} events={3} /></Cell>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  h: { fontFamily: fonts.display800, fontSize: 26, color: colors.ink, marginBottom: 6 },
  sec: { fontFamily: fonts.mono600, fontSize: 10.5, letterSpacing: 0.6, color: colors.muted, marginTop: 14, marginBottom: 6 },
  scene: { borderRadius: 22, overflow: 'hidden', marginHorizontal: -4 },
  at: { position: 'absolute', width: 0, height: 0, alignItems: 'center', justifyContent: 'center' },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  cell: { width: '31.8%', marginBottom: 4 },
  stage: { borderRadius: 16, backgroundColor: '#DDD8CB', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  point: { width: 0, height: 0, alignItems: 'center', justifyContent: 'center' },
  cap: { fontFamily: fonts.body500, fontSize: 11, color: colors.muted2, marginTop: 4, textAlign: 'center' },
});
