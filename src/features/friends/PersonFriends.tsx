// Друзья человека (26 октября): открываются по нажатию на «друзья» в профиле. Две вкладки — «Все» и «Общие».
// Другу видны все его друзья, незнакомому — только общие (PRODUCT.md «Кто что видит»).
import { useQuery } from '@tanstack/react-query';
import { router, useLocalSearchParams } from 'expo-router';
import { ChevronRight } from 'lucide-react-native';
import { useState } from 'react';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { data } from '../../data';
import { isFriendNow } from '../../state/social';
import { useSocialActions } from '../../live/socialActions';
import { colors, fonts } from '../../theme';
import { ART } from '../../ui/art';
import { Avatar } from '../../ui/Avatar';
import { SettingsPage } from '../../ui/v6/Settings';

const genitive = (n: string) => (n.endsWith('ь') ? `${n.slice(0, -1)}я` : n.endsWith('а') ? `${n.slice(0, -1)}ы` : n.endsWith('й') ? `${n.slice(0, -1)}я` : `${n}а`);

export default function PersonFriends() {
  const { id, tab: tab0 } = useLocalSearchParams<{ id: string; tab?: string }>();
  const [tab, setTab] = useState<'all' | 'common'>(tab0 === 'common' ? 'common' : 'all');
  const social = useSocialActions(() => undefined);
  const { data: people = [] } = useQuery({ queryKey: ['people'], queryFn: () => data.getPeople() });
  const q = useQuery({ queryKey: ['person', id, 'friends'], queryFn: () => data.getPersonFriends(id) });
  const who = people.find((x) => x.id === id);
  const friend = !!who && isFriendNow(who, social);
  const all = q.data ?? [];
  const common = all.filter((x) => x.common);
  const list = tab === 'all' && friend ? all : common;
  const tabs = friend ? [{ k: 'all' as const, label: 'Все', n: all.length }, { k: 'common' as const, label: 'Общие', n: common.length }] : [{ k: 'common' as const, label: 'Общие', n: common.length }];

  return (
    <SettingsPage title={who ? `Друзья ${genitive(who.name)}` : 'Друзья'}>
      {!friend && <Text style={styles.note}>Общих друзей: {common.length}. Остальных видят только {who ? `друзья ${genitive(who.name)}` : 'его друзья'}.</Text>}
      {friend && <View style={styles.seg} accessibilityRole="tablist">
        {tabs.map((t) => {
          const on = (friend ? tab : 'common') === t.k;
          return (
            <Pressable key={t.k} onPress={() => setTab(t.k)} style={[styles.segBtn, on && styles.segOn]} accessibilityRole="tab" accessibilityState={{ selected: on }}>
              <Text style={[styles.segText, on && { color: colors.paper }]}>{t.label}</Text>
              <Text style={[styles.segN, on && { color: 'rgba(255,255,255,0.6)' }]}>{t.n}</Text>
            </Pressable>
          );
        })}
      </View>}

      {q.isPending ? null : list.length === 0 ? (
        <View style={styles.empty}>
          <Image source={ART.wave} style={{ width: 72, height: 72 }} />
          <Text style={styles.emptyText}>{tab === 'common' || !friend ? 'Общих друзей пока нет' : 'Здесь пока никого'}</Text>
        </View>
      ) : (
        <View style={styles.group}>
          {list.map(({ person: fp, common: c }, i) => (
            <Pressable key={fp.id} onPress={() => router.push({ pathname: '/person/[id]', params: { id: fp.id } })}
              style={({ pressed }) => [styles.row, i < list.length - 1 && styles.sep, pressed && { backgroundColor: '#E8E2D6' }]} accessibilityRole="button" accessibilityLabel={fp.name}>
              <Avatar p={fp} size={48} />
              <View style={{ flex: 1, gap: 2 }}>
                <Text style={styles.name} numberOfLines={1}>{fp.name}</Text>
                <Text style={styles.sub} numberOfLines={1}>{c ? 'ваш общий друг' : fp.handle ? `@${fp.handle}` : 'не в друзьях у тебя'}</Text>
              </View>
              <ChevronRight size={18} color="#A8A296" strokeWidth={2} />
            </Pressable>
          ))}
        </View>
      )}
    </SettingsPage>
  );
}

const styles = StyleSheet.create({
  seg: { flexDirection: 'row', gap: 4, padding: 4, borderRadius: 18, backgroundColor: colors.sand, marginBottom: 6 },
  segBtn: { flex: 1, flexDirection: 'row', gap: 6, minHeight: 44, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  segOn: { backgroundColor: colors.ink },
  segText: { fontFamily: fonts.body600, fontSize: 15, color: colors.ink },
  segN: { fontFamily: fonts.body500, fontSize: 14, color: colors.muted },
  note: { fontFamily: fonts.body500, fontSize: 14, lineHeight: 19, color: colors.muted, marginBottom: 6 },
  group: { borderRadius: 22, backgroundColor: colors.card, overflow: 'hidden' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 68, paddingHorizontal: 14 },
  sep: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.line2 },
  name: { fontFamily: fonts.body600, fontSize: 16, color: colors.ink },
  sub: { fontFamily: fonts.body400, fontSize: 13.5, color: colors.muted },
  empty: { alignItems: 'center', gap: 10, paddingVertical: 40 },
  emptyText: { fontFamily: fonts.body500, fontSize: 15, color: colors.muted },
});
