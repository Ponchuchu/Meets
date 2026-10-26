// «Мои места» (переделано 21 октября): что это (дом, работа…) → где (адрес на карте) → своё название (по желанию).
// Адрес и название живут отдельно: раньше выбранный адрес подставлялся в название и путал. На карте — свой значок.
// Избранные места (кофейня, вид, парк…) — со своими значками, видишь только ты; друзьям статус «у кофейни» не уходит.
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { ChevronRight, MapPin, Navigation, PenLine, Plus, X } from 'lucide-react-native';
import { router } from 'expo-router';
import { useMapState } from '../../state/map';
import { useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { supabase, withTimeout } from '../../data/client';
import { PlacePicker } from '../../event/ui/pickers';
import { config } from '../../lib/config';
import { uid } from '../../lib/uid';
import { myId } from '../../live/auth';
import { setShareRules, useMyPos } from '../../live/location';
import { FAV_ICONS, lookOf, PLACE_LOOK, PlacePin } from '../../map/ui/PlacePin';
import { MapCanvas } from '../../map/MapCanvas';
import { deviceStorage } from '../../state/storage';
import { colors, fonts } from '../../theme';
import { Group, Note, Row, SettingsPage } from '../../ui/v6/Settings';

interface Place { id: string; kind: string; title: string; lat: number; lon: number; address?: string | null; auto?: boolean; icon?: string | null }
const useLocalPlaces = create<{ items: Place[] }>()(persist(() => ({ items: [] as Place[] }), { name: 'ryadom-demo-places', storage: deviceStorage() }));
const KINDS = ['home', 'work', 'study', 'gym', 'dacha', 'fav', 'other'] as const;

/** Значок места — тот же, что на карте: круг своего цвета с бликом (FIX5). */
function Disc({ kind, icon, size = 36 }: { kind: string; icon?: string | null; size?: number }) {
  const l = lookOf(kind, icon);
  return (
    <View style={[styles.disc, { width: size, height: size, borderRadius: size / 2, backgroundColor: l.color }]}>
      <View pointerEvents="none" style={[styles.discShine, { width: size * 0.5, height: size * 0.18, borderRadius: size * 0.12, top: size * 0.04 }]} />
      <l.Icon size={size * 0.48} color="#FFFFFF" strokeWidth={2.2} />
    </View>
  );
}

const MAIN = ['home', 'work', 'study', 'gym', 'dacha'] as const;

export default function PlacesPage() {
  const live = config.dataMode !== 'demo';
  const qc = useQueryClient();
  const local = useLocalPlaces((s) => s.items);
  const pos = useMyPos();
  const [editing, setEditing] = useState<Place | null>(null);
  const [picking, setPicking] = useState(false);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const q = useQuery({ queryKey: ['me', 'places', 'list'], enabled: live, queryFn: async () => {
    const r = await withTimeout(supabase().from('user_places_points').select('*').eq('user_id', myId()!));
    if (r.error) throw r.error;
    return r.data as Place[];
  } });
  const list = live ? q.data ?? [] : local;
  const close = () => { setPicking(false); setEditing(null); };
  const nameOf = (p: Place) => p.title?.trim() || lookOf(p.kind, p.icon).name;

  const save = async (remove = false) => {
    if (!editing || busy) return;
    if (!remove && !editing.address && !list.some((p) => p.id === editing.id)) { setError('Выбери адрес на карте'); return; }
    setBusy(true); setError('');
    try {
      if (live) {
        const row = { ...(editing.id ? { id: editing.id } : {}), user_id: myId(), kind: editing.kind, title: editing.title.trim() || null, point: `SRID=4326;POINT(${editing.lon} ${editing.lat})`, auto: false };
        let r = remove
          ? await withTimeout(supabase().from('user_places').delete().eq('id', editing.id).eq('user_id', myId()!))
          : await withTimeout(supabase().from('user_places').upsert({ ...row, address: editing.address ?? null, icon: editing.kind === 'fav' ? editing.icon ?? 'heart' : null }));
        // Сервер ещё без адреса и избранного (миграции 38–39) — сохраняем как «Другое», без новых колонок.
        if (!remove && r.error && /address|icon|kind/.test(r.error.message)) r = await withTimeout(supabase().from('user_places').upsert({ ...row, kind: editing.kind === 'fav' ? 'other' : editing.kind }));
        if (r.error) throw r.error;
        await qc.invalidateQueries({ queryKey: ['me', 'places'] });
      } else {
        useLocalPlaces.setState({ items: remove ? local.filter((p) => p.id !== editing.id) : [...local.filter((p) => p.id !== editing.id), { ...editing, id: editing.id || uid('place') }] });
      }
      close();
      await qc.invalidateQueries({ queryKey: ['me', 'stats'] });
      const places = live ? (await q.refetch()).data ?? [] : useLocalPlaces.getState().items;
      setShareRules({ places: places as import('../../live/geo').Place[] });
    } catch { setError('Не удалось сохранить место. Проверь связь'); } finally { setBusy(false); }
  };

  const start = (kind: string) => { setEditing({ id: '', kind, title: '', lat: pos?.lat ?? 43.2389, lon: pos?.lon ?? 76.8897, address: null, icon: kind === 'fav' ? 'heart' : null }); setError(''); setPicking(true); };

  const mainPlaces = MAIN.map((k) => ({ k, p: list.find((x) => x.kind === k) }));
  const favs = list.filter((p) => p.kind === 'fav' || p.kind === 'other');
  const open = (p: Place) => { setViewing(null); setEditing({ ...p, title: p.title ?? '' }); setError(''); setPicking(false); };
  // Нажатие на место (26 окт.): сначала карточка — где оно, «Показать на карте» и «Маршрут»; изменить — отдельной кнопкой.
  const [viewing, setViewing] = useState<Place | null>(null);
  const showOnMap = (p: Place) => { setViewing(null); useMapState.getState().flyTo({ lat: p.lat, lon: p.lon, zoom: 16 }); router.navigate('/'); };
  const routeTo = (p: Place) => { setViewing(null); router.push({ pathname: '/route', params: { id: `myplace-${p.id}`, lat: String(p.lat), lon: String(p.lon), title: nameOf(p), address: p.address ?? '' } }); };
  // Карта со всеми местами: центр — среднее, масштаб — по разбросу точек.
  const pts = list.filter((p) => Number.isFinite(p.lat) && Number.isFinite(p.lon));
  const spread = pts.length > 1 ? Math.max(...pts.map((p) => Math.abs(p.lat - pts[0].lat) + Math.abs(p.lon - pts[0].lon))) : 0;
  const cam = pts.length ? { lat: pts.reduce((a, p) => a + p.lat, 0) / pts.length, lon: pts.reduce((a, p) => a + p.lon, 0) / pts.length, zoom: spread > 0.15 ? 11 : spread > 0.05 ? 12.3 : spread > 0.01 ? 13.6 : 15 } : null;

  return (
    <SettingsPage title="Мои места" sub="Дом, работа, любимые места — на карте у тебя свои значки. Видишь только ты.">
      {cam && (
        <View style={styles.mapCard}>
          <MapCanvas theme="paper" camera={cam} markers={pts.map((p) => ({ id: p.id, lat: p.lat, lon: p.lon, node: <PlacePin kind={p.kind} icon={p.icon} title={nameOf(p)} label /> }))} threeD still={{ pitch: 35, heading: 0 }} />
          <View pointerEvents="none" style={styles.mapFade} />
          <Text pointerEvents="none" style={styles.mapCount}>{pts.length} {pts.length === 1 ? 'место' : pts.length < 5 ? 'места' : 'мест'} на карте</Text>
        </View>
      )}

      <Text style={styles.cap}>ГЛАВНЫЕ</Text>
      <View style={styles.kinds}>
        {mainPlaces.map(({ k, p }) => (
          <Pressable key={k} onPress={() => (p ? setViewing(p) : start(k))} style={({ pressed }) => [styles.tile, !p && styles.tileEmpty, pressed && styles.pressed]} accessibilityRole="button"
            accessibilityLabel={p ? `${PLACE_LOOK[k].name}: ${p.address ?? ''}` : `Добавить: ${PLACE_LOOK[k].name}`}>
            <View style={styles.tileTop}>
              <Disc kind={k} size={38} />
              {!p && <View style={styles.plus}><Plus size={14} color={colors.ink} strokeWidth={2.6} /></View>}
            </View>
            <Text style={styles.tileTitle} numberOfLines={1}>{p ? nameOf(p) : PLACE_LOOK[k].name}</Text>
            <Text style={styles.tileSub} numberOfLines={2}>{p ? p.address || 'точка на карте' : 'Добавить'}</Text>
          </Pressable>
        ))}
      </View>

      <Text style={styles.cap}>ИЗБРАННОЕ</Text>
      {favs.length > 0 && (
        <Group>
          {favs.map((p, i) => (
            <Row key={p.id} left={<Disc kind={p.kind} icon={p.icon} size={34} />} title={nameOf(p)} sub={p.address || lookOf(p.kind, p.icon).name} last={i === favs.length - 1} onPress={() => setViewing(p)} />
          ))}
        </Group>
      )}
      <Pressable onPress={() => start('fav')} style={({ pressed }) => [styles.addFav, pressed && styles.pressed]} accessibilityRole="button" accessibilityLabel="Добавить любимое место">
        <View style={styles.addFavIcons}>{(['coffee', 'view', 'food'] as const).map((k, i) => <View key={k} style={{ marginLeft: i ? -10 : 0 }}><Disc kind="fav" icon={k} size={30} /></View>)}</View>
        <View style={{ flex: 1 }}>
          <Text style={styles.tileTitle}>Добавить любимое место</Text>
          <Text style={styles.tileSub}>кофейня, вид, парк — со своим значком</Text>
        </View>
        <Plus size={20} color={colors.ink} strokeWidth={2.2} />
      </Pressable>
      {q.isError && <Note>Не удалось загрузить места. Проверь связь.</Note>}
      <Note>Друзья видят только «дома» или «на работе». Точный адрес и название остаются у тебя.</Note>

      <Modal visible={!!viewing} transparent animationType="slide" onRequestClose={() => setViewing(null)}>
        <Pressable style={styles.dim} onPress={() => setViewing(null)} accessibilityLabel="Закрыть">
          {viewing && (
            <Pressable style={[styles.sheet, { padding: 20, paddingBottom: 36, gap: 14 }]} onPress={() => undefined}>
              <View style={styles.head}>
                <Disc kind={viewing.kind} icon={viewing.icon} size={44} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.h} numberOfLines={1}>{nameOf(viewing)}</Text>
                  {!!viewing.address && <Text style={styles.tileSub} numberOfLines={2}>{viewing.address}</Text>}
                </View>
                <Pressable onPress={() => setViewing(null)} style={styles.x} accessibilityRole="button" accessibilityLabel="Закрыть"><X size={20} color={colors.ink} strokeWidth={2.2} /></Pressable>
              </View>
              <View style={[styles.mapCard, { height: 180 }]}>
                <MapCanvas theme="paper" camera={{ lat: viewing.lat, lon: viewing.lon, zoom: 16 }} markers={[{ id: viewing.id, lat: viewing.lat, lon: viewing.lon, node: <PlacePin kind={viewing.kind} icon={viewing.icon} title={nameOf(viewing)} label /> }]} threeD still={{ pitch: 40, heading: 0 }} />
              </View>
              <View style={{ flexDirection: 'row', gap: 10 }}>
                <Pressable onPress={() => showOnMap(viewing)} style={({ pressed }) => [styles.viewBtn, styles.viewMain, pressed && styles.pressed]} accessibilityRole="button">
                  <MapPin size={18} color={colors.paper} strokeWidth={2} /><Text style={[styles.viewText, { color: colors.paper }]}>На карте</Text>
                </Pressable>
                <Pressable onPress={() => routeTo(viewing)} style={({ pressed }) => [styles.viewBtn, pressed && styles.pressed]} accessibilityRole="button">
                  <Navigation size={18} color={colors.ink} strokeWidth={2} /><Text style={styles.viewText}>Маршрут</Text>
                </Pressable>
              </View>
              <Pressable onPress={() => open(viewing)} style={({ pressed }) => [styles.viewBtn, { flex: 0 }, pressed && styles.pressed]} accessibilityRole="button">
                <PenLine size={18} color={colors.ink} strokeWidth={2} /><Text style={styles.viewText}>Изменить место</Text>
              </Pressable>
            </Pressable>
          )}
        </Pressable>
      </Modal>

      <Modal visible={!!editing} transparent animationType="slide" onRequestClose={close}>
        <View style={styles.dim}>
          {editing && (
            <ScrollView style={styles.sheet} contentContainerStyle={{ padding: 20, paddingBottom: 40, gap: 14 }} keyboardShouldPersistTaps="handled">
              <View style={styles.head}>
                <Disc kind={editing.kind} icon={editing.icon} size={44} />
                <Text style={styles.h}>{editing.id ? nameOf(editing) : PLACE_LOOK[editing.kind]?.name ?? 'Место'}</Text>
                <Pressable onPress={close} style={styles.x} accessibilityRole="button" accessibilityLabel="Закрыть"><X size={20} color={colors.ink} strokeWidth={2.2} /></Pressable>
              </View>

              <Text style={styles.cap}>ЧТО ЭТО</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6 }}>
                {KINDS.map((k) => (
                  <Pressable key={k} onPress={() => setEditing({ ...editing, kind: k })} style={[styles.chip, editing.kind === k && styles.chipOn]} accessibilityRole="radio" accessibilityState={{ selected: editing.kind === k }}>
                    <Text style={[styles.chipText, editing.kind === k && { color: colors.paper }]}>{k === 'other' ? 'Другое' : PLACE_LOOK[k].name}</Text>
                  </Pressable>
                ))}
              </ScrollView>

              {editing.kind === 'fav' && (
                <>
                  <Text style={styles.cap}>ЗНАЧОК НА КАРТЕ</Text>
                  <View style={styles.icons}>
                    {Object.entries(FAV_ICONS).map(([k, l]) => (
                      <Pressable key={k} onPress={() => setEditing({ ...editing, icon: k })} style={[styles.iconPick, editing.icon === k && { borderColor: l.color, backgroundColor: '#FFFFFF' }]} accessibilityRole="radio" accessibilityState={{ selected: editing.icon === k }} accessibilityLabel={l.name}>
                        <View style={[styles.disc, { width: 34, height: 34, borderRadius: 17, backgroundColor: l.color }]}><l.Icon size={17} color="#FFFFFF" strokeWidth={2.2} /></View>
                        <Text style={styles.iconName} numberOfLines={1}>{l.name}</Text>
                      </Pressable>
                    ))}
                  </View>
                </>
              )}

              <Text style={styles.cap}>ГДЕ</Text>
              {picking ? (
                <PlacePicker value={{ point: { lat: editing.lat, lon: editing.lon }, address: editing.address ?? '', entrance: '', floor: '', apt: '' }}
                  onDone={(v) => { setEditing({ ...editing, lat: v.point?.lat ?? editing.lat, lon: v.point?.lon ?? editing.lon, address: v.address }); setPicking(false); }} />
              ) : (
                <Pressable onPress={() => setPicking(true)} style={({ pressed }) => [styles.addr, pressed && styles.pressed]} accessibilityRole="button" accessibilityLabel="Выбрать адрес на карте">
                  <MapPin size={18} color={colors.ink} strokeWidth={2} />
                  <Text style={[styles.addrText, !editing.address && { color: colors.muted }]} numberOfLines={2}>{editing.address || 'Выбрать адрес на карте'}</Text>
                  <ChevronRight size={18} color={colors.muted} strokeWidth={2} />
                </Pressable>
              )}

              <Text style={styles.cap}>НАЗВАНИЕ · ПО ЖЕЛАНИЮ</Text>
              <TextInput value={editing.title} onChangeText={(title) => setEditing({ ...editing, title })} placeholder={editing.kind === 'other' ? 'Например: у бабушки' : editing.kind === 'fav' ? 'Например: кофейня на Панфилова' : PLACE_LOOK[editing.kind]?.name}
                placeholderTextColor={colors.muted} accessibilityLabel="Название места" style={styles.input} maxLength={60} />

              {!!error && <Text style={styles.err}>{error}</Text>}
              <Pressable disabled={busy || picking} onPress={() => void save()} style={[styles.save, (busy || picking) && { opacity: 0.5 }]} accessibilityRole="button">
                <Text style={styles.saveText}>{busy ? 'Сохраняю…' : 'Сохранить'}</Text>
              </Pressable>
              {list.some((p) => p.id === editing.id) && <Pressable onPress={() => void save(true)} style={styles.del} accessibilityRole="button"><Text style={styles.delText}>Удалить место</Text></Pressable>}
            </ScrollView>
          )}
        </View>
      </Modal>
    </SettingsPage>
  );
}

