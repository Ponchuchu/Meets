// «Ночёвки» (FIX3 Ф10) — коллекция, как в Zenly: ночь не дома (с 0 до 6, дольше двух часов) — одна ночёвка.
// У кого ночевал — если рядом дом друга; точку не показываем никому, только район. Друзьям — по переключателю.
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { BedDouble, Moon } from 'lucide-react-native';
import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { getProfileExtras, getSleepovers, saveProfileExtras } from '../../live/profileExtras';
import { groupSleepovers } from '../../profile/sleepovers';
import { colors, fonts, radii } from '../../theme';
import { Avatar } from '../../ui/Avatar';
import { plate } from '../../ui/glass';
import { Group, Note, SettingsPage, ToggleRow } from '../../ui/v6/Settings';

const MONTHS = ['января', 'февраля', 'марта', 'апреля', 'мая', 'июня', 'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря'];
const nightRu = (d: string) => { const x = new Date(`${d}T12:00:00Z`); return `${x.getUTCDate()} ${MONTHS[x.getUTCMonth()]}`; };
const plural = (n: number, a: string, b: string, c: string) => { const m10 = n % 10, m100 = n % 100; return m10 === 1 && m100 !== 11 ? a : m10 >= 2 && m10 <= 4 && (m100 < 10 || m100 >= 20) ? b : c; };


export default function SleepoversPage() {
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ['me', 'sleepovers'], queryFn: () => getSleepovers() });
  const extras = useQuery({ queryKey: ['me', 'extras'], queryFn: getProfileExtras });
  const [error, setError] = useState('');
  const list = q.data ?? [];
  const groups = groupSleepovers(list);
  const hosts = groups.filter(g => g.name).length;

  return (
    <SettingsPage title="Ночёвки" sub="Ночи не дома — собираются сами.">
      <View style={styles.hero}>
        <Moon size={26} color="#F7D58A" strokeWidth={1.8} />
        <Text style={styles.heroN}>{list.length}</Text>
        <Text style={styles.heroL}>{plural(list.length, 'ночь', 'ночи', 'ночей')} не дома{hosts ? ` · у ${hosts} ${plural(hosts, 'друга', 'друзей', 'друзей')}` : ''}</Text>
      </View>
      {!list.length && !q.isPending && <Note>Пока ни одной. Когда переночуешь у друга или не дома, ночь появится здесь сама — по геолокации. Точки никто не видит.</Note>}
      {groups.map(g => (
        <View key={g.key} style={styles.row}>
          {g.name ? <Avatar p={{ photo: g.photo, initial: (g.name[0] ?? '·').toUpperCase(), tint: '#D5CFC1' }} size={46} /> : <View style={styles.icon}><BedDouble size={22} color={colors.muted2} strokeWidth={1.8} /></View>}
          <View style={{ flex: 1, gap: 2 }}>
            <Text style={styles.name} numberOfLines={1}>{g.name ?? g.area ?? 'Не дома'}</Text>
            <Text style={styles.sub} numberOfLines={1}>{g.name ? 'у друга · ' : ''}{g.nights.slice(0, 3).map(nightRu).join(', ')}{g.nights.length > 3 ? ` и ещё ${g.nights.length - 3}` : ''}{g.name && g.area ? ` · ${g.area}` : ''}</Text>
          </View>
          <View style={styles.count}><Text style={styles.countText}>{g.nights.length}</Text></View>
        </View>
      ))}
      {!!error && <Text style={{ color: colors.accentText }}>{error}</Text>}
      <Group>
        <ToggleRow title="Друзья видят мои ночёвки" sub="Только имена и районы, без точек" on={!!extras.data?.sleepoversVisible}
          onChange={v => { void saveProfileExtras({ sleepoversVisible: v }).then(() => qc.invalidateQueries({ queryKey: ['me', 'extras'] })).catch(() => setError('Не получилось сохранить. Проверь связь')); }} last />
      </Group>
    </SettingsPage>
  );
}

const styles = StyleSheet.create({
  hero: { borderRadius: radii.xl - 4, backgroundColor: '#22263A', padding: 20, gap: 4 },
  heroN: { fontFamily: fonts.display800, fontSize: 44, letterSpacing: -1.2, color: '#FFFFFF', marginTop: 6 },
  heroL: { fontFamily: fonts.body500, fontSize: 14, color: '#C9CBE0' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12, borderRadius: 20, ...plate },
  icon: { width: 46, height: 46, borderRadius: 23, backgroundColor: colors.sand, alignItems: 'center', justifyContent: 'center' },
  name: { fontFamily: fonts.body700, fontSize: 15.5, color: colors.ink },
  sub: { fontFamily: fonts.body400, fontSize: 12.5, color: colors.muted },
  count: { minWidth: 34, height: 34, borderRadius: 17, backgroundColor: colors.ink, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 8 },
  countText: { fontFamily: fonts.mono600, fontSize: 13, color: colors.paper },
});
