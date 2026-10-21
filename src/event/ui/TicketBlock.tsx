// «Мой билет» в карточке плана (21 октября): купил в Kaspi, на Ticketon или на кассе — прикрепи снимок или QR,
// и он будет под рукой на входе. Хранится только на телефоне, в папке приложения (не в кэше), никому не отправляется.
import { Directory, File, Paths } from 'expo-file-system';
import * as ImagePicker from 'expo-image-picker';
import { Plus, Ticket, Trash2, X } from 'lucide-react-native';
import { useState } from 'react';
import { Image, Modal, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { usePlans } from '../../state/plans';
import { colors, fonts } from '../../theme';
import { plate } from '../../ui/glass';

export function TicketBlock({ eventId }: { eventId: string }) {
  const list = usePlans((s) => s.tickets?.[eventId] ?? []);
  const add = usePlans((s) => s.addTicket);
  const remove = usePlans((s) => s.removeTicket);
  const [full, setFull] = useState<string | null>(null);
  const pick = async () => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) return;
    const r = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.9 });
    if (r.canceled || !r.assets[0]) return;
    // Копия в постоянную папку приложения: кэш телефон (и наша автоочистка) может стереть.
    let uri = r.assets[0].uri;
    if (Platform.OS !== 'web') {
      try {
        const dir = new Directory(Paths.document, 'tickets');
        if (!dir.exists) dir.create();
        const dest = new File(dir, `${eventId.replace(/[^a-zA-Z0-9-]/g, '')}-${Date.now()}.jpg`);
        new File(uri).copy(dest);
        uri = dest.uri;
      } catch { /* не вышло — держим исходный снимок */ }
    }
    add(eventId, uri);
  };
  return (
    <View style={styles.card}>
      <View style={styles.head}>
        <View style={styles.icon}><Ticket size={18} color={colors.ink} strokeWidth={2} /></View>
        <View style={{ flex: 1 }}>
          <Text style={styles.title}>Мой билет</Text>
          <Text style={styles.sub}>{list.length ? 'Покажи на входе — нажми, чтобы открыть' : 'Купил в Kaspi или на сайте? Прикрепи снимок или QR'}</Text>
        </View>
      </View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
        {list.map((u) => (
          <Pressable key={u} onPress={() => setFull(u)} style={styles.thumb} accessibilityRole="imagebutton" accessibilityLabel="Открыть билет">
            <Image source={{ uri: u }} style={StyleSheet.absoluteFill} resizeMethod="resize" />
          </Pressable>
        ))}
        <Pressable onPress={() => void pick()} style={[styles.thumb, styles.add]} accessibilityRole="button" accessibilityLabel="Прикрепить билет">
          <Plus size={22} color={colors.muted2} strokeWidth={2} />
          <Text style={styles.addText}>Билет</Text>
        </Pressable>
      </ScrollView>
      <Modal visible={!!full} transparent animationType="fade" onRequestClose={() => setFull(null)}>
        <View style={styles.viewer}>
          {full && <Image source={{ uri: full }} style={{ width: '100%', height: '80%' }} resizeMode="contain" />}
          <View style={styles.bar}>
            <Pressable onPress={() => { if (full) remove(eventId, full); setFull(null); }} style={styles.round} accessibilityRole="button" accessibilityLabel="Убрать билет"><Trash2 size={22} color="#FFFFFF" strokeWidth={2} /></Pressable>
            <Pressable onPress={() => setFull(null)} style={styles.round} accessibilityRole="button" accessibilityLabel="Закрыть"><X size={22} color="#FFFFFF" strokeWidth={2} /></Pressable>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { padding: 14, borderRadius: 22, ...plate, gap: 12 },
  head: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  icon: { width: 40, height: 40, borderRadius: 13, backgroundColor: colors.accent, alignItems: 'center', justifyContent: 'center' },
  title: { fontFamily: fonts.body700, fontSize: 15.5, color: colors.ink },
  sub: { fontFamily: fonts.body400, fontSize: 13, color: colors.muted2 },
  thumb: { width: 76, height: 96, borderRadius: 14, overflow: 'hidden', backgroundColor: colors.sand },
  add: { alignItems: 'center', justifyContent: 'center', gap: 4, borderWidth: 1.5, borderStyle: 'dashed', borderColor: colors.line2 },
  addText: { fontFamily: fonts.body600, fontSize: 12, color: colors.muted2 },
  viewer: { flex: 1, backgroundColor: '#0D0D10', alignItems: 'center', justifyContent: 'center' },
  bar: { position: 'absolute', bottom: 40, flexDirection: 'row', gap: 24 },
  round: { width: 56, height: 56, borderRadius: 28, backgroundColor: 'rgba(255,255,255,0.14)', alignItems: 'center', justifyContent: 'center' },
});
