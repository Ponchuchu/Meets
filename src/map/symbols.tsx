// Объёмные «игровые» значки карты (FIX5): микрофон у стендапа, конёк у Медеу, кабинка у Кок-Тобе, свой ТРЦ у каждого центра.
// На телефоне их рисует сам движок карты (слой SymbolLayer в MapCanvas) — значки пришиты к карте и не отстают при вращении.
// В web и на подложке «бумага» те же картинки ставятся обычными маркерами (symbolMarkers).
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import type { Category, EventItem } from '../data/types';
import type { AttractionKind } from '../data/attractions';
import { fonts } from '../theme';
import { CAT_COLOR } from './icons';
import { SPRITES, type SpriteName } from './sprites';
import type { MapMarker } from './types';

export interface MapSymbol {
  id: string;
  lat: number;
  lon: number;
  icon: SpriteName;
  /** Ширина значка в pt. */
  size: number;
  /** Маленькая подпись под значком: время, дата или название. */
  text?: string;
  textColor?: string;
  /** Обводка подписи: цвет фона карты. */
  halo?: string;
  /** Кто выше при наложении: больше — ближе к зрителю. */
  sort: number;
  /** Издалека — только цветная точка этого цвета. */
  dot?: string;
  faded?: boolean;
}

/** Ширина картинки спрайта в пикселях (scripts/map-sprites.mjs: 120 × 1.5). */
export const SPRITE_PX = 180;
const RATIO = 140 / 120;

/** Событие в известном месте получает значок места: каток Медеу — конёк, Шымбулак — лыжи. */
const PLACE_ICON: [RegExp, SpriteName][] = [
  [/медеу|medeu|каток|ледов|ice ?arena/i, 'pl-skate'], [/сноуборд|snowboard/i, 'ev-snowboard'], [/шымбулак|shymbulak|горнолыж|лыж/i, 'pl-ski'],
  [/кок-?тобе|kok-?tobe/i, 'pl-koktobe'], [/канатн/i, 'pl-cable'], [/чарын|charyn|каньон/i, 'pl-charyn'], [/кемпинг|палатк|camping|с ночёвкой|с ночевкой/i, 'ev-camping'],
  [/боулинг|bowling/i, 'pl-bowling'], [/батут/i, 'pl-trampoline'], [/скалодром/i, 'pl-climb'], [/квест|escape/i, 'pl-quest'], [/зоопарк/i, 'pl-zoo'], [/музей/i, 'pl-museum'],
  [/джаз|jazz|саксофон|блюз|blues/i, 'ev-jazz'], [/баскетбол|basketball|стритбол/i, 'ev-basket'], [/теннис|tennis|падел|padel/i, 'ev-tennis'],
  [/хакатон|hackathon|\bit\b|айти|tech|стартап|startup|программир|ai-|нейросет/i, 'ev-tech'], [/волонт|субботник|благотвор|volunteer|приют/i, 'ev-volunteer'],
  [/косплей|cosplay|аниме|anime|комик-?кон|comic/i, 'ev-cosplay'], [/выпечк|пекар|круассан|бейкер|bakery|бранч|завтрак/i, 'ev-bakery'], [/мороженое|десерт|ice ?cream/i, 'ev-icecream'],
  [/маркет|market|ярмарк|барахолк|бутик|pop-?up/i, 'pl-boutique'],
];

export function eventSprite(e: Pick<EventItem, 'category' | 'title' | 'venueName'>): SpriteName {
  const text = `${e.title} ${e.venueName ?? ''}`;
  return PLACE_ICON.find(([re]) => re.test(text))?.[1] ?? (`ev-${e.category}` as SpriteName);
}

export const placeSprite = (kind: AttractionKind): SpriteName => `pl-${kind}` as SpriteName;

/** Значок постоянного места: известные места — свой рисунок (Кок-Тобе — телебашня, Шымбулак — гора, Чарын — каньон). */
export function spotSprite(a: { kind: AttractionKind; name: string }): SpriteName {
  if (/кок-?тобе/i.test(a.name)) return 'pl-koktobe';
  if (/чарын/i.test(a.name)) return 'pl-charyn';
  return placeSprite(a.kind);
}

const MALL_ICON: [RegExp, SpriteName][] = [
  [/dostyk|достык/i, 'mall-dostyk'], [/esentai|есентай/i, 'mall-esentai'], [/mega park|мега парк/i, 'mall-megapark'],
  [/mega|мега/i, 'mall-mega'], [/aport|апорт/i, 'mall-aport'], [/forum|форум/i, 'mall-forum'],
];
export const mallSprite = (name: string): SpriteName => MALL_ICON.find(([re]) => re.test(name))?.[1] ?? 'mall-mall';

/** Подпись времени — тихая, в тон категории: темнее её цвета на светлой карте, светлее — на тёмной. */
export function timeColor(c: Category, dark: boolean): string {
  const n = parseInt(CAT_COLOR[c].slice(1), 16);
  const mix = (v: number) => Math.round(dark ? v + (255 - v) * 0.55 : v * 0.62);
  return `rgb(${mix(n >> 16)},${mix((n >> 8) & 255)},${mix(n & 255)})`;
}

/** Web и подложка: те же значки маркерами. Центр маркера — в точке, поэтому картинка стоит над ней, подпись — под ней. */
export function symbolMarkers(symbols: MapSymbol[], onSymbol?: (id: string) => void): MapMarker[] {
  return symbols.map((s) => ({ id: `sym-${s.id}`, lat: s.lat, lon: s.lon, z: s.sort / 10, node: <SymbolPin s={s} onPress={() => onSymbol?.(s.id)} /> }));
}

export function SymbolPin({ s, onPress }: { s: MapSymbol; onPress: () => void }) {
  if (s.dot) return <Pressable onPress={onPress} hitSlop={14} style={[styles.dot, { backgroundColor: s.dot, opacity: s.faded ? 0.35 : 1 }]} accessibilityRole="button" />;
  const h = s.size * RATIO;
  return (
    <Pressable onPress={onPress} style={{ width: 150, height: h * 2, alignItems: 'center', opacity: s.faded ? 0.35 : 1 }} accessibilityRole="button" accessibilityLabel={s.text}>
      <Image source={SPRITES[s.icon]} style={{ width: s.size, height: h }} />
      {!!s.text && <Text style={[styles.text, s.textColor ? { color: s.textColor, textShadowColor: s.halo ?? '#FFFFFF' } : null]} numberOfLines={2}>{s.text}</Text>}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  dot: { width: 11, height: 11, borderRadius: 6, borderWidth: 2, borderColor: '#FFFFFF' },
  text: { fontFamily: fonts.mono500, fontSize: 10, color: '#4A4640', marginTop: 1, textAlign: 'center', lineHeight: 12, textShadowColor: '#FFFFFF', textShadowRadius: 3, textShadowOffset: { width: 0, height: 0 } },
});
