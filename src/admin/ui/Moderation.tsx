// Модерация — design/png/Admin.png. Очередь черновиков: «Опубликовать / Править / Нет», неточный адрес — «Поставить точку».
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useMemo, useRef, useState } from 'react';
import { Check, X } from 'lucide-react-native';
import { Image,Modal,Pressable,ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { now as clockNow } from '../../lib/clock';
import { useProfile } from '../../state/profile';
import { useSession } from '../../state/session';
import { readPoint } from '../../live/point';
import { MapCanvas } from '../../map/MapCanvas';
import type { MapCanvasHandle } from '../../map/types';
import { colors, fonts } from '../../theme';
import type { ToastData } from '../../ui/Toast';
import { loadQueue, moderate, saveDraft } from '../api';
import { isReliable } from '../rules';
import { EventRow, RoundBtn } from './EventRow';
import { Banner } from './kit';
import { demoQueue, metaLine, parseRuDate, type QueueFlag, type QueueItem } from '../model';
import { useAdminDemo } from '../store';

const FLAG_TEXT: Record<QueueFlag, string> = {
  needs_pin: 'Адрес неточный — поставь точку',
  check_price: 'Цена мелким шрифтом — проверь сумму',
  cancel_reported: 'Пишут, что отменили — проверь',
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

  const pendingRef = useRef(new Set<string>());
  const [pending, setPending] = useState<string[]>([]);
  const [completed, setCompleted] = useState<string[]>([]);
  const allItems = useMemo(() => (live ? (queueQ.data ?? []) : demoItems), [live, queueQ.data, demoItems]);
  const [qf, setQf] = useState<'all' | 'pin' | 'price'>('all');
  const [shown, setShown] = useState(12);
  const items = allItems.filter(x => !pending.includes(x.id) && !completed.includes(x.id)).filter((x) => qf === 'all' || (qf === 'pin' ? x.flags.includes('needs_pin') : !x.isFree && x.priceMin == null));

  const reliable = useMemo(() => allItems.filter((x) => !pending.includes(x.id) && !completed.includes(x.id) && isReliable(x) && (!live || !!x.point)), [allItems, live, pending, completed]);
  const [bulk, setBulk] = useState<'idle' | 'confirm' | 'busy'>('idle');
  const publishReliable = async () => {
    setBulk('busy');
    let n = 0;
    try {
      for (const x of reliable) {
        if (live) await moderate(x.id, 'publish', x.point ?? undefined); else demo.decide(x.id, 'publish');
        n += 1;
      }
      say(`На карте: ${n}`);
    } catch {
      say(n ? `Опубликовали ${n}, дальше не вышло — проверь связь` : 'Не получилось — проверь связь и попробуй ещё раз');
    }
    setBulk('idle');
    void qc.invalidateQueries({ queryKey: ['admin'] });
    void qc.invalidateQueries({ queryKey: ['events'] });
  };

  const act = useMutation({
    mutationFn: async ({ item, action, point }: { item: QueueItem; action: 'publish' | 'reject' | 'pin'; point?: { lat: number; lon: number } }) => {
      if (!live) return;
      if (action === 'pin') {
        await moderate(item.id, 'pin', point);
        await moderate(item.id, 'publish', point);
      } else await moderate(item.id, action, action === 'publish' ? item.point ?? undefined : undefined);
    },
    onMutate: ({ item }) => { pendingRef.current.add(item.id); setPending([...pendingRef.current]); },
    onSuccess: (_data,{ item, action }) => {
      setCompleted(old => [...old, item.id]);
      if (!live) demo.decide(item.id, action === 'reject' ? 'reject' : 'publish');
      say(action === 'reject' ? 'Убрали из очереди' : `«${item.title}» — на карте`);
    },
    onSettled: (_data, _error, { item }) => {
      pendingRef.current.delete(item.id); setPending([...pendingRef.current]);
      if (pendingRef.current.size === 0) {
        void qc.invalidateQueries({ queryKey: ['admin'] });
        void qc.invalidateQueries({ queryKey: ['events'] });
      }
    },
    onError: () => say('Не получилось — проверь связь и попробуй ещё раз'),
  });

  return (
    <View style={styles.root}>
      {pending.length > 0 && <Banner tone="info" text={`Сохраняю ${pending.length} в фоне. Можно проверять следующие`} />}
      {toast && <Banner tone={/не получилось|не удалось/i.test(toast.text) ? 'error' : 'ok'} text={toast.text} />}
      <View style={styles.filters}>
        {([['all', 'Любые'], ['pin', 'Нужна точка'], ['price', 'Без цены']] as const).map(([k, label]) => (
          <Pressable key={k} onPress={() => setQf(k)} accessibilityRole="button" accessibilityState={{ selected: qf === k }} style={[styles.fchip, qf === k && styles.fchipOn]}>
            <Text style={[styles.fchipText, qf === k && { color: colors.paper }]}>{label}{k === 'all' ? `  ${allItems.length}` : ''}</Text>
          </Pressable>
        ))}
      </View>

      {items.length === 0 && (
        <View style={styles.empty}><Text style={styles.emptyText}>{live && queueQ.isLoading ? 'Загружаю очередь…' : queueQ.isError ? 'Не удалось загрузить очередь. Проверь связь.' : allItems.length ? 'Под этот фильтр ничего нет' : 'Очередь пуста. Нажми «Найти события» наверху'}</Text></View>
      )}
      {allItems.length > 0 && (
        <View style={styles.listHead}>
          <Text style={styles.found} accessibilityRole="header">Найдено: {allItems.length}</Text>
          {reliable.length > 0 && bulk === 'idle' && (
            <Pressable onPress={() => setBulk('confirm')} accessibilityRole="button" hitSlop={8} style={styles.bulkLink}><Text style={styles.bulkText}>Опубликовать надёжные ({reliable.length})</Text></Pressable>
          )}
        </View>
      )}
      {bulk !== 'idle' && (
        <View style={styles.confirm}>
          <Text style={styles.confirmT}>Опубликовать {reliable.length} без пометок и с уверенностью 90%+? Остальные останутся в списке.</Text>
          <View style={styles.actions}>
            <Pressable disabled={bulk === 'busy'} onPress={() => void publishReliable()} style={[styles.btn, styles.primary, bulk === 'busy' && { opacity: 0.5 }]} accessibilityRole="button"><Text style={[styles.btnText, { color: colors.paper }]}>{bulk === 'busy' ? 'Публикую…' : 'Опубликовать'}</Text></Pressable>
            <Pressable disabled={bulk === 'busy'} onPress={() => setBulk('idle')} style={styles.btn} accessibilityRole="button"><Text style={styles.btnText}>Отмена</Text></Pressable>
          </View>
        </View>
      )}
      {items.slice(0, shown).map((item, i) => {
        const pin = item.flags.includes('needs_pin') || (live && !item.point);
        return (
          <EventRow key={item.id} index={i} title={item.title} sub={item.meta} tag={item.source} cover={item.coverUrl} category={item.category}
            warn={item.flags[0] ? FLAG_TEXT[item.flags[0]] : undefined} onPress={() => setPreview(item)}
            right={(
              <View style={styles.rowActions}>
                <RoundBtn label={`Не публиковать «${item.title}»`} onPress={() => act.mutate({ item, action: 'reject' })} disabled={bulk === 'busy'}><X size={18} color={colors.ink} strokeWidth={2.2} /></RoundBtn>
                <RoundBtn solid label={pin ? `Поставить точку: «${item.title}»` : `Опубликовать «${item.title}»`} disabled={bulk === 'busy'}
                  onPress={() => (pin ? setPinning(item) : act.mutate({ item, action: 'publish' }))}><Check size={18} color={colors.paper} strokeWidth={2.4} /></RoundBtn>
              </View>
            )} />
        );
      })}

      {items.length > shown && <Pressable onPress={() => setShown(n => n + 12)} style={[styles.btn, {flex:0}]} accessibilityRole="button"><Text style={styles.btnText}>Показать ещё · {items.length - shown}</Text></Pressable>}
      {preview&&<Overlay label="Карточка события" onClose={()=>setPreview(null)}>
        {preview.coverUrl&&<Image source={{uri:preview.coverUrl}} style={{width:'100%',height:180,borderRadius:18}} resizeMode="cover"/>}
        <Text style={styles.source}>{preview.source}</Text><Text style={styles.sheetTitle}>{preview.title}</Text><Text style={styles.meta}>{preview.meta}</Text>
        <Label text="Описание"/><Text style={styles.meta}>{preview.about||'Описание пока отсутствует'}</Text>
        <Label text="Адрес"/><Text style={styles.meta}>{preview.address||'Нужно уточнить место'}</Text>
        {preview.flags.map(f=><Text key={f} style={styles.flagText}>{FLAG_TEXT[f]}</Text>)}
        <Pressable style={[styles.btn,{flex:0}]} onPress={()=>{setEditing(preview);setPreview(null);}}><Text style={styles.btnText}>Редактировать</Text></Pressable>
        <Pressable style={[styles.btn,styles.primary,{flex:0}]} disabled={bulk === 'busy'} onPress={()=>{if(preview.flags.includes('needs_pin') || (live && !preview.point))setPinning(preview);else act.mutate({item:preview,action:'publish'});setPreview(null);}}><Text style={[styles.btnText,{color:colors.paper}]}>Одобрить</Text></Pressable>
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
  const mapRef = useRef<MapCanvasHandle>(null);
  const camera = useMemo(() => ({ lat: item.point?.lat ?? 43.2579, lon: item.point?.lon ?? 76.9458, zoom: item.point ? 14 : 12 }), [item.point]);
  const [hit, setHit] = useState<{ lat: number; lon: number; name: string } | null>(item.point ? { ...item.point, name: 'Примерное место — проверь на карте' } : null);
  const [state, setState] = useState<'idle' | 'busy' | 'none'>('idle');
  const find = async () => {
    setState('busy');
    try {
      const street = q.replace(/(?:,?\s+(?:дом\s*)?|,\s*)\d+[а-яa-z]?(?:[\/\-]\d+)?\s*$/i, '').trim();
      const queries = street && street !== q.trim() ? [q, street] : [q];
      for (let i = 0; i < queries.length; i++) {
        const url = `https://nominatim.openstreetmap.org/search?format=jsonv2&limit=1&countrycodes=kz&accept-language=ru&bounded=1&viewbox=76.70,43.40,77.20,43.05&q=${encodeURIComponent(`${queries[i]}, Алматы`)}`;
        const response = await fetch(url, { signal: AbortSignal.timeout(10000) });
        if (!response.ok) throw new Error('Поиск недоступен');
        const [r] = await response.json() as { lat: string; lon: string; display_name: string }[];
        const point = r && readPoint({ coordinates: [Number(r.lon), Number(r.lat)] });
        if (!point) continue;
        setHit({ ...point, name: `${i ? 'Примерно · ' : ''}${r.display_name.split(',').slice(0, 3).join(',')}` });
        mapRef.current?.flyTo(point.lat, point.lon, i ? 14 : 15, 0);
        setState('idle'); return;
      }
      setState('none');
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
      {state === 'none' && <Text style={[styles.meta, { color: colors.accentText }]}>Точный адрес не найден. Выбери место на карте</Text>}
      <Text style={styles.meta}>Найденное место может быть приблизительным. Нажми на карте там, где вход в площадку</Text>
      <View style={{ height: 250, borderRadius: 18, overflow: 'hidden' }}>
        <MapCanvas ref={mapRef} theme="paper" camera={camera} onPress={p => { if (p) setHit({ ...p, name: 'Выбрано вручную' }); }} markers={hit ? [{ id: 'chosen', lat: hit.lat, lon: hit.lon, node: <View style={{ width: 24, height: 24, borderRadius: 12, backgroundColor: colors.accent, borderWidth: 3, borderColor: colors.paper }} /> }] : []} />
      </View>
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
  filters: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  fchip: { minHeight: 40, paddingHorizontal: 14, borderRadius: 20, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.line2, justifyContent: 'center' },
  fchipOn: { backgroundColor: colors.ink, borderColor: colors.ink },
  fchipText: { fontFamily: fonts.body600, fontSize: 13.5, color: colors.ink },
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
  listHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  found: { fontFamily: fonts.display700, fontSize: 18, color: colors.ink },
  bulkLink: { minHeight: 44, justifyContent: 'center' },
  bulkText: { fontFamily: fonts.body700, fontSize: 13.5, color: colors.ink, textDecorationLine: 'underline' },
  confirm: { backgroundColor: colors.card, borderRadius: 16, borderWidth: 1, borderColor: colors.line2, padding: 14, gap: 10 },
  confirmT: { fontFamily: fonts.body500, fontSize: 14, lineHeight: 20, color: colors.ink },
  rowActions: { flexDirection: 'row', gap: 6 },
  btn: { flex: 1, height: 44, minHeight: 44, minWidth: 44, flexShrink: 0, borderRadius: 12, borderWidth: 1, borderColor: colors.line2, backgroundColor: colors.card, alignItems: 'center', justifyContent: 'center' },
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
});
