// Объёмные значки карты — набор владельца (99 штук, assets/map/icons-v2): микрофон у стендапа, Медеу, Терренкур, свой ТРЦ у каждого центра.
// На телефоне их рисует сам движок карты (слой SymbolLayer в MapCanvas) — значки пришиты к карте и не отстают при вращении.
// В web и на подложке «бумага» те же картинки ставятся обычными маркерами (symbolMarkers).
import { Image, Pressable, StyleSheet, Text } from 'react-native';
import type { Category, EventItem } from '../data/types';
import type { AttractionKind } from '../data/attractions';
import { fonts } from '../theme';
import { SPRITE_PT, SPRITES, type SpriteName } from './sprites';
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

/** Размер значка в pt (набор владельца — 64×70): от него считается масштаб на карте. */
export const SPRITE_W = SPRITE_PT.w;
const RATIO = SPRITE_PT.h / SPRITE_PT.w;

/** Значок по разделу, если в названии нет ничего точнее. */
const CATEGORY_ICON: Record<Category, SpriteName> = {
  // 26 окт.: концерт — сцена (а не электрогитара у Меладзе и Преснякова), встреча — разговор (а не рукопожатие «бизнес»), еда — без бургера по умолчанию.
  music: 'ev-concert', concert: 'ev-stage', standup: 'ev-standup', art: 'ev-art', hike: 'ev-camping', games: 'ev-games', food: 'ev-streetfood',
  sport: 'ev-football', talks: 'ev-talks', movie: 'ev-movie', theatre: 'ev-theatre', lecture: 'ev-lecture', meetup: 'ev-talks', party: 'ev-party', bike: 'ev-bike',
};

/** Места Алматы со своим значком — и для событий там, и для самих мест на карте. */
const PLACE_WORDS: [RegExp, SpriteName][] = [
  [/терренкур/i, 'pl-terrenkur'], [/медеу|medeu/i, 'pl-medeu'], [/(^|\s)бао(\s|$)|большое алматинское озеро/i, 'pl-bao'], [/шымбулак|shymbulak|чимбулак/i, 'pl-shymbulak'],
  [/кок-?тобе|kok-?tobe/i, 'pl-koktobe'], [/канатк|канатн|гондол/i, 'pl-cable'], [/чарын|charyn|каньон/i, 'pl-charyn'], [/панфиловц|парк 28/i, 'pl-panfilov'],
  [/парк (им\.? )?горького|центральн\w* парк|парк гоголя/i, 'pl-gogol'], [/ботаническ|ботсад/i, 'pl-garden'], [/зоопарк/i, 'pl-zoo'],
  [/базар/i, 'pl-bazaar'], [/фудкорт|food ?court/i, 'pl-foodcourt'],
];

