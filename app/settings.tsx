// «Настройки» — design/png/Settings.png. «Удалить аккаунт» обязателен по правилам App Store.
import AsyncStorage from '@react-native-async-storage/async-storage';
import { router } from 'expo-router';
import { useState } from 'react';
import { Image, Linking, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { photo } from '../src/data/photos';
import { useFeed } from '../src/state/feed';
import { usePlans } from '../src/state/plans';
import { useProfile, type Settings } from '../src/state/profile';
import { useSession } from '../src/state/session';
import { colors, fonts } from '../src/theme';
import { Ic, IC } from '../src/ui/Ic';
import { BackButton, Segments } from '../src/ui/kit';
import { Cap, Group, Row, SwitchRow } from '../src/ui/Section';
import { Backdrop, BottomSheet } from '../src/ui/sheet';
import { useChat } from '../src/state/chat';
import { deleteAccount, signOut as authSignOut } from '../src/auth/service';
import { savePushPrefs } from '../src/notify/register';

export default function SettingsScreen() {
  const insets = useSafeAreaInsets();
  const s = useProfile((x) => x.settings);
  const set = useProfile((x) => x.setSettings);
  const marker = useProfile((x) => x.marker);
  const setMarker = useProfile((x) => x.setMarker);
  const draft = useSession((x) => x.draft);
  const signOut = useSession((x) => x.signOut);
  const [confirm, setConfirm] = useState<null | 'out' | 'delete'>(null);
  const [deleteFailed, setDeleteFailed] = useState(false);
  const blockedCount = Object.keys(useChat((c) => c.blocked)).length;
  const setN = (k: keyof Settings['notif'], v: boolean) => {
    const notif = { ...s.notif, [k]: v };
    set({ notif });
    void savePushPrefs(notif);
  };

  const leave = async (wipe: boolean) => {
    // Удаление: сначала сервер (delete_my_account стирает человека и всё связанное), потом устройство.
    if (wipe) {
      if (!(await deleteAccount())) {
        setDeleteFailed(true);
        return;
      }
      usePlans.setState({ going: {}, saved: {}, company: {}, invites: [], meetups: [], declined: {} });
      useFeed.setState({ signals: [], decided: {}, history: [] });
      useProfile.setState({ arrivals: [], suggestions: [] });
      await AsyncStorage.multiRemove(['ryadom-plans', 'ryadom-feed', 'ryadom-profile']).catch(() => {});
    }
    signOut();
    void authSignOut();
    router.replace('/start');
  };

  return (
    <View style={styles.root}>
      <ScrollView contentContainerStyle={{ paddingTop: Math.max(50, insets.top + 6), paddingHorizontal: 16, paddingBottom: 40 + insets.bottom, gap: 10 }}>
        <View style={styles.head}>
          <BackButton onPress={() => (router.canGoBack() ? router.back() : router.replace('/me'))} />
          <Text style={styles.h1} accessibilityRole="header">Настройки</Text>
        </View>

        <Group>
          <Row title={draft.name || 'Данил'} sub="+7 7•• ••• •• 34"
            right={<Pressable onPress={() => router.push('/me')} hitSlop={8} accessibilityRole="link"><Text style={styles.link}>Профиль</Text></Pressable>} last>
          </Row>
        </Group>

        <Cap>INSTAGRAM</Cap>
        <Group>
          <Row title="@fromvtk" sub="подключён" right={<View style={styles.outline}><Text style={styles.outlineText}>Отключить</Text></View>} />
          <SwitchRow title="Аватарка из Instagram" sub="Обновляется сама. Нажми на фото в профиле, чтобы поставить своё" on={s.instaAvatar} onChange={(instaAvatar) => set({ instaAvatar })} />
          <SwitchRow title="Ссылка на Instagram в профиле" sub="Люди смогут перейти к тебе в профиль" on={s.instaLink} onChange={(instaLink) => set({ instaLink })} last />
        </Group>

        <Cap>ПРИВАТНОСТЬ</Cap>
        <Group>
          <Row title="Кто видит мои планы" sub="Друзья видят все планы, остальные — только если ищешь компанию">
            <Segments label="Кто видит мои планы" value={s.plansVisible} onChange={(plansVisible) => set({ plansVisible })} options={[['all', 'Все'], ['friends', 'Друзья'], ['nobody', 'Никто']]} />
          </Row>
          <Row title="Кто может мне писать" sub="Друзья и те, кто идёт на те же события">
            <Segments label="Кто может писать" value={s.whoCanWrite} onChange={(whoCanWrite) => set({ whoCanWrite })} options={[['all', 'Все'], ['friends', 'Друзья'], ['common', 'С общими']]} />
          </Row>
          <Row title="Моя карта и значки" sub="Видно в профиле друзьям">
            <Segments label="Моя карта и значки" value={s.achievements} onChange={(achievements) => set({ achievements })} options={[['me', 'Только мне'], ['friends', 'Друзьям'], ['all', 'Всем']]} />
          </Row>
          <SwitchRow title="Невидимка" sub="Никто не видит ни планов, ни геолокации, пока не выключишь" on={marker.invisible} onChange={(invisible) => setMarker({ invisible })} last />
        </Group>

        <Cap>УВЕДОМЛЕНИЯ</Cap>
        <Group>
          <SwitchRow title="Друг рядом с событием" sub="Например: Денис в 200 м от аниме-выставки — позвать?" on={s.notif.friendNear} onChange={(v) => setN('friendNear', v)} />
          <SwitchRow title="Событие по интересам рядом" sub="Если ты в километре от чего-то интересного" on={s.notif.interestNear} onChange={(v) => setN('interestNear', v)} />
          <SwitchRow title="Напоминание за 2 часа" sub="О событиях из твоих планов" on={s.notif.remind2h} onChange={(v) => setN('remind2h', v)} />
          <SwitchRow title="Сообщения и заявки" sub="Личные, чаты событий, заявки в друзья" on={s.notif.messages} onChange={(v) => setN('messages', v)} />
          <SwitchRow title="Подборка на выходные" sub="По четвергам, 7 событий под твои интересы" on={s.notif.weekend} onChange={(v) => setN('weekend', v)} last />
        </Group>

        <Cap>КАРТА</Cap>
        <Group>
          <Row title="Стиль карты" sub="Днём светлая, после 20:00 — тёмная">
            <Segments label="Стиль карты" value={s.mapStyle} onChange={(mapStyle) => set({ mapStyle })} options={[['paper', 'Бумага'], ['night', 'Ночь'], ['auto', 'Авто']]} />
          </Row>
          <SwitchRow title="Популярные события крупнее" sub="Чем больше людей идёт, тем больше точка на карте" on={s.popularBigger} onChange={(popularBigger) => set({ popularBigger })} />
          <Pressable onPress={() => router.push('/marker')} accessibilityRole="button">
            <Row title="Мой значок на карте" sub="скорость, статус и цвет, которые видят друзья" right={<Ic d={IC.chevron} size={18} color={colors.muted} w={2} />} last />
          </Pressable>
        </Group>

        <Cap>ПРОЧЕЕ</Cap>
        <Group>
          {[
            ['Что вытаскивает из дома', String(draft.interests.length), () => router.push('/me')],
            ['Язык', 'Русский', () => {}],
            ['Заблокированные', String(blockedCount), () => {}],
            ['Правила сообщества', '', () => router.push('/legal?doc=rules')],
            ['Политика конфиденциальности', '', () => router.push('/legal?doc=privacy')],
            ['Помощь и связь с нами', '', () => Linking.openURL('mailto:help@ryadom.kz').catch(() => {})],
          ].map(([label, value, act], i, arr) => (
            <Pressable key={label as string} onPress={act as () => void} accessibilityRole="button">
              <Row title={label as string} last={i === arr.length - 1}
                right={<View style={styles.valueRow}>{!!value && <Text style={styles.value}>{value as string}</Text>}<Ic d={IC.chevron} size={18} color={colors.muted} w={2} /></View>} />
            </Pressable>
          ))}
        </Group>

        <Pressable onPress={() => setConfirm('out')} style={styles.outBtn} accessibilityRole="button"><Text style={styles.outText}>Выйти</Text></Pressable>
        <Pressable onPress={() => setConfirm('delete')} style={{ alignSelf: 'center', padding: 10 }} accessibilityRole="button"><Text style={styles.delete}>Удалить аккаунт</Text></Pressable>
        <Text style={styles.version}>РЯДОМ. · ВЕРСИЯ 0.1</Text>
      </ScrollView>

      {confirm && (
        <>
          <Backdrop onPress={() => setConfirm(null)} label="Закрыть" />
          <BottomSheet onClose={() => setConfirm(null)} label={confirm === 'delete' ? 'Удалить аккаунт' : 'Выйти'} style={{ paddingBottom: 30 + insets.bottom }}>
            <View style={{ flexDirection: 'row', gap: 12, alignItems: 'center' }}>
              <Image source={photo(draft.photo ?? 'danil')} style={{ width: 48, height: 48, borderRadius: 16 }} />
              <Text style={[styles.h1, { fontSize: 22, flex: 1 }]}>{confirm === 'delete' ? 'Удалить аккаунт?' : 'Выйти из аккаунта?'}</Text>
            </View>
            <Text style={styles.sub}>{confirm === 'delete'
              ? 'Удалим профиль, планы, чаты, значки и карту города. Вернуть их будет нельзя. Друзья перестанут тебя видеть сразу.'
              : 'Планы и настройки останутся на этом телефоне. Войти обратно можно в любой момент.'}</Text>
            {deleteFailed && confirm === 'delete' && <Text style={[styles.sub, { color: colors.accentText }]}>Не получилось связаться с сервером — аккаунт не удалён. Проверь интернет и попробуй ещё раз.</Text>}
            <Pressable onPress={() => leave(confirm === 'delete')} style={[styles.outBtn, { backgroundColor: confirm === 'delete' ? colors.accentText : colors.ink, borderWidth: 0 }]} accessibilityRole="button">
              <Text style={[styles.outText, { color: colors.paper }]}>{confirm === 'delete' ? 'Удалить навсегда' : 'Выйти'}</Text>
            </Pressable>
            <Pressable onPress={() => setConfirm(null)} style={styles.outBtn} accessibilityRole="button"><Text style={styles.outText}>Отмена</Text></Pressable>
          </BottomSheet>
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.paper },
  head: { flexDirection: 'row', alignItems: 'center', gap: 14, marginBottom: 6 },
  h1: { fontFamily: fonts.display700, fontSize: 26, letterSpacing: -0.5, color: colors.ink },
  sub: { fontFamily: fonts.body400, fontSize: 14, lineHeight: 20, color: colors.muted2 },
  link: { fontFamily: fonts.body600, fontSize: 13, color: colors.ink, textDecorationLine: 'underline' },
  outline: { height: 36, paddingHorizontal: 12, borderRadius: 18, borderWidth: 1, borderColor: colors.line2, justifyContent: 'center' },
  outlineText: { fontFamily: fonts.body600, fontSize: 13, color: colors.ink },
  valueRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  value: { fontFamily: fonts.body400, fontSize: 14, color: colors.muted },
  outBtn: { height: 52, marginTop: 12, borderRadius: 16, borderWidth: 1, borderColor: colors.line2, backgroundColor: colors.card, alignItems: 'center', justifyContent: 'center' },
  outText: { fontFamily: fonts.body600, fontSize: 15, color: colors.ink },
  delete: { fontFamily: fonts.body500, fontSize: 14, color: colors.accentText },
  version: { alignSelf: 'center', fontFamily: fonts.mono500, fontSize: 10.5, letterSpacing: 0.5, color: colors.muted },
});
