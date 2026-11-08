// An editorial event entry: media owns its natural height; the page scrolls instead of cropping posters.
import { Image } from 'expo-image';
import { ArrowUpRight, CalendarPlus, Check, ChevronLeft, ChevronRight, Clock, EyeOff, MapPin } from 'lucide-react-native';
import { memo, useCallback, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import type { EventItem } from '../data/types';
import { photo } from '../data/photos';
import { eventFacts } from '../event/facts';
import { displayEventTitle } from '../event/title';
import { editorialText } from '../event/editorial';
import { CAT_LABEL } from '../map/icons';
import { EventMedia, eventMedia } from '../ui/EventMedia';
import { colors, fonts } from '../theme';

const ratios = new Map<string, number>();
export const naturalMediaHeight = (width: number, ratio: number) => Math.round(width / (Number.isFinite(ratio) && ratio > 0 ? ratio : 0.8));

export const NaturalEvent = memo(function NaturalEvent({ event: e, now, width, active, planned, onOpen, onPlan, onSkip, onFeedback }: {
  event: EventItem; now: Date; width: number; active: boolean; planned: boolean; onOpen: () => void; onFeedback: () => void; onPlan: () => void; onSkip: () => void;
}) {
  const items = eventMedia(e);
  const [page, setPage] = useState(0);
  const selected = Math.min(page, Math.max(0, items.length - 1));
  const item = items[selected];
  const [measured, setMeasured] = useState<{ url: string; ratio: number } | null>(null);
  const [broken, setBroken] = useState<string | null>(null);
  const ratio = measured && measured.url === item?.url ? measured.ratio : ratios.get(item?.url ?? '') ?? (item?.type === 'video' ? 9 / 16 : 4 / 5);
  const height = naturalMediaHeight(width, ratio);
  const onAspect = useCallback((value: number) => {
    if (!item || !Number.isFinite(value) || value <= 0) return;
    ratios.set(item.url, value);
    if (ratios.size > 256) ratios.delete(ratios.keys().next().value!);
    setMeasured(old => old?.url === item.url && old.ratio === value ? old : { url: item.url, ratio: value });
  }, [item]);
  const f = eventFacts(e);
  const category = e.spotId ? 'Место в городе' : CAT_LABEL[e.category]?.toLowerCase() ?? 'событие';
  const title = displayEventTitle(e.title);
  const when = e.isLong && e.endsAt && Date.parse(e.startsAt) < now.getTime() && Date.parse(e.endsAt) > now.getTime()
    ? `До ${new Intl.DateTimeFormat('ru-RU', { day: 'numeric', month: 'short', timeZone: 'Asia/Almaty' }).format(new Date(e.endsAt)).replace(/\.$/, '')} · выбери день` : f.when;
  const price = !e.isFree && e.priceMin != null && e.priceMin > 0 && e.priceMax == null ? `от ${f.price}` : f.price;
  return <View style={styles.entry}>
    <View style={styles.meta}><Text style={styles.category}>{category[0].toUpperCase() + category.slice(1)}</Text><Text style={styles.price}>{price}</Text></View>
    {item && broken !== item.url ? <View style={[styles.media, { width, height }]}>
      {item.type === 'video'
        ? <EventMedia items={items} selected={selected} active={active} height={height} controlsTop={12} onAspect={onAspect} />
        : <Pressable onPress={onOpen} onLongPress={onFeedback} accessibilityRole="button" accessibilityLabel={`Открыть афишу: ${title}`} style={StyleSheet.absoluteFill}>
          <Image source={photo(item.url, Math.min(1080, width * 3))} recyclingKey={item.url} contentFit="contain" style={StyleSheet.absoluteFill}
            onLoad={ev => onAspect(ev.source.width / ev.source.height)} onError={() => setBroken(item.url)} />
        </Pressable>}
      {items.length > 1 && <>
        <Pressable onPress={() => setPage((selected - 1 + items.length) % items.length)} accessibilityRole="button" accessibilityLabel="Предыдущее фото" style={[styles.arrow, { left: 8 }]}><ChevronLeft size={20} color={colors.ink} /></Pressable>
        <Pressable onPress={() => setPage((selected + 1) % items.length)} accessibilityRole="button" accessibilityLabel="Следующее фото" style={[styles.arrow, { right: 8 }]}><ChevronRight size={20} color={colors.ink} /></Pressable>
        <View style={styles.count}><Text style={styles.countText}>{selected + 1} / {items.length}</Text></View>
      </>}
    </View> : <Pressable onPress={onOpen} onLongPress={onFeedback} accessibilityRole="button" accessibilityLabel={`Открыть событие: ${title}`} style={styles.noMedia}><Text style={styles.noMediaText}>{e.spotId ? 'Посмотреть место' : 'Афиша пока недоступна'}</Text><ArrowUpRight size={22} color={colors.muted} /></Pressable>}
    <Pressable onPress={onOpen} onLongPress={onFeedback} accessibilityRole="button" accessibilityLabel={`Подробнее: ${title}`}><Text style={styles.title}>{title}</Text></Pressable>
    <View style={styles.facts}>
      <View style={styles.fact}><Clock size={15} color={colors.muted} strokeWidth={1.7} /><Text style={styles.factText}>{e.spotId ? 'Выбери удобный день' : when}</Text></View>
      <View style={styles.fact}><MapPin size={15} color={colors.muted} strokeWidth={1.7} /><Text style={styles.factText}>{f.place}</Text></View>
    </View>
    {!!editorialText(e) && <Text style={styles.about} numberOfLines={2}>{editorialText(e)}</Text>}
    {e.goingCount >= 3 && <Text style={styles.social}>Идут {e.goingCount.toLocaleString('ru-RU')} человек</Text>}
    <View style={styles.actions}>
      <Pressable onPress={onOpen} onLongPress={onFeedback} accessibilityRole="button" accessibilityLabel="Подробнее" style={styles.more}><Text style={styles.moreText}>Подробнее</Text><ArrowUpRight size={17} color={colors.ink} strokeWidth={1.7} /></Pressable>
      <Pressable onPress={onSkip} accessibilityRole="button" accessibilityLabel={`Не интересно: ${title}`} style={styles.skip}><EyeOff size={19} color={colors.muted} strokeWidth={1.6} /></Pressable>
      <Pressable onPress={onPlan} accessibilityRole="button" accessibilityLabel={planned ? `В планах: ${title}` : `Пойду: ${title}`} style={({ pressed }) => [styles.plan, planned && styles.planned, pressed && { opacity: 0.8, transform: [{ scale: 0.98 }] }]}>
        {planned ? <Check size={19} color={colors.ink} strokeWidth={1.8} /> : <CalendarPlus size={19} color="#FFFFFF" strokeWidth={1.8} />}
        <Text style={[styles.planText, planned && { color: colors.ink }]}>{planned ? 'В планах' : 'Пойду'}</Text>
      </Pressable>
    </View>
  </View>;
});
const styles = StyleSheet.create({
  entry: { gap: 13 },
  meta: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 16 },
  category: { fontFamily: fonts.body500, fontSize: 12, color: colors.muted },
  price: { fontFamily: fonts.body600, fontSize: 13, color: colors.ink },
  media: { borderRadius: 16, overflow: 'hidden', backgroundColor: '#EAE9E2' },
  noMedia: { minHeight: 80, paddingHorizontal: 20, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: colors.cardAlt, borderRadius: 16 },
  noMediaText: { fontFamily: fonts.body400, fontSize: 14, color: colors.muted },
  title: { fontFamily: fonts.display600, fontSize: 24, lineHeight: 29, letterSpacing: -0.5, color: colors.ink },
  facts: { gap: 8 },
  fact: { flexDirection: 'row', gap: 8, alignItems: 'flex-start' },
  factText: { flex: 1, fontFamily: fonts.body400, fontSize: 13, lineHeight: 19, color: colors.muted2 },
  about: { fontFamily: fonts.body400, fontSize: 14, lineHeight: 21, color: colors.muted },
  social: { fontFamily: fonts.body500, fontSize: 12, color: colors.friend },
  actions: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  more: { flex: 1, minHeight: 44, flexDirection: 'row', alignItems: 'center', gap: 7 },
  moreText: { fontFamily: fonts.body500, fontSize: 13, color: colors.ink },
  skip: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  plan: { minHeight: 44, paddingHorizontal: 17, borderRadius: 15, flexDirection: 'row', gap: 7, alignItems: 'center', backgroundColor: '#EC5B35' },
  planned: { backgroundColor: '#DFEAE2' },
  planText: { fontFamily: fonts.body500, fontSize: 14, color: '#FFFFFF' },
  arrow: { position: 'absolute', top: '45%', width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(255,255,252,0.94)' },
  count: { position: 'absolute', right: 12, bottom: 12, paddingHorizontal: 9, paddingVertical: 5, borderRadius: 12, backgroundColor: 'rgba(255,255,252,0.94)' },
  countText: { fontFamily: fonts.body500, fontSize: 11, color: colors.ink },
});
