// Шторка поверх события: «Позвать друга». «Компания» — в v6/CardPeople.tsx.
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import type { EventItem, Person } from '../data/types';
import { colors, fonts } from '../theme';
import { Avatar } from '../ui/Avatar';
import { Ic, IC } from '../ui/Ic';


export function InviteSheet({ friends, goingIds, onSend, busy=false }: {
  e?: EventItem; friends: Person[]; goingIds: string[]; onSend: (ids: string[]) => void; busy?:boolean;
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
      <Pressable disabled={busy||!names.length} onPress={() => onSend(sel)} style={[styles.primary, { height: 54 }, !names.length && { backgroundColor: colors.sand }]} accessibilityRole="button">
        <Text style={[styles.primaryText, !names.length && { color: colors.muted3 }]}>{busy?'Отправляю…':names.length ? 'Позвать' : 'Выбери, кого позвать'}</Text>
      </Pressable>
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
