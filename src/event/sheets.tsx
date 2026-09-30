// Шторки поверх события: «Ищу компанию» (Company), «Позвать друга», «Маршрут».
import { useState } from 'react';
import { Linking, Platform, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import type { EventItem, Person } from '../data/types';
import { activeCompany, usePlans, type CompanyVisibility, type Mood } from '../state/plans';
import { colors, fonts } from '../theme';
import { Avatar } from '../ui/Avatar';
import { Ic, IC } from '../ui/Ic';
import { Chip, Segments } from '../ui/kit';
import { CAT_ICON } from '../map/icons';
import { routeLinks } from './route';

const MOODS: [Mood, string][] = [['music', 'Послушать музыку'], ['meet', 'Познакомиться'], ['walk', 'Потом погулять'], ['notalone', 'Просто не идти одному']];
const MOOD_SHORT: Record<Mood, string> = { music: 'послушать музыку', meet: 'познакомиться', walk: 'потом погулять', notalone: 'не идти одному' };

function SheetHead({ e, title, sub, onClose }: { e: EventItem; title: string; sub: string; onClose: () => void }) {
  return (
    <View style={styles.head}>
      <View style={styles.headIcon}><Ic d={CAT_ICON[e.category]} size={20} color={colors.ink} w={2} /></View>
      <View style={{ flex: 1, gap: 2 }}>
        <Text style={styles.title} accessibilityRole="header">{title}</Text>
        <Text style={styles.sub} numberOfLines={1}>{sub}</Text>
      </View>
      <Pressable onPress={onClose} style={styles.close} accessibilityRole="button" accessibilityLabel="Закрыть">
        <Ic d={IC.close} size={16} color={colors.ink} w={2.2} />
      </Pressable>
    </View>
  );
}

export function CompanySheet({ e, when, now, people, onClose, onWrite }: {
  e: EventItem; when: string; now: Date; people: Person[]; onClose: () => void; onWrite: (personId: string) => void;
}) {
  const request = usePlans((s) => s.company[e.id]);
  const lookForCompany = usePlans((s) => s.lookForCompany);
  const withdraw = usePlans((s) => s.withdrawCompany);
  const [moods, setMoods] = useState<Mood[]>(request?.moods ?? ['music', 'meet']);
  const [vis, setVis] = useState<CompanyVisibility>(request?.visibility ?? 'all');
  const [note, setNote] = useState(request?.note ?? '');
  const done = activeCompany(request, e, now);
  const started = now.getTime() >= new Date(e.startsAt).getTime();
  const toggle = (m: Mood) => setMoods((cur) => (cur.includes(m) ? cur.filter((x) => x !== m) : [...cur, m]));
  const lookers = e.lookers ?? [];

  return (
    <>
      <SheetHead e={e} title="Ищу компанию" sub={`${e.title} · ${when}`} onClose={onClose} />
      {!done ? (
        <>
          <View style={{ gap: 10 }}>
            <Text style={styles.h}>Зачем идёшь</Text>
            <View style={styles.chips}>
              {MOODS.map(([k, label]) => <Chip key={k} label={label} on={moods.includes(k)} onPress={() => toggle(k)} />)}
            </View>
          </View>
          <View style={{ gap: 10 }}>
            <Text style={styles.h}>Кто увидит</Text>
            <Segments<CompanyVisibility> label="Кто увидит заявку" value={vis} onChange={setVis} options={[['all', 'Все, кто идёт'], ['fof', 'Друзья друзей']]} />
          </View>
          <TextInput value={note} onChangeText={setNote} placeholder="Пара слов, если хочешь: буду в зелёной куртке" placeholderTextColor={colors.muted3}
            accessibilityLabel="Пара слов о себе, необязательно" style={styles.input} maxLength={80} />
          <View style={{ gap: 10 }}>
            <Pressable disabled={started || moods.length === 0} onPress={() => lookForCompany({ eventId: e.id, moods, visibility: vis, note })}
              style={[styles.primary, (started || moods.length === 0) && { backgroundColor: colors.sand }]} accessibilityRole="button">
              <Text style={[styles.primaryText, (started || moods.length === 0) && { color: colors.muted3 }]}>{started ? 'Событие уже началось' : 'Искать компанию'}</Text>
            </Pressable>
          </View>
        </>
      ) : (
        <>
          <View style={styles.done}>
            <View style={styles.doneIcon}><Ic d={IC.check} size={20} color={colors.ink} w={2.4} /></View>
            <View style={{ flex: 1, gap: 2 }}>
              <Text style={styles.doneTitle}>Ты в списке «Ищут компанию»</Text>
              <Text style={styles.doneSub}>{request.visibility === 'all' ? 'Тебя видят все, кто идёт. Напиши первым или жди — ответы придут в «Чаты»' : 'Тебя видят только друзья твоих друзей на этом событии'}</Text>
            </View>
          </View>
          {lookers.length > 0 && (
            <View style={{ gap: 8 }}>
              <Text style={styles.h}>Тоже ищут · {Math.max(e.lookingCount, lookers.length)}</Text>
              <View style={styles.list}>
                {lookers.map((l, i) => {
                  const p = people.find((x) => x.id === l.personId);
                  if (!p) return null;
                  return (
                    <View key={l.personId} style={[styles.row, i < lookers.length - 1 && styles.rowLine]}>
                      <Avatar p={p} size={42} radius={14} />
                      <View style={{ flex: 1, gap: 2 }}>
                        <Text style={styles.name}>{p.name}{p.age ? `, ${p.age}` : ''}</Text>
                        <Text style={styles.note} numberOfLines={1}>{l.note.charAt(0).toLowerCase() + l.note.slice(1)}</Text>
                      </View>
                      <Pressable onPress={() => onWrite(p.id)} accessibilityRole="button" accessibilityLabel={`Написать: ${p.name}`}
                        style={[styles.write, i === 0 ? { backgroundColor: colors.ink } : { borderWidth: 1.5, borderColor: colors.ink }]}>
                        <Text style={[styles.writeText, i === 0 && { color: colors.paper }]}>Написать</Text>
                      </Pressable>
                    </View>
                  );
                })}
              </View>
            </View>
          )}
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <Pressable onPress={() => withdraw(e.id)} style={[styles.half, { borderWidth: 1.5, borderColor: colors.ink }]} accessibilityRole="button">
              <Text style={styles.halfText}>Снять заявку</Text>
            </Pressable>
            <Pressable onPress={onClose} style={[styles.half, { backgroundColor: colors.ink }]} accessibilityRole="button">
              <Text style={[styles.halfText, { color: colors.paper }]}>Готово</Text>
            </Pressable>
          </View>
        </>
      )}
    </>
  );
}

export { MOOD_SHORT };

export function InviteSheet({ friends, goingIds, onSend }: {
  e?: EventItem; friends: Person[]; goingIds: string[]; onSend: (ids: string[]) => void;
}) {
  const [sel, setSel] = useState<string[]>(friends.filter((f) => !goingIds.includes(f.id)).slice(0, 1).map((f) => f.id));
  const names = friends.filter((f) => sel.includes(f.id)).map((f) => f.name);
  return (
    <>
      <Text style={styles.title} accessibilityRole="header">Позвать друга</Text>
      <View style={styles.list}>
        {friends.map((f, i) => {
          const already = goingIds.includes(f.id);
          const on = !already && sel.includes(f.id);
          return (
            <Pressable key={f.id} disabled={already} onPress={() => setSel((s) => (on ? s.filter((x) => x !== f.id) : [...s, f.id]))}
              accessibilityRole="checkbox" accessibilityState={{ checked: on, disabled: already }}
              style={[styles.row, { paddingHorizontal: 14, opacity: already ? 0.5 : 1 }, i < friends.length - 1 && styles.rowLine]}>
              <Avatar p={f} size={42} ring={colors.friend} />
              <View style={{ flex: 1, gap: 2 }}>
                <Text style={styles.name}>{f.name}</Text>
                <Text style={styles.note}>{already ? 'уже идёт' : f.note ?? 'онлайн'}</Text>
              </View>
              <View style={[styles.box, on && { backgroundColor: colors.ink, borderColor: colors.ink }]}>
                {on && <Ic d={IC.check} size={14} color={colors.paper} w={3} />}
              </View>
            </Pressable>
          );
        })}
      </View>
      <Pressable disabled={!names.length} onPress={() => onSend(sel)} style={[styles.primary, { height: 54 }, !names.length && { backgroundColor: colors.sand }]} accessibilityRole="button">
        <Text style={[styles.primaryText, !names.length && { color: colors.muted3 }]}>{names.length ? 'Позвать' : 'Выбери, кого позвать'}</Text>
      </Pressable>
    </>
  );
}

export function RouteSheet({ e }: { e: EventItem }) {
  const links = routeLinks(e.lat, e.lon, e.venueName ?? e.address, Platform.OS === 'ios');
  const open = async (native: string | null, web: string) => {
    try {
      if (native && Platform.OS !== 'web' && (await Linking.canOpenURL(native))) { await Linking.openURL(native); return; }
    } catch { /* нет приложения — откроем сайт */ }
    await Linking.openURL(web);
  };
  return (
    <>
      <View style={{ gap: 3 }}>
        <Text style={styles.title} accessibilityRole="header">Маршрут</Text>
        <Text style={styles.sub}>{e.address}{e.addressNote ? ` · ${e.addressNote}` : ''}</Text>
      </View>
      <View style={styles.list}>
        {links.map((l, i) => (
          <Pressable key={l.app} onPress={() => open(l.native, l.web)} accessibilityRole="link" style={[styles.row, { paddingHorizontal: 14, minHeight: 56 }, i < links.length - 1 && styles.rowLine]}>
            <Text style={[styles.name, { flex: 1 }]}>{l.label}</Text>
            <Ic d={IC.chevron} size={16} color={colors.muted} w={2} />
          </Pressable>
        ))}
      </View>
      <Text style={styles.foot}>ОТКРОЕТСЯ ПРИЛОЖЕНИЕ, А ЕСЛИ ЕГО НЕТ — САЙТ</Text>
    </>
  );
}

const styles = StyleSheet.create({
  head: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  headIcon: { width: 44, height: 44, borderRadius: 14, backgroundColor: colors.accent, alignItems: 'center', justifyContent: 'center' },
  title: { fontFamily: fonts.display700, fontSize: 22, letterSpacing: -0.2, color: colors.ink },
  sub: { fontFamily: fonts.body400, fontSize: 13, color: colors.muted },
  close: { width: 44, height: 44, borderRadius: 22, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.card, alignItems: 'center', justifyContent: 'center' },
  h: { fontFamily: fonts.display600, fontSize: 17, color: colors.ink },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  input: { height: 50, paddingHorizontal: 16, borderWidth: 1, borderColor: colors.line2, borderRadius: 16, backgroundColor: colors.card, fontFamily: fonts.body400, fontSize: 15, color: colors.ink },
  primary: { height: 56, borderRadius: 16, backgroundColor: colors.ink, alignItems: 'center', justifyContent: 'center' },
  primaryText: { fontFamily: fonts.body600, fontSize: 16, color: colors.paper },
  foot: { alignSelf: 'center', fontFamily: fonts.mono600, fontSize: 10.5, letterSpacing: 0.5, color: colors.muted },
  done: { flexDirection: 'row', gap: 12, alignItems: 'center', padding: 14, borderRadius: 18, backgroundColor: colors.ink },
  doneIcon: { width: 40, height: 40, borderRadius: 20, backgroundColor: colors.accent, alignItems: 'center', justifyContent: 'center' },
  doneTitle: { fontFamily: fonts.body600, fontSize: 15, color: colors.paper },
  doneSub: { fontFamily: fonts.body400, fontSize: 13, lineHeight: 18, color: '#BDB8AD' },
  list: { borderWidth: 1, borderColor: colors.line, borderRadius: 18, backgroundColor: colors.card },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10, paddingHorizontal: 12 },
  rowLine: { borderBottomWidth: 1, borderBottomColor: colors.sand },
  name: { fontFamily: fonts.body600, fontSize: 15, color: colors.ink },
  note: { fontFamily: fonts.body400, fontSize: 12.5, color: colors.muted },
  write: { height: 36, paddingHorizontal: 12, borderRadius: 18, justifyContent: 'center' },
  writeText: { fontFamily: fonts.body600, fontSize: 13, color: colors.ink },
  half: { flex: 1, height: 50, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  halfText: { fontFamily: fonts.body600, fontSize: 15, color: colors.ink },
  box: { width: 26, height: 26, borderRadius: 8, borderWidth: 1.5, borderColor: '#B9B2A3', alignItems: 'center', justifyContent: 'center' },
});
