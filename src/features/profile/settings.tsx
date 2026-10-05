// Настройки v6 — design/png/V6ProfileSettings.png и подэкраны (V6.md §8.3). Каждый переключатель сразу
// сохраняется на сервере (profile_settings), без кнопки «Сохранить». Невидимка и «кто видит» — таблица visibility.
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { router } from 'expo-router';
import {
  AtSign, Ban, Bell, CalendarDays, CircleHelp, Clock, Eye, Ghost, Home, Image as ImageIcon, KeyRound, Languages, LogOut, Map, MessageCircle,
  MessagesSquare, Moon, Phone, ShieldCheck, Smartphone, Star, Sticker, Text as TextIcon, Trash2, User, Users,
} from 'lucide-react-native';
import { useEffect, useState } from 'react';
import { Alert, Linking, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { deleteAccount, signOut as authSignOut } from '../../auth/service';
import { setMapTelemetry } from '../../map/telemetry';
import { supabase } from '../../data/client';
import { getFriends, getProfile, getSettings, getVisibility, saveProfile, setSetting, setVisibility, type Visibility } from '../../live/api';
import { myId, useAuth } from '../../live/auth';
import { queryClient } from '../../live/query';
import { useSession } from '../../state/session';
import { colors, fonts } from '../../theme';
import { Cap, Group, Note, Row, SettingsPage, ToggleRow } from '../../ui/v6/Settings';

const VERSION = '0.6.0';
const maskPhone = (p?: string | null) => { const d = (p ?? '').replace(/\D/g, '').slice(-10); return d.length === 10 ? `+7 ${d.slice(0, 3)} ••• •• ${d.slice(8)}` : ''; };
const plural = (n: number, a: string, b: string, c: string) => { const m10 = n % 10, m100 = n % 100; return m10 === 1 && m100 !== 11 ? a : m10 >= 2 && m10 <= 4 && (m100 < 10 || m100 >= 20) ? b : c; };

/** Настройки ключ/значение с сервера: читаем один раз, пишем сразу (оптимистично). */
function useSettingsKV() {
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ['me', 'settings'], queryFn: getSettings });
  const get = <T,>(k: string, def: T): T => (q.data && k in q.data ? (q.data[k] as T) : def);
  const set = (k: string, v: unknown) => {
    qc.setQueryData(['me', 'settings'], (old: Record<string, unknown> | undefined) => ({ ...(old ?? {}), [k]: v }));
    void setSetting(k, v).catch(() => void qc.invalidateQueries({ queryKey: ['me', 'settings'] }));
  };
  return { get, set };
}

function useVis() {
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ['me', 'visibility'], queryFn: getVisibility });
  const set = (p: Partial<Visibility>) => {
    qc.setQueryData(['me', 'visibility'], (old: Visibility | undefined) => ({ ...(old as Visibility), ...p }));
    void setVisibility(p).catch(() => void qc.invalidateQueries({ queryKey: ['me', 'visibility'] }));
  };
  return { v: q.data, set };
}

export function SettingsRoot() {
  const phone = useAuth((s) => s.session?.user.phone);
  const { v } = useVis();
  const { get } = useSettingsKV();
  const places = useQuery({ queryKey: ['me', 'places'], queryFn: async () => ((await supabase().from('user_places').select('kind').eq('user_id', myId() ?? '')).data ?? []) as { kind: string }[] });
  const blocks = useQuery({ queryKey: ['me', 'blocks'], queryFn: async () => ((await supabase().from('blocks').select('blocked').eq('blocker', myId() ?? '')).data ?? []) as { blocked: string }[] });
  const go = (p: string) => router.push({ pathname: '/settings/[page]', params: { page: p } });
  const who = !v || v.mode === 'all' ? 'все друзья' : v.mode === 'except' ? 'все, кроме…' : 'только…';
  const quiet = get<string>('quiet', '23–08');
  const theme = get<string>('theme', 'system');
  const pl = places.data ?? [];
  return (
    <SettingsPage title="Настройки">
      <Cap>АККАУНТ</Cap>
      <Group><Row Icon={User} title="Номер, имя, @ник" value={maskPhone(phone)} onPress={() => go('account')} last /></Group>
      <Cap>ПРИВАТНОСТЬ</Cap>
      <Group>
        <Row Icon={Eye} title="Кто видит, где я" value={who} onPress={() => go('privacy')} />
        <Row Icon={Home} title="Мои места" value={pl.length ? `${pl.length} ${plural(pl.length, 'место', 'места', 'мест')}` : 'добавить'} onPress={() => go('places')} />
        <Row Icon={Ban} title="Чёрный список" value={String(blocks.data?.length ?? 0)} onPress={() => go('black')} last />
      </Group>
      <Cap>УВЕДОМЛЕНИЯ И ЧАТЫ</Cap>
      <Group>
        <Row Icon={Bell} title="Уведомления" value={`тихо ${quiet}`} onPress={() => go('notify')} />
        <Row Icon={MessageCircle} title="Сообщения и стикеры" onPress={() => go('chats')} last />
      </Group>
      <Cap>ЕЩЁ</Cap>
      <Group>
        <Row Icon={Moon} title="Тема" value={theme === 'light' ? 'светлая' : theme === 'dark' ? 'тёмная' : 'как в системе'} onPress={() => go('theme')} />
        <Row Icon={Languages} title="Язык" value="русский" onPress={() => go('language')} />
        <Row Icon={Map} title="О карте и данных" onPress={() => go('map')} />
        <Row Icon={CircleHelp} title="Помощь и вопросы" onPress={() => go('help')} last />
      </Group>
      <Text style={styles.ver}>рядом. {VERSION} · альфа</Text>
    </SettingsPage>
  );
}