/** Значок по смыслу названия (узкие темы — раньше общих). Набор владельца, 99 значков (assets/map/icons.json). */
const WORD_ICON: [RegExp, SpriteName][] = [
  ...PLACE_WORDS,
  // Кино за едой и показы — попкорн; импровизация — микрофон; интеллектуальные игры — квиз (до общих «ужин», «игра»).
  [/кино-?ужин|кинопоказ|киновечер|кинотеатр под|open ?air кино|фильм[а-я]* «|(^|\s)фильм/i, 'ev-movie'], [/импров|improv/i, 'ev-standup'],
  [/интеллектуал|teztap|брейн|brain|что\? где\? когда/i, 'ev-quiz'], [/ролев/i, 'ev-games'], [/фламенко|flamenco|танц|сальса|бачата|dance/i, 'ev-party'],
  [/(^|\s)курс|course|тренинг|семинар/i, 'ev-lecture'], [/(^|\s)трио(\s|$)|квартет|(^|\s)trio|бэнд|(^|\s)band(\s|$)/i, 'ev-jazz'],
  // Музыка и вечеринки.
  [/джаз|jazz|саксофон|блюз|blues/i, 'ev-jazz'], [/оркестр|симфон|филармон|классическ\w* музык|органн|квартет|скрипк|опер[аы]/i, 'ev-orchestra'],
  [/караоке|karaoke/i, 'ev-karaoke'], [/(^|\s)рок|rock|панк|punk|метал|гранж/i, 'ev-rock'], [/\bdj\b|диджей|техно|techno|house|клуб/i, 'ev-club'],
  [/фестивал|festival/i, 'ev-festival'], [/салют|фейерверк/i, 'ev-fireworks'], [/праздник|день рождени|новый год|наурыз|хэллоуин|halloween/i, 'ev-holiday'],
  // Культура и фан.
  [/комик-?кон|comic ?con|комикс/i, 'ev-comicon'], [/косплей|cosplay/i, 'ev-cosplay'], [/аниме|anime|k-?pop|азия|asia/i, 'ev-asia'],
  [/книжн|книг|литератур|поэз|стих/i, 'ev-books'], [/фотосет|фотопрогулк|фотограф|photo/i, 'ev-photo'], [/музей/i, 'pl-museum'],
  // Еда и напитки.
  [/плов/i, 'ev-plov'], [/шаурм|донер/i, 'ev-shawarma'], [/пицц|pizza/i, 'ev-pizza'], [/суши|роллы|sushi/i, 'ev-sushi'], [/рамен|ramen|лапш/i, 'ev-ramen'],
  [/шашлык|барбекю|bbq|гриль/i, 'ev-shashlik'], [/выпечк|пекар|круассан|bakery|бранч|завтрак/i, 'ev-bakery'], [/десерт|торт|cake/i, 'ev-dessert'],
  [/мороженое|ice ?cream/i, 'ev-icecream'], [/стрит-?фуд|street ?food|фудтрак|food ?truck/i, 'ev-streetfood'], [/кофе|coffee|каппинг|бариста/i, 'ev-coffee'],
  [/(^|[\s«"])вин(о|а|н)|wine|сомелье|дегустац\w* вин/i, 'ev-wine'], [/пив[оа]|beer|крафт/i, 'ev-beer'], [/сыр[ыа]?(\s|$)|cheese/i, 'ev-cheese'], [/чайн|чаепит|(^|\s)чай(\s|$)|tea/i, 'ev-tea'],
  [/коктейл|(^|\s)бар(\s|$)|cocktail/i, 'ev-bar'], [/мастер-?класс|workshop|воркшоп|кулинар/i, 'ev-cooking'],
  // Спорт.
  [/баскетбол|basketball|стритбол/i, 'ev-basket'], [/теннис|tennis|падел|padel/i, 'ev-tennis'], [/футбол|football|soccer/i, 'ev-football'],
  [/забег|пробежк|марафон|(^|\s)бег(\s|$)|running/i, 'ev-run'], [/йог|yoga|пилатес|медитац/i, 'ev-yoga'], [/сноуборд|snowboard/i, 'ev-snowboard'],
  [/лыж|горнолыж/i, 'pl-ski'], [/гольф|golf/i, 'pl-golf'], [/каток|коньк|ледов|ice ?arena/i, 'pl-skate'], [/конн|лошад|верхов|horse/i, 'pl-horse'],
  [/вело|bike|cycling/i, 'ev-bike'],
  // Развлечения.
  [/боулинг|bowling/i, 'pl-bowling'], [/бильярд|billiard/i, 'pl-billiard'], [/дартс|darts/i, 'pl-darts'], [/квест|escape/i, 'pl-quest'],
  [/квиз|quiz|викторин/i, 'ev-quiz'], [/мафи/i, 'ev-mafia'], [/настолк|настольн|board ?game/i, 'ev-games'], [/(^|\s)vr(\s|$)|виртуальн/i, 'pl-vr'],
  [/кибер|esport|видеоигр|gaming/i, 'pl-gaming'], [/картинг|karting/i, 'pl-karting'], [/пейнтбол|лазертаг|paintball/i, 'pl-paintball'],
  [/лучн|из лука|archery/i, 'pl-archery'], [/батут/i, 'pl-trampoline'], [/скалодром|боулдер|climb/i, 'pl-climb'], [/колесо обозрения/i, 'pl-wheel'],
  [/аттракцион|луна-?парк/i, 'pl-coaster'], [/аквапарк|бассейн/i, 'pl-aqua'],
  // Природа.
  [/пикник|picnic/i, 'ev-picnic'], [/кемпинг|палатк|camping|с ночёвкой|с ночевкой/i, 'ev-camping'], [/костёр|костер|bonfire/i, 'ev-campfire'], [/смотров|закат|рассвет/i, 'pl-view'],
  // Общение и обучение.
  [/хакатон|hackathon|(^|\s)it(\s|$)|айти|tech|стартап|startup|программир|нейросет/i, 'ev-tech'], [/нетворкинг|networking|бизнес/i, 'ev-business'],
  [/english|английск|(^|\s)язык|speaking club|language/i, 'ev-language'], [/разговорн|дебат|дискусс/i, 'ev-talks'], [/знакомств|свидани|dating/i, 'ev-dating'],
  [/волонт|субботник|благотвор|volunteer|приют/i, 'ev-volunteer'], [/лекци|lecture/i, 'ev-lecture'],
  // Дети и питомцы.
  [/для детей|детск|kids|малыш/i, 'ev-kids'], [/собак|кошк|питом|pets|(^|\s)dog/i, 'ev-pets'],
  // Шопинг.
  [/маркет|market|ярмарк|барахолк|бутик|pop-?up|шопинг/i, 'pl-boutique'],
];

export function eventSprite(e: Pick<EventItem, 'category' | 'title' | 'venueName'>): SpriteName {
  // Сначала по названию события («Стендап» в баре — микрофон, «Велопрогулка» в парке — велосипед),
  // потом известное место (Медеу, Шымбулак), потом категория.
  const byTitle = WORD_ICON.find(([re]) => re.test(e.title))?.[1];
  if (byTitle) return byTitle;
  const byVenue = WORD_ICON.find(([re]) => re.test(e.venueName ?? ''))?.[1];
  return (byVenue?.startsWith('pl-') ? byVenue : undefined) ?? CATEGORY_ICON[e.category] ?? byVenue ?? 'ev-business';
}

/** Значок постоянного места по виду. */
const KIND_ICON: Record<AttractionKind, SpriteName> = {
  ski: 'pl-shymbulak', skate: 'pl-skate', cable: 'pl-cable', wheel: 'pl-wheel', bowling: 'pl-bowling', trampoline: 'pl-trampoline', climb: 'pl-climb',
  quest: 'pl-quest', vr: 'pl-vr', golf: 'pl-golf', paintball: 'pl-paintball', aqua: 'pl-aqua', photo: 'ev-photo', zipline: 'pl-zipline', park: 'pl-gogol',
  museum: 'pl-museum', zoo: 'pl-zoo', garden: 'pl-garden', view: 'pl-view', fun: 'pl-coaster', billiards: 'pl-billiard', gallery: 'ev-art', horse: 'pl-horse',
};
export const placeSprite = (kind: AttractionKind): SpriteName => KIND_ICON[kind] ?? 'pl-view';

/** Известные места — свой значок (Терренкур, Медеу, БАО, Кок-Тобе, Шымбулак, Чарын, парк Панфилова…), остальные — по виду. */
export function spotSprite(a: { kind: AttractionKind; name: string }): SpriteName {
  return PLACE_WORDS.find(([re]) => re.test(a.name))?.[1] ?? placeSprite(a.kind);
}

/** ТРЦ — вариант здания из набора владельца, название выводится подписью. */
const MALL_ICON: [RegExp, SpriteName][] = [
  [/dostyk|достык/i, 'mall-dome'], [/esentai|есентай/i, 'mall-tower'], [/mega|мега/i, 'mall-stripes'], [/aport|апорт/i, 'mall-long'], [/forum|форум/i, 'mall-columns'],
];
export const mallSprite = (name: string): SpriteName => MALL_ICON.find(([re]) => re.test(name))?.[1] ?? 'pl-shopping';

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
  dot: { width: 13, height: 13, borderRadius: 7, borderWidth: 2.2, borderColor: '#FFFFFF', boxShadow: '0 1.5px 3px rgba(23,22,26,0.3)' },
  text: { fontFamily: fonts.mono500, fontSize: 10, color: '#4A4640', marginTop: 1, textAlign: 'center', lineHeight: 12, textShadowColor: '#FFFFFF', textShadowRadius: 3, textShadowOffset: { width: 0, height: 0 } },
});