const styles = StyleSheet.create({
  viewBtn: { flex: 1, minHeight: 50, borderRadius: 16, backgroundColor: colors.card, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  viewMain: { backgroundColor: colors.ink },
  viewText: { fontFamily: fonts.body700, fontSize: 15, color: colors.ink },
  disc: { alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: '#FFFFFF', overflow: 'hidden', boxShadow: '0 4px 10px -4px rgba(23,22,26,0.4)' },
  discShine: { position: 'absolute', backgroundColor: 'rgba(255,255,255,0.28)' },
  mapCard: { height: 210, borderRadius: 24, overflow: 'hidden', backgroundColor: '#DDD8CB', boxShadow: '0 10px 24px -16px rgba(23,22,26,0.5)' },
  mapFade: { position: 'absolute', left: 0, right: 0, bottom: 0, height: 44, backgroundColor: 'rgba(23,22,26,0.18)' },
  mapCount: { position: 'absolute', left: 14, bottom: 12, fontFamily: fonts.body700, fontSize: 13.5, color: '#FFFFFF' },
  tile: { width: '48.5%', minHeight: 116, padding: 14, borderRadius: 22, backgroundColor: '#FBFAF6', gap: 3, boxShadow: '0 1px 2px rgba(23,22,26,0.06), 0 8px 18px -14px rgba(23,22,26,0.4)' },
  tileEmpty: { backgroundColor: 'transparent', borderWidth: 1.5, borderStyle: 'dashed', borderColor: 'rgba(23,22,26,0.18)', boxShadow: 'none' },
  tileTop: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 8 },
  plus: { width: 26, height: 26, borderRadius: 13, backgroundColor: 'rgba(23,22,26,0.08)', alignItems: 'center', justifyContent: 'center' },
  tileTitle: { fontFamily: fonts.display700, fontSize: 15.5, color: colors.ink },
  tileSub: { fontFamily: fonts.body500, fontSize: 12.5, lineHeight: 16, color: colors.muted2 },
  addFav: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14, borderRadius: 22, backgroundColor: '#F6E3EA' },
  addFavIcons: { flexDirection: 'row' },
  cap: { fontFamily: fonts.mono600, fontSize: 10.5, letterSpacing: 0.8, color: colors.muted, marginTop: 4 },
  kinds: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', rowGap: 10 },
  dim: { flex: 1, backgroundColor: 'rgba(23,22,26,0.4)', justifyContent: 'flex-end' },
  sheet: { maxHeight: '94%', backgroundColor: colors.paper, borderTopLeftRadius: 28, borderTopRightRadius: 28 },
  head: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  h: { flex: 1, fontFamily: fonts.display700, fontSize: 23, color: colors.ink },
  x: { width: 44, height: 44, borderRadius: 22, backgroundColor: colors.sand, alignItems: 'center', justifyContent: 'center' },
  chip: { height: 40, paddingHorizontal: 14, borderRadius: 20, backgroundColor: colors.sand, justifyContent: 'center' },
  chipOn: { backgroundColor: colors.ink },
  chipText: { fontFamily: fonts.body600, fontSize: 14, color: colors.ink },
  addr: { flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: 56, paddingHorizontal: 14, borderRadius: 16, backgroundColor: colors.card },
  addrText: { flex: 1, fontFamily: fonts.body500, fontSize: 15, color: colors.ink },
  input: { fontFamily: fonts.body500, fontSize: 15, color: colors.ink, height: 52, paddingHorizontal: 14, borderRadius: 16, backgroundColor: colors.card },
  icons: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  iconPick: { width: '23.5%', alignItems: 'center', gap: 4, paddingVertical: 8, borderRadius: 14, borderWidth: 2, borderColor: 'transparent', backgroundColor: colors.card },
  iconName: { fontFamily: fonts.body500, fontSize: 11.5, color: colors.ink },
  err: { fontFamily: fonts.body500, fontSize: 14, color: colors.accentText },
  save: { height: 54, borderRadius: 17, backgroundColor: colors.ink, alignItems: 'center', justifyContent: 'center', marginTop: 4 },
  saveText: { fontFamily: fonts.body700, fontSize: 16, color: colors.paper },
  del: { height: 44, alignItems: 'center', justifyContent: 'center' },
  delText: { fontFamily: fonts.body600, fontSize: 15, color: colors.accentText },
  pressed: { transform: [{ scale: 0.97 }] },
});