function AccountPage() {
  const phone = useAuth((s) => s.session?.user.phone);
  const qc = useQueryClient();
  const prof = useQuery({ queryKey: ['me', 'profile'], queryFn: () => getProfile() });
  const [edit, setEdit] = useState<null | 'name' | 'handle'>(null);
  const [val, setVal] = useState('');
  const p = prof.data;
  const save = async () => {
    const v = val.trim();
    if (!v || !edit) return;
    await saveProfile({ name: p?.name, [edit]: edit === 'handle' ? v.replace(/^@/, '').toLowerCase() : v }).catch(() => Alert.alert('Не получилось', edit === 'handle' ? 'Такой ник уже занят' : 'Проверь связь'));
    setEdit(null);
    void qc.invalidateQueries({ queryKey: ['me', 'profile'] });
  };
  const out = async () => {
    useSession.getState().signOut();
    await authSignOut();
    queryClient.clear();
    await AsyncStorage.removeItem('ryadom-cache-v6').catch(() => undefined);
    router.replace('/hello');
  };
  const del = () => Alert.alert('Удалить аккаунт?', 'Всё удалится через 30 дней, можно передумать.', [
    { text: 'Отмена', style: 'cancel' },
    { text: 'Удалить', style: 'destructive', onPress: () => void deleteAccount().then((ok) => (ok ? out() : Alert.alert('Не получилось', 'Попробуй позже'))) },
  ]);
  return (
    <SettingsPage title="Аккаунт">
      <Cap>ПРОФИЛЬ</Cap>
      <Group>
        <Row Icon={ImageIcon} title="Фото" value={p?.photo_url ? 'своё' : `буква ${(p?.name ?? ' ')[0]}`} onPress={() => router.navigate('/me')} />
        <Row Icon={User} title="Имя" value={p?.name ?? ''} onPress={() => { setVal(p?.name ?? ''); setEdit('name'); }} />
        <Row Icon={AtSign} title="Ник" value={p?.handle ? `@${p.handle}` : 'не задан'} onPress={() => { setVal(p?.handle ?? ''); setEdit('handle'); }} last />
      </Group>
      {edit && (
        <View style={styles.edit}>
          <TextInput value={val} onChangeText={setVal} autoFocus style={styles.input} autoCapitalize={edit === 'handle' ? 'none' : 'words'} maxLength={edit === 'handle' ? 24 : 40}
            returnKeyType="done" onSubmitEditing={() => void save()} accessibilityLabel={edit === 'name' ? 'Имя' : 'Ник'} />
          <Pressable onPress={() => void save()} style={styles.saveBtn} accessibilityRole="button"><Text style={styles.saveText}>Готово</Text></Pressable>
        </View>
      )}
      <Cap>ВХОД</Cap>
      <Group>
        <Row Icon={Phone} title="Номер" value={maskPhone(phone)} />
        <Row Icon={KeyRound} title="Apple и Google" value="не привязаны" />
        <Row Icon={Smartphone} title="Где я вошёл" value="1 телефон" last />
      </Group>
      <Group>
        <Row Icon={LogOut} title="Выйти" danger onPress={() => void out()} />
        <Row Icon={Trash2} title="Удалить аккаунт" sub="всё удалится через 30 дней, можно передумать" danger onPress={del} last />
      </Group>
    </SettingsPage>
  );
}

