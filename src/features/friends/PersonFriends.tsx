// Друзья человека (26 октября, второй вариант): шапка с его фото и числами, вкладки «Все» и «Общие», поиск, если людей много.
// В «Все» сначала общие, потом остальные. Справа у строки — действие: свой друг — «Написать», чужой — «Добавить» → «Заявка».
// Другу видны все его друзья, незнакомому — только общие (PRODUCT.md «Кто что видит»).
import { useQuery } from '@tanstack/react-query';
import { router, useLocalSearchParams } from 'expo-router';
import { Check, MessageCircle, Search, UserPlus } from 'lucide-react-native';
import { useState } from 'react';
import { Image, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { data } from '../../data';
import type { Person } from '../../data/types';
import { useSocialActions } from '../../live/socialActions';
import { isFriendNow } from '../../state/social';
import { colors, fonts } from '../../theme';
import { ART } from '../../ui/art';
import { Avatar } from '../../ui/Avatar';
import { SettingsPage } from '../../ui/v6/Settings';

const genitive = (n: string) => (n.endsWith('ь') || n.endsWith('й') ? `${n.slice(0, -1)}я` : n.endsWith('а') ? `${n.slice(0, -1)}ы` : `${n}а`);
const plural = (n: number, a: string, b: string, c: string) => { const m10 = n % 10, m100 = n % 100; return m10 === 1 && m100 !== 11 ? a : m10 >= 2 && m10 <= 4 && (m100 < 10 || m100 >= 20) ? b : c; };

export default function PersonFriends() {
  const { id, tab: tab0 } = useLocalSearchParams<{ id: string; tab?: string }>();
  const [tab, setTab] = useState<'all' | 'common'>(tab0 === 'common' ? 'common' : 'all');
  const [query, setQuery] = useState('');
  const social = useSocialActions(() => undefined);
  const { data: people = [] } = useQuery({ queryKey: ['people'], queryFn: () => data.getPeople() });
  const q = useQuery({ queryKey: ['person', id, 'friends'], queryFn: () => data.getPersonFriends(id) });
  const who = people.find((x) => x.id === id);
  const friend = !!who && isFriendNow(who, social);
  const all = q.data ?? [];
  const common = all.filter((x) => x.common);
  const others = all.filter((x) => !x.common);
  const cur = tab === 'common' || !friend ? 'common' : 'all';
  const match = (p: Person) => !query.trim() || p.name.toLowerCase().includes(query.trim().toLowerCase());
  const sections = cur === 'common' ? [{ title: '', list: common }] : [{ title: 'Общие', list: common }, { title: 'Остальные', list: others }];
  const shown = sections.map((s) => ({ ...s, list: s.list.filter((x) => match(x.person)) })).filter((s) => s.list.length);
  const title = who ? `Друзья ${genitive(who.name)}` : 'Друзья';

  return (
    <SettingsPage title={title}>
      {who && (
        <View style={styles.head}>
          <Avatar p={who} size={56} />
          <View style={{ flex: 1, gap: 2 }}>
            <Text style={styles.headTitle}>{friend ? `${all.length} ${plural(all.length, 'друг', 'друга', 'друзей')}` : `${common.length} ${plural(common.length, 'общий друг', 'общих друга', 'общих друзей')}`}</Text>
            <Text style={styles.headSub}>{friend ? (common.length ? `из них ${common.length} ${plural(common.length, 'общий', 'общих', 'общих')} с тобой` : 'общих друзей пока нет') : `остальных видят только друзья ${genitive(who.name)}`}</Text>
          </View>
        </View>
      )}

      {friend && (
        <View style={styles.seg} accessibilityRole="tablist">
          {([['all', 'Все', all.length], ['common', 'Общие', common.length]] as const).map(([k, label, n]) => {
            const on = cur === k;
            return (
              <Pressable key={k} onPress={() => setTab(k)} style={[styles.segBtn, on && styles.segOn]} accessibilityRole="tab" accessibilityState={{ selected: on }}>
                <Text style={[styles.segText, on && { color: colors.ink }]}>{label}</Text>
                <View style={[styles.segN, on && { backgroundColor: colors.ink }]}><Text style={[styles.segNText, on && { color: '#FFFFFF' }]}>{n}</Text></View>
              </Pressable>
            );
          })}
        </View>
      )}

      {all.length > 6 && (
        <View style={styles.search}>
          <Search size={18} color={colors.muted} strokeWidth={2} />
          <TextInput value={query} onChangeText={setQuery} placeholder="Найти по имени" placeholderTextColor={colors.muted3} style={styles.searchInput} accessibilityLabel="Найти по имени" />
        </View>
      )}

      {q.isPending ? null : !shown.length ? (
        <View style={styles.empty}>
          <Image source={ART.wave} style={{ width: 80, height: 80 }} />
          <Text style={styles.emptyTitle}>{query ? 'Никого не нашли' : cur === 'common' ? 'Общих друзей пока нет' : 'Здесь пока никого'}</Text>
          {!query && cur === 'common' && <Text style={styles.emptyText}>Сходите куда-нибудь вместе — познакомишь со своими.</Text>}
        </View>
      ) : shown.map((sec) => (
        <View key={sec.title || 'one'} style={{ gap: 8, marginTop: 4 }}>
          {!!sec.title && <Text style={styles.cap}>{sec.title} · {sec.list.length}</Text>}
          <View style={styles.group}>
            {sec.list.map(({ person: fp, common: c }, i) => {
              const mine = isFriendNow(fp, social);
              const sent = !!social.sent[fp.id];
              return (
                <Pressable key={fp.id} onPress={() => router.push({ pathname: '/person/[id]', params: { id: fp.id } })}
                  style={({ pressed }) => [styles.row, i < sec.list.length - 1 && styles.sep, pressed && { backgroundColor: '#ECE6DA' }]} accessibilityRole="button" accessibilityLabel={fp.name}>
                  <Avatar p={fp} size={50} ring={mine ? colors.friend : undefined} />
                  <View style={{ flex: 1, gap: 2 }}>
                    <Text style={styles.name} numberOfLines={1}>{fp.name}</Text>
                    <Text style={styles.sub} numberOfLines={1}>{mine ? (c ? 'твой друг · общий' : 'твой друг') : fp.handle ? `@${fp.handle}` : 'не в друзьях'}</Text>
                  </View>
                  {mine ? (
                    <Pressable onPress={() => router.push({ pathname: '/chat/[id]', params: { id: `dm-${fp.id}` } })} style={styles.iconBtn} accessibilityRole="button" accessibilityLabel={`Написать: ${fp.name}`} hitSlop={4}>
                      <MessageCircle size={19} color={colors.ink} strokeWidth={2} />
                    </Pressable>
                  ) : (
                    <Pressable onPress={() => social.toggleRequest(fp.id)} style={[styles.add, sent && styles.addSent]} accessibilityRole="button" accessibilityLabel={sent ? `Заявка отправлена: ${fp.name}` : `Добавить: ${fp.name}`}>
                      {sent ? <Check size={15} color={colors.ink} strokeWidth={2.4} /> : <UserPlus size={15} color="#FFFFFF" strokeWidth={2.2} />}
                      <Text style={[styles.addText, sent && { color: colors.ink }]}>{sent ? 'Заявка' : 'Добавить'}</Text>
                    </Pressable>
                  )}
                </Pressable>
              );
            })}
          </View>
        </View>
      ))}
    </SettingsPage>
  );
}

const styles = StyleSheet.create({
  head: { flexDirection: 'row', alignItems: 'center', gap: 14, padding: 14, borderRadius: 24, backgroundColor: '#FBFAF6', marginBottom: 4, boxShadow: '0 10px 22px -18px rgba(23,22,26,0.6)' },
  headTitle: { fontFamily: fonts.display700, fontSize: 19, color: colors.ink },
  headSub: { fontFamily: fonts.body500, fontSize: 13.5, color: colors.muted },
  seg: { flexDirection: 'row', gap: 4, padding: 4, borderRadius: 20, backgroundColor: colors.sand },
  segBtn: { flex: 1, flexDirection: 'row', gap: 8, minHeight: 44, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  segOn: { backgroundColor: '#FBFAF6', boxShadow: '0 2px 8px -3px rgba(23,22,26,0.35)' },
  segText: { fontFamily: fonts.body600, fontSize: 15, color: colors.muted2 },
  segN: { minWidth: 24, height: 22, paddingHorizontal: 7, borderRadius: 11, backgroundColor: 'rgba(23,22,26,0.08)', alignItems: 'center', justifyContent: 'center' },
  segNText: { fontFamily: fonts.body700, fontSize: 12, color: colors.muted2 },
  search: { flexDirection: 'row', alignItems: 'center', gap: 8, height: 46, paddingHorizontal: 14, borderRadius: 16, backgroundColor: colors.card, marginTop: 4 },
  searchInput: { flex: 1, fontFamily: fonts.body500, fontSize: 15.5, color: colors.ink, outlineStyle: 'none' } as object,
  cap: { fontFamily: fonts.body600, fontSize: 13.5, color: colors.muted, paddingHorizontal: 4 },
  group: { borderRadius: 24, backgroundColor: '#FBFAF6', overflow: 'hidden' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 70, paddingHorizontal: 14 },
  sep: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.line2 },
  name: { fontFamily: fonts.body700, fontSize: 16, color: colors.ink },
  sub: { fontFamily: fonts.body500, fontSize: 13, color: colors.muted },
  iconBtn: { width: 44, height: 44, borderRadius: 22, backgroundColor: colors.sand, alignItems: 'center', justifyContent: 'center' },
  add: { flexDirection: 'row', alignItems: 'center', gap: 6, height: 38, paddingHorizontal: 12, borderRadius: 19, backgroundColor: colors.ink },
  addSent: { backgroundColor: colors.sand },
  addText: { fontFamily: fonts.body700, fontSize: 13.5, color: '#FFFFFF' },
  empty: { alignItems: 'center', gap: 8, paddingVertical: 40 },
  emptyTitle: { fontFamily: fonts.display700, fontSize: 18, color: colors.ink },
  emptyText: { fontFamily: fonts.body500, fontSize: 14, color: colors.muted, textAlign: 'center', paddingHorizontal: 30 },
});
