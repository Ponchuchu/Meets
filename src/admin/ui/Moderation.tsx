// Модерация — design/png/Admin.png. Очередь черновиков: «Опубликовать / Править / Нет», неточный адрес — «Поставить точку».
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useMemo, useState } from 'react';
import { Image,Modal,Pressable,ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import Animated, { FadeInDown, FadeOut, LinearTransition } from 'react-native-reanimated';
import { now as clockNow } from '../../lib/clock';
import { useProfile } from '../../state/profile';
import { useSession } from '../../state/session';
import { colors, fonts } from '../../theme';
import { Toggle as Switch } from '../../ui/v6/Settings';
import { Toast, type ToastData } from '../../ui/Toast';
import { loadQueue, loadSources, loadStats, moderate, saveDraft, setAutoPublish as saveAutoPublish } from '../api';
import { demoQueue, DEMO_STATS, metaLine, parseRuDate, type QueueFlag, type QueueItem } from '../model';
import { useAdminDemo } from '../store';

const FLAG_TEXT: Record<QueueFlag, string> = {
  needs_pin: 'Адрес неточный — поставь точку',
  check_price: 'Цена мелким шрифтом — проверь сумму',
  cancel_reported: 'Пишут, что отменили — проверь',
};

const hm = (iso: string) => {
  const d = new Date(new Date(iso).getTime() + 5 * 3600e3);
  return `${String(d.getUTCHours()).padStart(2, '0')}:${String(d.getUTCMinutes()).padStart(2, '0')}`;
};

export function Moderation({ live }: { live: boolean }) {
  const qc = useQueryClient();
  const now = clockNow();
  const demo = useAdminDemo();
  const suggestions = useProfile((s) => s.suggestions);
  const myName = useSession((s) => s.draft.name) || 'Данил';
  const [preview,setPreview]=useState<QueueItem|null>(null);
  const [editing, setEditing] = useState<QueueItem | null>(null);
  const [pinning, setPinning] = useState<QueueItem | null>(null);
  const [toast, setToast] = useState<ToastData | null>(null);
  const say = (text: string) => {
    setToast({ text });
    setTimeout(() => setToast((t) => (t?.text === text ? null : t)), 2600);
  };

  const queueQ = useQuery({ queryKey: ['admin', 'queue'], queryFn: loadQueue, enabled: live });
  const sourcesQ=useQuery({queryKey:['admin','sources'],queryFn:loadSources,enabled:live});
  const statsQ = useQuery({ queryKey: ['admin', 'stats'], queryFn: loadStats, enabled: live });

  // Демо: очередь макета.
  const demoItems = useMemo(() => {
    const mine: QueueItem[] = suggestions.map((s) => {
      const startsAt = (s.date && parseRuDate(s.date, s.time ?? '', now)) || s.at;
      return {
        id: s.id, source: `ПРЕДЛОЖИЛ ПОЛЬЗОВАТЕЛЬ · ${myName}`.toUpperCase(), confidence: null, title: s.title,
        meta: metaLine({ startsAt, place: s.place ?? null, priceMin: null, priceMax: null, isFree: false }) + (s.price ? ` · ${s.price}` : ''),
        flags: ['needs_pin'], startsAt, address: s.place ?? null, about: '', priceMin: null, priceMax: null, isFree: false,
      };
    });
    return [...demoQueue(now), ...mine]
      .filter((x) => !demo.done[x.id])
      .map((x) => ({ ...x, ...demo.edits[x.id] }));
  }, [suggestions, demo.done, demo.edits, myName]); // eslint-disable-line react-hooks/exhaustive-deps

  const items = live ? (queueQ.data ?? []) : demoItems;
  const stats = live
    ? (statsQ.data ?? { waiting: 0, onMap: 0, filtered: 0, lastRun: null })
    : { ...DEMO_STATS, waiting: demoItems.length, onMap: demo.published };
  const lastRun = stats.lastRun ? hm(stats.lastRun) : '—';

  const act = useMutation({
    mutationFn: async ({ item, action, point }: { item: QueueItem; action: 'publish' | 'reject' | 'pin'; point?: { lat: number; lon: number } }) => {
      if (!live) return;
      if (action === 'pin') {
        await moderate(item.id, 'pin', point);
        await moderate(item.id, 'publish');
      } else await moderate(item.id, action);
    },
    onSuccess: (_data,{ item, action }) => {
      if (!live) demo.decide(item.id, action === 'reject' ? 'reject' : 'publish');
      say(action === 'reject' ? 'Убрали из очереди' : `«${item.title}» — на карте`);
    },
    onSettled: () => {
      void qc.invalidateQueries({ queryKey: ['admin'] });
      void qc.invalidateQueries({ queryKey: ['events'] });
    },
    onError: () => say('Не получилось — проверь связь и попробуй ещё раз'),
  });

  const autoPublish = live ? !!sourcesQ.data?.some(s=>s.trusted&&s.autoPublish) : demo.autoPublish;
  const toggleAuto = (v: boolean) => {
    if (live) void saveAutoPublish(v).then(() => {void qc.invalidateQueries({queryKey:['admin','sources']});say(v ? 'Источники с доверием публикуются сразу' : 'Всё идёт через очередь');}).catch(()=>say('Не удалось сохранить настройку'));
    else demo.setAutoPublish(v);
  };

  return (
    <View style={styles.root}>
      <Text style={styles.h1} accessibilityRole="header">Ждут согласования</Text>
      <Text style={styles.last}>ПОСЛЕДНИЙ СБОР {lastRun}</Text>
      <View style={styles.stats}>
        {([[stats.waiting, 'ждут тебя'], [stats.onMap, 'на карте'], [stats.filtered, 'отсеял ИИ']] as const).map(([n, label]) => (
          <View key={label} style={styles.stat}>
            <Text style={styles.statN}>{n}</Text>
            <Text style={styles.statLabel}>{label}</Text>
          </View>
        ))}
      </View>

      {items.length === 0 && (
        <View style={styles.empty}><Text style={styles.emptyText}>{live && queueQ.isLoading ? 'Загружаю очередь…' : 'Очередь пуста — всё проверено'}</Text></View>
      )}
      {items.map((item) => {
        const pin = item.flags.includes('needs_pin');
        const low = item.confidence != null && item.confidence < 90;
        return (
          <Animated.View key={item.id} entering={FadeInDown.duration(220)} exiting={FadeOut.duration(180)} layout={LinearTransition.duration(220)} style={styles.card}>
            <View style={styles.cardTop}>
              <Text style={styles.source} numberOfLines={1}>{item.source}</Text>
              {item.confidence != null && <Text style={[styles.conf, low && { color: colors.accentText }]}>{item.confidence}%</Text>}
            </View>
<Pressable onPress={()=>setPreview(item)} accessibilityRole="button" accessibilityLabel={`Посмотреть карточку: ${item.title}`}><Text style={styles.title}>{item.title}</Text></Pressable>
            <Text style={styles.meta}>{item.meta}</Text>
            {item.flags.map((f) => (
              <View key={f} style={styles.flag}><Text style={styles.flagText}>{FLAG_TEXT[f]}</Text></View>
            ))}
            <View style={styles.actions}>
              <Pressable onPress={() => (pin ? setPinning(item) : act.mutate({ item, action: 'publish' }))} style={[styles.btn, styles.primary]} accessibilityRole="button">
                <Text style={[styles.btnText, { color: colors.paper }]}>{pin ? 'Поставить точку' : 'Опубликовать'}</Text>
              </Pressable>
              <Pressable onPress={() => setEditing(item)} style={styles.btn} accessibilityRole="button"><Text style={styles.btnText}>Править</Text></Pressable>
              <Pressable onPress={() => act.mutate({ item, action: 'reject' })} style={styles.btn} accessibilityRole="button" accessibilityLabel={`Не публиковать «${item.title}»`}>
                <Text style={styles.btnText}>Нет</Text>
              </Pressable>
            </View>
          </Animated.View>
        );
      })}

      <View style={styles.auto}>
        <View style={{ flex: 1 }}>
          <Text style={styles.autoTitle}>Публиковать сразу, если 95%+</Text>
          <Text style={styles.autoSub}>только для источников с доверием</Text>
        </View>
        <Switch on={autoPublish} onChange={toggleAuto} label="Публиковать сразу, если 95%+" />
      </View>

      {preview&&<Overlay label="Карточка события" onClose={()=>setPreview(null)}>
        {preview.coverUrl&&<Image source={{uri:preview.coverUrl}} style={{width:'100%',height:180,borderRadius:18}} resizeMode="cover"/>}
        <Text style={styles.source}>{preview.source}</Text><Text style={styles.sheetTitle}>{preview.title}</Text><Text style={styles.meta}>{preview.meta}</Text>
        <Label text="Описание"/><Text style={styles.meta}>{preview.about||'Описание пока отсутствует'}</Text>
        <Label text="Адрес"/><Text style={styles.meta}>{preview.address||'Нужно уточнить место'}</Text>
        {preview.flags.map(f=><Text key={f} style={styles.flagText}>{FLAG_TEXT[f]}</Text>)}
        <Pressable style={[styles.btn,{flex:0}]} onPress={()=>{setEditing(preview);setPreview(null);}}><Text style={styles.btnText}>Редактировать</Text></Pressable>
        <Pressable style={[styles.btn,styles.primary,{flex:0}]} disabled={act.isPending} onPress={()=>{if(preview.flags.includes('needs_pin'))setPinning(preview);else act.mutate({item:preview,action:'publish'});setPreview(null);}}><Text style={[styles.btnText,{color:colors.paper}]}>Одобрить</Text></Pressable>
      </Overlay>}
      {queueQ.isError&&<Text style={styles.flagText}>Не удалось загрузить очередь. Проверь связь.</Text>}
      {editing && (
        <EditCard item={editing} onClose={() => setEditing(null)} onSave={async (patch) => {
          if (live) {
            await saveDraft(editing.id, {
              title: patch.title, about: patch.about, address: patch.address, is_free: patch.isFree, price_min: patch.priceMin,
              flags: editing.flags.filter((f) => f !== 'check_price'),
            });
            void qc.invalidateQueries({ queryKey: ['admin'] });
          } else {
            demo.edit(editing.id, { ...patch, flags: editing.flags.filter((f) => f !== 'check_price'), meta: metaLine({ startsAt: editing.startsAt, place: patch.address, priceMin: patch.priceMin, priceMax: null, isFree: patch.isFree }) });
          }
          setEditing(null);
          say('Сохранили');
        }} />
      )}
      {pinning && (
        <PinCard item={pinning} onClose={() => setPinning(null)} onPin={(point) => {
          act.mutate({ item: pinning, action: 'pin', point });
          setPinning(null);
        }} />
      )}
      {toast && <View style={styles.toastWrap} pointerEvents="box-none"><Toast t={toast} /></View>}
    </View>
  );
}

type Patch = { title: string; about: string; address: string | null; priceMin: number | null; isFree: boolean };

function EditCard({ item, onClose, onSave }: { item: QueueItem; onClose: () => void; onSave: (p: Patch) => Promise<void> }) {
  const [error,setError]=useState('');const [busy,setBusy]=useState(false);
  const [title, setTitle] = useState(item.title);
  const [about, setAbout] = useState(item.about);
  const [address, setAddress] = useState(item.address ?? '');
  const [price, setPrice] = useState(item.isFree ? '0' : item.priceMin != null ? String(item.priceMin) : '');
  const n = Number(price.replace(/\D/g, ''));
  return (
    <Overlay label="Править черновик" onClose={onClose}>
      <Text style={styles.sheetTitle}>Править</Text>
      <Label text="Название" /><TextInput value={title} onChangeText={setTitle} style={styles.input} accessibilityLabel="Название" />
      <Label text="Адрес" /><TextInput value={address} onChangeText={setAddress} style={styles.input} accessibilityLabel="Адрес" placeholder="Улица и дом" placeholderTextColor={colors.muted3} />
      <Label text="Цена, ₸ (0 — бесплатно)" /><TextInput value={price} onChangeText={setPrice} keyboardType="number-pad" style={styles.input} accessibilityLabel="Цена" />
      <Label text="Описание" /><TextInput value={about} onChangeText={setAbout} multiline style={[styles.input, { height: 96, paddingTop: 10, textAlignVertical: 'top' }]} accessibilityLabel="Описание" />
      <Pressable disabled={busy||!title.trim()} onPress={async () => {setBusy(true);setError('');try{await onSave({ title: title.trim(), about: about.trim(), address: address.trim() || null, priceMin: price && n > 0 ? n : null, isFree: price !== '' && n === 0 });}catch{setError('Не удалось сохранить. Попробуй ещё раз');}finally{setBusy(false);}}}
        style={[styles.btn, styles.primary, { flex: 0, marginTop: 14 }]} accessibilityRole="button">
        <Text style={[styles.btnText, { color: colors.paper }]}>{busy?'Сохраняю…':'Сохранить'}</Text>
      </Pressable>
      {!!error&&<Text style={styles.flagText}>{error}</Text>}
    </Overlay>
  );
}

/** Точка по адресу: Nominatim в рамке Алматы. Модератор проверяет найденное и публикует. */
function PinCard({ item, onClose, onPin }: { item: QueueItem; onClose: () => void; onPin: (p: { lat: number; lon: number }) => void }) {
  const [q, setQ] = useState(item.address && item.address !== 'в центре' ? item.address : '');
  const [hit, setHit] = useState<{ lat: number; lon: number; name: string } | null>(null);
  const [state, setState] = useState<'idle' | 'busy' | 'none'>('idle');
  const find = async () => {
    setState('busy');
    try {
      const url = `https://nominatim.openstreetmap.org/search?format=jsonv2&limit=1&countrycodes=kz&accept-language=ru&bounded=1&viewbox=76.70,43.40,77.20,43.05&q=${encodeURIComponent(`${q}, Алматы`)}`;
      const [r] = (await (await fetch(url)).json()) as { lat: string; lon: string; display_name: string }[];
      if (r) {
        setHit({ lat: Number(r.lat), lon: Number(r.lon), name: r.display_name.split(',').slice(0, 3).join(',') });
        setState('idle');
      } else setState('none');
    } catch {
      setState('none');
    }
  };
  return (
    <Overlay label="Поставить точку" onClose={onClose}>
      <Text style={styles.sheetTitle}>Поставить точку</Text>
      <Text style={styles.meta}>{item.title}</Text>
      <Label text="Адрес или место" />
      <View style={{ flexDirection: 'row', gap: 8 }}>
        <TextInput value={q} onChangeText={setQ} onSubmitEditing={find} style={[styles.input, { flex: 1 }]} placeholder="Например: Панфилова 110" placeholderTextColor={colors.muted3} accessibilityLabel="Адрес" />
        <Pressable onPress={find} disabled={!q.trim() || state === 'busy'} style={[styles.btn, { flex: 0, paddingHorizontal: 16 }]} accessibilityRole="button"><Text style={styles.btnText}>Найти</Text></Pressable>
      </View>
      {state === 'none' && <Text style={[styles.meta, { color: colors.accentText }]}>Не нашли — уточни адрес</Text>}
      {hit && <Text style={styles.meta}>{hit.name} · {hit.lat.toFixed(5)}, {hit.lon.toFixed(5)}</Text>}
      <Pressable disabled={!hit} onPress={() => hit && onPin(hit)} style={[styles.btn, styles.primary, { flex: 0, marginTop: 14 }, !hit && { opacity: 0.4 }]} accessibilityRole="button">
        <Text style={[styles.btnText, { color: colors.paper }]}>Опубликовать с этой точкой</Text>
      </Pressable>
    </Overlay>
  );
}

function Label({ text }: { text: string }) {
  return <Text style={styles.label}>{text}</Text>;
}

function Overlay({ children, onClose, label }: { children: React.ReactNode; onClose: () => void; label: string }) {
  return (
    <Modal transparent visible animationType="fade" onRequestClose={onClose}><View style={styles.overlay}>
      <Pressable style={StyleSheet.absoluteFill} onPress={onClose} accessibilityRole="button" accessibilityLabel="Закрыть" />
      <Animated.View entering={FadeInDown.duration(200)} style={styles.sheet} accessibilityViewIsModal accessibilityLabel={label}><ScrollView contentContainerStyle={{gap:8}} keyboardShouldPersistTaps="handled">{children}</ScrollView></Animated.View>
    </View></Modal>
  );
}

const styles = StyleSheet.create({
  root: { width: '100%', paddingTop: 0, paddingBottom: 0, gap: 12 },
  top: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 10 },
  badge: { backgroundColor: colors.ink, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 6 },
  badgeText: { fontFamily: fonts.mono600, fontSize: 10.5, color: colors.paper, letterSpacing: 0.4 },
  last: { fontFamily: fonts.mono500, fontSize: 10.5, color: colors.muted, letterSpacing: 0.4 },
  h1: { fontFamily: fonts.display700, fontSize: 32, color: colors.ink, letterSpacing: -0.6, marginTop: 4 },
  stats: { flexDirection: 'row', gap: 8 },
  stat: { flex: 1, backgroundColor: colors.card, borderRadius: 16, borderWidth: 1, borderColor: colors.line, paddingHorizontal: 12, paddingVertical: 12 },
  statN: { fontFamily: fonts.display700, fontSize: 24, color: colors.ink },
  statLabel: { fontFamily: fonts.body400, fontSize: 12.5, color: colors.muted2, marginTop: 2 },
  card: { backgroundColor: colors.card, borderRadius: 20, borderWidth: 1, borderColor: colors.line, padding: 14, gap: 8 },
  cardTop: { flexDirection: 'row', justifyContent: 'space-between', gap: 8 },
  source: { flex: 1, fontFamily: fonts.mono600, fontSize: 10.5, color: colors.muted2, letterSpacing: 0.4 },
  conf: { fontFamily: fonts.mono600, fontSize: 11, color: colors.muted2 },
  title: { fontFamily: fonts.body700, fontSize: 19, color: colors.ink, lineHeight: 24 },
  meta: { fontFamily: fonts.body400, fontSize: 13.5, color: colors.muted2 },
  flag: { alignSelf: 'flex-start', backgroundColor: '#EDC6B2', borderRadius: 8, paddingHorizontal: 9, paddingVertical: 5 },
  flagText: { fontFamily: fonts.body600, fontSize: 12.5, color: colors.accentText },
  actions: { flexDirection: 'row', gap: 6, marginTop: 4 },
  btn: { flex: 1, height: 42, borderRadius: 12, borderWidth: 1, borderColor: colors.line2, backgroundColor: colors.card, alignItems: 'center', justifyContent: 'center' },
  primary: { flex: 2, backgroundColor: colors.ink, borderColor: colors.ink },
  btnText: { fontFamily: fonts.body700, fontSize: 14.5, color: colors.ink },
  auto: { flexDirection: 'row', alignItems: 'center', gap: 12, borderWidth: 1.2, borderStyle: 'dashed', borderColor: colors.line2, borderRadius: 16, padding: 14, marginTop: 4 },
  autoTitle: { fontFamily: fonts.body700, fontSize: 14.5, color: colors.ink },
  autoSub: { fontFamily: fonts.body400, fontSize: 12.5, color: colors.muted },
  empty: { borderRadius: 20, borderWidth: 1, borderColor: colors.line, padding: 24, alignItems: 'center' },
  emptyText: { fontFamily: fonts.body500, fontSize: 14, color: colors.muted },
  overlay: { position: 'absolute', left: 0, right: 0, top: 0, bottom: 0, backgroundColor: 'rgba(23,22,26,0.4)', alignItems: 'center', justifyContent: 'center', padding: 16, zIndex: 20 },
  sheet: {maxHeight:'90%', width: '100%', maxWidth: 420, backgroundColor: colors.paper, borderRadius: 22, padding: 18, gap: 6 },
  sheetTitle: { fontFamily: fonts.display700, fontSize: 22, color: colors.ink, marginBottom: 4 },
  label: { fontFamily: fonts.mono600, fontSize: 10.5, color: colors.muted, letterSpacing: 0.4, marginTop: 6, textTransform: 'uppercase' },
  input: { height: 44, borderRadius: 12, borderWidth: 1, borderColor: colors.line2, backgroundColor: colors.card, paddingHorizontal: 12, fontFamily: fonts.body500, fontSize: 15, color: colors.ink },
  toastWrap: { position: 'absolute', left: 16, right: 16, bottom: 24, alignItems: 'center', zIndex: 30 },
});