const HOURS = [1, 8, 24];
function PrivacyPage() {
  const { v, set } = useVis();
  const friends = useQuery({ queryKey: ['friends'], queryFn: getFriends });
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => { const t = setInterval(() => setNow(Date.now()), 30e3); return () => clearInterval(t); }, []);
  const until = v?.invisible_until ? new Date(v.invisible_until).getTime() : 0;
  const active = until > now;
  const left = active ? Math.ceil((until - now) / 60000) : 0;
  const n = friends.data?.length ?? 0;
  const modes: { m: Visibility['mode']; t: string; s: string }[] = [
    { m: 'all', t: 'Все друзья', s: `${n} ${plural(n, 'человек', 'человека', 'человек')}` },
    { m: 'except', t: 'Все, кроме…', s: 'выбери, от кого скрыться' },
    { m: 'only', t: 'Только…', s: 'видят только выбранные' },
  ];
  return (
    <SettingsPage title="Кто видит, где я">
      <Group>
        {modes.map((x, i) => (
          <Row key={x.m} title={x.t} sub={x.s} last={i === 2} onPress={() => set({ mode: x.m })}
            left={<View style={[styles.radio, v?.mode === x.m && styles.radioOn]}>{v?.mode === x.m && <View style={styles.radioDot} />}</View>} />
        ))}
      </Group>
      <View style={styles.ghost}>
        <View style={styles.ghostHead}>
          <View style={styles.ghostIcon}><Ghost size={24} color={colors.ink} strokeWidth={1.8} /></View>
          <View style={{ flex: 1 }}>
            <Text style={styles.ghostTitle}>Невидимка</Text>
            <Text style={styles.ghostSub}>{active ? `ещё ${left >= 60 ? `${Math.floor(left / 60)} ч ${left % 60} мин` : `${left} мин`} — нажми, чтобы выключить` : 'точка замрёт, потом включится сама'}</Text>
          </View>
        </View>
        <View style={styles.hours}>
          {HOURS.map((h) => {
            const on = active && Math.abs(until - (now + h * 3600e3)) < h * 3600e3 && Math.round((until - now) / 3600e3) <= h && Math.round((until - now) / 3600e3) > (HOURS[HOURS.indexOf(h) - 1] ?? 0);
            return (
              <Pressable key={h} onPress={() => set({ invisible_until: on ? null : new Date(Date.now() + h * 3600e3).toISOString() })} style={[styles.hour, on && styles.hourOn]} accessibilityRole="button" accessibilityState={{ selected: on }}>
                <Text style={styles.hourText}>{h} {plural(h, 'час', 'часа', 'часов')}</Text>
              </Pressable>
            );
          })}
        </View>
      </View>
      <Group>
        <ToggleRow title="Только район" sub="вместо точки — «в Алмалы»" on={!!v?.district_only} onChange={(district_only) => set({ district_only })} />
        <ToggleRow title="Статусы" sub="«на работе», «в кофейне»" on={v?.statuses ?? true} onChange={(statuses) => set({ statuses })} last />
      </Group>
      <Note Icon={ShieldCheck}>Незнакомые люди никогда не видят тебя на карте.</Note>
    </SettingsPage>
  );
}

function NotifyPage() {
  const { get, set } = useSettingsKV();
  const t = (k: string, def = true) => ({ on: get<boolean>(k, def), onChange: (v: boolean) => set(k, v) });
  return (
    <SettingsPage title="Уведомления" sub="Пуши приходят как в Telegram: зажал — ответил, не открывая.">
      <Cap>СООБЩЕНИЯ</Cap>
      <Group>
        <ToggleRow Icon={MessageCircle} title="Сообщения" {...t('n_messages')} />
        <ToggleRow Icon={Sticker} title="Стикеры" {...t('n_stickers')} />
        <ToggleRow Icon={TextIcon} title="Показывать текст в пуше" sub="выключи — будет просто «Новое сообщение»" {...t('n_preview')} last />
      </Group>
      <Cap>ДРУЗЬЯ</Cap>
      <Group>
        <ToggleRow Icon={Users} title="Друг рядом" sub="ближе 500 м, не чаще раза в час" {...t('n_near')} />
        <ToggleRow Icon={Users} title="Друзья встретились" {...t('n_met')} />
        <ToggleRow Icon={CalendarDays} title="Зовут в планы" {...t('n_invites')} last />
      </Group>
      <Cap>СОБЫТИЯ</Cap>
      <Group>
        <ToggleRow Icon={Clock} title="Напомнить о плане" sub="за 1 час" {...t('n_remind')} />
        <ToggleRow Icon={Star} title="Новое по вкусу" sub="раз в день, в 18:00" {...t('n_taste')} />
        <ToggleRow Icon={Moon} title="Тихие часы" sub="23:00–08:00" {...t('n_quiet')} last />
      </Group>
    </SettingsPage>
  );
}

