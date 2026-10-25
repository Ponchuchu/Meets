// Образец всех значков карты (FIX5, docs/MAP-ICONS.md): для скриншотов и проверки на глаз. В приложении на неё не ведёт ни одна кнопка.
import { Image, ScrollView, StyleSheet, Text, View } from 'react-native';
import Svg, { Path, Rect } from 'react-native-svg';
import type { EventItem, FriendSpot, Person } from '../../data/types';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ATTRACTIONS } from '../../data/attractions';
import { demoEvents, FRIEND_SPOTS, PEOPLE } from '../../data/demo';
import { EventPin, FocusPin, FriendPin, TogetherPin } from '../../map/pins';
import { PlacePin } from '../../map/ui/PlacePin';
import { SPRITES, type SpriteName } from '../../map/sprites';
import { eventSprite, SymbolPin, type MapSymbol } from '../../map/symbols';
import { CAT_COLOR } from '../../map/icons';
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

/** Точки сцены: доля ширины/высоты, событие или готовый значок, подпись. */
const SPOTS: { x: number; y: number; id?: string; icon?: SpriteName; text?: string; size?: number }[] = [
  { x: 0.16, y: 0.14, icon: 'ev-jazz', size: 50 }, { x: 0.42, y: 0.12, id: 'games' }, { x: 0.72, y: 0.18, icon: 'ev-burger' },
  { x: 0.9, y: 0.34, id: 'standup' }, { x: 0.3, y: 0.33, icon: 'ev-party', size: 54 }, { x: 0.12, y: 0.47, icon: 'ev-basket' },
  { x: 0.45, y: 0.58, icon: 'pl-charyn' }, { x: 0.84, y: 0.62, icon: 'mall-dome', size: 58 },
  { x: 0.24, y: 0.75, icon: 'pl-skate', size: 50 }, { x: 0.6, y: 0.8, icon: 'ev-movie' }, { x: 0.9, y: 0.9, icon: 'mall-stripes', size: 58 },
  { x: 0.1, y: 0.93, icon: 'ev-tech' }, { x: 0.42, y: 0.95, icon: 'pl-koktobe', size: 48 }, { x: 0.62, y: 0.12, icon: 'ev-icecream' },
];

function Scene({ far, ev, person, spot }: { far?: boolean; ev: (id: string) => EventItem; person: (id: string) => Person; spot: (id: string) => FriendSpot }) {
  const h = far ? 300 : 560;
  return (
    <View style={[styles.scene, { height: h }]}>
      <Ground h={h} />
      {SPOTS.map((p, i) => {
        const e = p.id ? ev(p.id) : null;
        const s: MapSymbol = { id: String(i), lat: 0, lon: 0, sort: 0, icon: p.icon ?? eventSprite(e!), size: p.size ?? 44, text: p.text,
          textColor: '#5A564E', dot: far && e ? CAT_COLOR[e.category] : undefined };
        return <View key={i} style={[styles.at, { left: `${p.x * 100}%`, top: p.y * h }]}><SymbolPin s={far ? { ...s, text: undefined, size: s.size * 0.8 } : s} onPress={noop} /></View>;
      })}
      {!far && <>
        <View style={[styles.at, { left: '70%', top: 0.48 * h }]}><FriendPin person={person('denis')} spot={spot('denis')} onPress={noop} /></View>
        <View style={[styles.at, { left: '20%', top: 0.6 * h }]}><FriendPin person={person('igor')} spot={spot('igor')} onPress={noop} /></View>
        <View style={[styles.at, { left: '68%', top: 0.3 * h }]}><FriendPin person={person('anton')} spot={spot('anton')} onPress={noop} /></View>
        <View style={[styles.at, { left: '52%', top: 0.24 * h }]}><EventPin e={{ ...ev('jazz'), cover: 'igor3' }} kind="labeled" phase="today" showCompany={false} dark={false} onPress={noop} selected label="Вечеринка на крыше" friend={person('denis')} /></View>
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
      <Text style={styles.sec}>ВСЕ ОБЪЁМНЫЕ ЗНАЧКИ — СОБЫТИЯ, МЕСТА, ТРЦ</Text>
      <View style={styles.sprites}>
        {(Object.keys(SPRITES) as SpriteName[]).map((k) => (
          <View key={k} style={styles.sprite}><Image source={SPRITES[k]} style={{ width: 46, height: 54 }} /><Text style={styles.spriteCap} numberOfLines={1}>{k.replace(/^(ev|pl|mall)-/, '')}</Text></View>
        ))}
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

      <Text style={styles.sec}>МОИ МЕСТА — КАПЛИ</Text>
      <View style={styles.grid}>
        <Cell title="моё место"><View style={{ marginTop: 30 }}><PlacePin kind="home" title="Дом" label /></View></Cell>
        <Cell title="избранное"><View style={{ marginTop: 30 }}><PlacePin kind="fav" icon="coffee" title="Кофейня" label /></View></Cell>
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
  sprites: { flexDirection: 'row', flexWrap: 'wrap', gap: 4, backgroundColor: '#DDD8CB', borderRadius: 16, padding: 8 },
  sprite: { width: '18.6%', alignItems: 'center', paddingVertical: 4 },
  spriteCap: { fontFamily: fonts.mono500, fontSize: 9, color: colors.muted2 },
  cap: { fontFamily: fonts.body500, fontSize: 11, color: colors.muted2, marginTop: 4, textAlign: 'center' },
});
