// «Мои места» (переделано 21 октября): что это (дом, работа…) → где (адрес на карте) → своё название (по желанию).
// Адрес и название живут отдельно: раньше выбранный адрес подставлялся в название и путал. На карте — свой значок.
// Избранные места (кофейня, вид, парк…) — со своими значками, видишь только ты; друзьям статус «у кофейни» не уходит.
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { ChevronRight, MapPin, X } from 'lucide-react-native';
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
import { FAV_ICONS, lookOf, PLACE_LOOK } from '../../map/ui/PlacePin';
import { deviceStorage } from '../../state/storage';
import { colors, fonts } from '../../theme';
import { Group, Note, Row, SettingsPage } from '../../ui/v6/Settings';

interface Place { id: string; kind: string; title: string; lat: number; lon: number; address?: string | null; auto?: boolean; icon?: string | null }
const useLocalPlaces = create<{ items: Place[] }>()(persist(() => ({ items: [] as Place[] }), { name: 'ryadom-demo-places', storage: deviceStorage() }));
const KINDS = ['home', 'work', 'study', 'gym', 'dacha', 'fav', 'other'] as const;

function Disc({ kind, icon, size = 36 }: { kind: string; icon?: string | null; size?: number }) {
  const l = lookOf(kind, icon);
  return <View style={[styles.disc, { width: size, height: size, borderRadius: size / 2, backgroundColor: l.color }]}><l.Icon size={size * 0.48} color="#FFFFFF" strokeWidth={2.2} /></View>;
}

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
  // Дом, работа и т. п. — по одному; избранных и «другого» — сколько угодно.
  const taken = new Set(list.map((p) => p.kind).filter((k) => k !== 'fav' && k !== 'other'));

  return (
    <SettingsPage title="Мои места" sub="Дом, работа, зал — на карте у тебя будут свои значки.">
      {list.length > 0 && (
        <Group>
          {list.map((p, i) => (
            <Row key={p.id} left={<Disc kind={p.kind} icon={p.icon} size={34} />} title={nameOf(p)} sub={p.address || lookOf(p.kind, p.icon).name} last={i === list.length - 1}
              onPress={() => { setEditing({ ...p, title: p.title ?? '' }); setError(''); setPicking(false); }} />
          ))}
        </Group>
      )}
      <Text style={styles.cap}>ДОБАВИТЬ</Text>
      <View style={styles.kinds}>
        {KINDS.filter((k) => !taken.has(k)).map((k) => (
          <Pressable key={k} onPress={() => start(k)} style={({ pressed }) => [styles.kind, pressed && styles.pressed]} accessibilityRole="button" accessibilityLabel={`Добавить: ${PLACE_LOOK[k].name}`}>
            <Disc kind={k} /><Text style={styles.kindText}>{k === 'other' ? 'Другое' : PLACE_LOOK[k].name}</Text>
          </Pressable>
        ))}
      </View>
      {q.isError && <Note>Не удалось загрузить места. Проверь связь.</Note>}
      <Note>Друзья видят только «дома» или «на работе». Точный адрес и название остаются у тебя.</Note>

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
  disc: { alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: '#FFFFFF', boxShadow: '0 4px 10px -4px rgba(23,22,26,0.4)' },
  cap: { fontFamily: fonts.mono600, fontSize: 10.5, letterSpacing: 0.8, color: colors.muted, marginTop: 4 },
  kinds: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  kind: { width: '31.5%', minHeight: 92, borderRadius: 18, backgroundColor: colors.card, alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 12 },
  kindText: { fontFamily: fonts.body600, fontSize: 13.5, color: colors.ink },
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