function ChatsPage() {
  const { get, set } = useSettingsKV();
  const t = (k: string, def = true) => ({ on: get<boolean>(k, def), onChange: (v: boolean) => set(k, v) });
  return (
    <SettingsPage title="Сообщения и стикеры">
      <Cap>ЧАТЫ</Cap>
      <Group>
        <ToggleRow title="Показывать, что прочитал" sub="выключишь — и сам не увидишь чужие галочки" {...t('c_read')} />
        <ToggleRow title="Показывать «печатает…»" {...t('c_typing')} />
        <ToggleRow title="Писать могут все с запросом" sub="выключи — только друзья" {...t('c_requests')} last />
      </Group>
      <Cap>ЧАТЫ СОБЫТИЙ</Cap>
      <Group><ToggleRow title="Удалять через 7 дней после события" {...t('c_autodelete')} last /></Group>
      <Cap>СТИКЕРЫ И ФОТО</Cap>
      <Group>
        <ToggleRow title="Двигающиеся стикеры" {...t('c_anim')} />
        <ToggleRow title="Сохранять фото в галерею" {...t('c_save', false)} last />
      </Group>
    </SettingsPage>
  );
}

function BlackPage() {
  const qc = useQueryClient();
  const q = useQuery({
    queryKey: ['me', 'blocks', 'list'],
    queryFn: async () => {
      const rows = ((await supabase().from('blocks').select('blocked').eq('blocker', myId() ?? '')).data ?? []) as { blocked: string }[];
      if (!rows.length) return [];
      return ((await supabase().from('profiles').select('id,name,handle').in('id', rows.map((r) => r.blocked))).data ?? []) as { id: string; name: string; handle: string | null }[];
    },
  });
  const unblock = async (id: string) => {
    await supabase().from('blocks').delete().eq('blocker', myId() ?? '').eq('blocked', id);
    void qc.invalidateQueries({ queryKey: ['me', 'blocks'] });
  };
  return (
    <SettingsPage title="Чёрный список" sub="Они не видят тебя на карте, не пишут и не зовут. И не узнают, что ты их заблокировал.">
      <Group>
        {(q.data ?? []).map((p, i, a) => (
          <Row key={p.id} title={p.name} sub={p.handle ? `@${p.handle}` : undefined} last={i === a.length - 1}
            right={<Pressable onPress={() => void unblock(p.id)} style={styles.small} accessibilityRole="button"><Text style={styles.smallText}>Убрать</Text></Pressable>} />
        ))}
        {!q.data?.length && <Row title="Пока никого" sub="Заблокировать можно в чате или в профиле человека" last />}
      </Group>
    </SettingsPage>
  );
}

const KIND_RU: Record<string, string> = { home: 'Дом', work: 'Работа', study: 'Учёба', gym: 'Зал', dacha: 'Дача', other: 'Другое' };
function PlacesPage() {
  const q = useQuery({ queryKey: ['me', 'places', 'list'], queryFn: async () => ((await supabase().from('user_places').select('id,kind,title,auto').eq('user_id', myId() ?? '')).data ?? []) as { id: string; kind: string; title: string | null; auto: boolean }[] });
  return (
    <SettingsPage title="Мои места" sub="Нашли сами. Ошиблись — поменяй.">
      <Group>
        {(q.data ?? []).map((p, i, a) => <Row key={p.id} Icon={Home} title={p.title ?? KIND_RU[p.kind] ?? p.kind} sub={p.auto ? 'определили сами' : 'ты добавил'} last={i === a.length - 1} />)}
        {!q.data?.length && <Row Icon={Home} title="Пока мест нет" sub="Дом и работу определим сами за пару дней" last />}
      </Group>
      <Note Icon={ShieldCheck}>Друзья видят только «на работе» или «дома» — без адреса и без названия офиса.</Note>
    </SettingsPage>
  );
}

function ThemePage() {
  const { get, set } = useSettingsKV();
  const cur = get<string>('theme', 'system');
  return (
    <SettingsPage title="Тема">
      <Group>
        {[['system', 'Как в системе'], ['light', 'Светлая'], ['dark', 'Тёмная']].map(([k, t], i) => (
          <Row key={k} title={t} last={i === 2} onPress={() => set('theme', k)}
            left={<View style={[styles.radio, cur === k && styles.radioOn]}>{cur === k && <View style={styles.radioDot} />}</View>} />
        ))}
      </Group>
      <Note>Карта ночью темнеет сама — с 20:00 до 7:00.</Note>
    </SettingsPage>
  );
}

