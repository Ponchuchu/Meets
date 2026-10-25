// Образец всех значков карты (FIX5, docs/MAP-ICONS.md): для скриншотов и проверки на глаз. В приложении на неё не ведёт ни одна кнопка.
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ATTRACTIONS } from '../../data/attractions';
import { demoEvents, FRIEND_SPOTS, PEOPLE } from '../../data/demo';
import { EventPin, FocusPin, FriendPin, TogetherPin } from '../../map/pins';
import { AttractionPin } from '../../map/ui/AttractionPin';
import { PlacePin } from '../../map/ui/PlacePin';
import { MallPin } from '../../map/ui/VenueSheet';
import { colors, fonts } from '../../theme';

const noop = () => undefined;

function Cell({ title, children, h = 110 }: { title: string; children: React.ReactNode; h?: number }) {
  return (
    <View style={styles.cell}>
      <View style={[styles.stage, { height: h }]}><View style={styles.point}>{children}</View></View>
      <Text style={styles.cap}>{title}</Text>
    </View>
  );
}

export default function PinsPreview() {
  const insets = useSafeAreaInsets();
  const ev = demoEvents();
  const e = (id: string) => ev.find((x) => x.id === id) ?? ev[0];
  const person = (id: string) => PEOPLE.find((p) => p.id === id) ?? PEOPLE[0];
  const spot = (id: string) => FRIEND_SPOTS.find((s) => s.personId === id) ?? FRIEND_SPOTS[0];
  const a = (id: string) => ATTRACTIONS.find((x) => x.id === id) ?? ATTRACTIONS[0];
  return (
    <ScrollView style={{ flex: 1, backgroundColor: '#E6E1D3' }} contentContainerStyle={{ paddingTop: insets.top + 12, paddingHorizontal: 12, paddingBottom: 40 }}>
      <Text style={styles.h}>Значки карты</Text>
      <Text style={styles.sec}>СОБЫТИЯ — МИНИ-АФИШИ</Text>
      <View style={styles.grid}>
        <Cell title="издалека — точка" h={70}><EventPin e={e('games')} kind="plain" phase="today" showCompany={false} dark={false} onPress={noop} compact /></Cell>
        <Cell title="обычное · время"><EventPin e={e('games')} kind="plain" phase="today" showCompany={false} dark={false} onPress={noop} time={{ text: '20:00', live: false }} /></Cell>
        <Cell title="идёт друг"><EventPin e={e('jazz')} kind="labeled" phase="soon" showCompany={false} dark={false} onPress={noop} friend={person('igor')} time={{ text: '19:30', live: false }} /></Cell>
        <Cell title="идёт сейчас"><EventPin e={{ ...e('concert'), cover: 'krug' }} kind="labeled" phase="live" showCompany={false} dark={false} onPress={noop} time={{ text: 'идёт', live: true }} /></Cell>
        <Cell title="своё / друзей сегодня"><EventPin e={e('concert')} kind="hot" phase="today" showCompany={false} dark={false} onPress={noop} /></Cell>
        <Cell title="вблизи — с названием"><View style={{ marginLeft: -60 }}><EventPin e={e('jazz')} kind="labeled" phase="today" showCompany={false} dark={false} onPress={noop} name="Джаз во дворе" /></View></Cell>
        <Cell title="несколько в одном месте"><EventPin e={e('food')} kind="plain" phase="today" showCompany={false} dark={false} onPress={noop} count={3} /></Cell>
      </View>
      <Cell title="выбранное — крупная афиша с подписью" h={170}><View style={{ marginTop: 40 }}><EventPin e={e('jazz')} kind="labeled" phase="today" showCompany={false} dark={false} onPress={noop} selected friend={person('igor')} label="Джаз во дворе" when="сегодня, 19:30" /></View></Cell>

      <Text style={styles.sec}>ДРУЗЬЯ — ЛИЦА С ХВОСТИКОМ</Text>
      <View style={styles.grid}>
        <Cell title="на месте · заряд" h={140}><View style={{ marginTop: 40 }}><FriendPin person={person('igor')} spot={spot('igor')} onPress={noop} /></View></Cell>
        <Cell title="едет · скорость" h={140}><View style={{ marginTop: 40 }}><FriendPin person={person('denis')} spot={spot('denis')} onPress={noop} /></View></Cell>
        <Cell title="давно не обновлялся" h={140}><View style={{ marginTop: 40 }}><FriendPin person={person('timur')} spot={spot('timur')} onPress={noop} /></View></Cell>
        <Cell title="заряжается" h={140}><View style={{ marginTop: 40 }}><FriendPin person={person('anton')} spot={spot('anton')} onPress={noop} /></View></Cell>
      </View>
      <View style={styles.grid}>
        <Cell title="друг в фокусе" h={170}><View style={{ marginTop: 60 }}><FocusPin person={person('igor')} ring={colors.friend} bubble={null} /></View></Cell>
        <Cell title="вместе" h={170}><TogetherPin people={[person('igor'), person('anton')]} onPress={noop} /></Cell>
      </View>

      <Text style={styles.sec}>МЕСТА — КРУГИ · МОИ — КАПЛИ · ТРЦ — ЗДАНИЕ</Text>
      <View style={styles.grid}>
        <Cell title="фото события"><EventPin e={{ ...e('hike'), cover: 'hike' }} kind="labeled" phase="today" showCompany={false} dark={false} onPress={noop} time={{ text: 'завтра 08:00', live: false }} /></Cell>
        <Cell title="парк"><AttractionPin a={a('terrenkur')} label={false} onPress={noop} /></Cell>
        <Cell title="горы, вблизи"><View style={{ marginLeft: -50 }}><AttractionPin a={a('shymbulak')} label onPress={noop} /></View></Cell>
        <Cell title="моё место"><View style={{ marginTop: 30 }}><PlacePin kind="home" title="Дом" label /></View></Cell>
        <Cell title="избранное"><View style={{ marginTop: 30 }}><PlacePin kind="fav" icon="coffee" title="Кофейня" label /></View></Cell>
        <Cell title="ТРЦ" h={120}><MallPin m={{ id: 'p', name: 'ЦУМ', address: '', hours: '', cover: null, lat: 0, lon: 0 }} onPress={noop} events={3} /></Cell>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  h: { fontFamily: fonts.display800, fontSize: 26, color: colors.ink, marginBottom: 6 },
  sec: { fontFamily: fonts.mono600, fontSize: 10.5, letterSpacing: 0.6, color: colors.muted, marginTop: 14, marginBottom: 6 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  cell: { width: '31.8%', marginBottom: 4 },
  stage: { borderRadius: 16, backgroundColor: '#DDD8CB', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  point: { width: 0, height: 0, alignItems: 'center', justifyContent: 'center' },
  cap: { fontFamily: fonts.body500, fontSize: 11, color: colors.muted2, marginTop: 4, textAlign: 'center' },
});