function LanguagePage() {
  return (
    <SettingsPage title="Язык">
      <Group><Row Icon={Languages} title="Русский" right={<View style={[styles.radio, styles.radioOn]}><View style={styles.radioDot} /></View>} last /></Group>
      <Note>Казахский и английский — скоро.</Note>
    </SettingsPage>
  );
}

function HelpPage() {
  const setTut = useSession((s) => s.setTutorialDone);
  return (
    <SettingsPage title="Помощь и вопросы">
      <Group>
        <Row Icon={CircleHelp} title="Показать подсказки снова" onPress={() => { setTut(false); void setSetting('tutorial_done', false); router.navigate('/'); }} />
        <Row Icon={MessagesSquare} title="Написать разработчику" onPress={() => void Linking.openURL('https://t.me/')} last />
      </Group>
    </SettingsPage>
  );
}

/** «О карте и данных» (FIX1 п. 7): полная атрибуция Mapbox/OSM, «Улучшить карту», телеметрия. */
function MapDataPage() {
  const { get, set } = useSettingsKV();
  return (
    <SettingsPage title="О карте и данных">
      <Group>
        <Row title="© Mapbox" onPress={() => void Linking.openURL('https://www.mapbox.com/about/maps/')} />
        <Row title="© участники OpenStreetMap" onPress={() => void Linking.openURL('https://www.openstreetmap.org/copyright')} />
        <Row title="Улучшить карту" onPress={() => void Linking.openURL('https://apps.mapbox.com/feedback/')} />
        <ToggleRow title="Телеметрия Mapbox" sub="анонимные данные помогают улучшать карту" on={get<boolean>('mapbox_telemetry', false)} onChange={(v) => { set('mapbox_telemetry', v); setMapTelemetry(v); }} last />
      </Group>
      <Note>Пробки — TomTom. Погода — Open-Meteo. Остановки автобусов — OpenStreetMap.</Note>
    </SettingsPage>
  );
}

export function SettingsSubPage({ page }: { page: string }) {
  switch (page) {
    case 'account': return <AccountPage />;
    case 'privacy': return <PrivacyPage />;
    case 'notify': return <NotifyPage />;
    case 'chats': return <ChatsPage />;
    case 'black': return <BlackPage />;
    case 'places': return <PlacesPage />;
    case 'theme': return <ThemePage />;
    case 'language': return <LanguagePage />;
    case 'help': return <HelpPage />;
    case 'map': return <MapDataPage />;
    default: return <SettingsRoot />;
  }
}

const styles = StyleSheet.create({
  ver: { textAlign: 'center', fontFamily: fonts.mono500, fontSize: 11.5, color: colors.muted, marginTop: 14 },
  edit: { flexDirection: 'row', gap: 8, alignItems: 'center' },
  input: { flex: 1, height: 50, borderRadius: 14, borderWidth: 2, borderColor: colors.ink, backgroundColor: '#FBFAF6', paddingHorizontal: 14, fontFamily: fonts.body600, fontSize: 16, color: colors.ink },
  saveBtn: { height: 50, paddingHorizontal: 18, borderRadius: 14, backgroundColor: colors.ink, justifyContent: 'center' },
  saveText: { fontFamily: fonts.body700, fontSize: 15, color: colors.paper },
  radio: { width: 24, height: 24, borderRadius: 12, borderWidth: 2, borderColor: '#BDB6A8', alignItems: 'center', justifyContent: 'center' },
  radioOn: { borderColor: colors.accent },
  radioDot: { width: 12, height: 12, borderRadius: 6, backgroundColor: colors.accent },
  ghost: { borderRadius: 22, backgroundColor: '#FBFAF6', padding: 16, gap: 14 },
  ghostHead: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  ghostIcon: { width: 48, height: 48, borderRadius: 14, backgroundColor: '#ECE7DC', alignItems: 'center', justifyContent: 'center' },
  ghostTitle: { fontFamily: fonts.display700, fontSize: 18, color: colors.ink },
  ghostSub: { fontFamily: fonts.body400, fontSize: 13, color: colors.muted2 },
  hours: { flexDirection: 'row', gap: 8 },
  hour: { flex: 1, height: 44, borderRadius: 13, backgroundColor: '#ECE7DC', alignItems: 'center', justifyContent: 'center' },
  hourOn: { backgroundColor: colors.accent },
  hourText: { fontFamily: fonts.body700, fontSize: 14.5, color: colors.ink },
  small: { height: 34, paddingHorizontal: 12, borderRadius: 10, backgroundColor: '#ECE7DC', justifyContent: 'center' },
  smallText: { fontFamily: fonts.body700, fontSize: 13.5, color: colors.ink },
});
