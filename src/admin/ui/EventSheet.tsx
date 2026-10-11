// Карточка события из «Все»: посмотреть, переименовать, поставить своё фото, снять с карты, удалить (с подтверждением).
import { Camera, Check, X } from 'lucide-react-native';
import { useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import type { Category } from '../../data/types';
import { eventFacts } from '../../event/facts';
import { colors, fonts } from '../../theme';
import { EventCover } from '../../ui/EventCover';
import { Backdrop, BottomSheet } from '../../ui/sheet';
import { TITLE_MAX, TITLE_MIN, cleanTitle } from '../api';
import { Banner, Btn } from './kit';

export interface AdminEvent {
  id: string; title: string; category: Category; startsAt: string | null; venue: string | null; address: string | null;
  priceMin: number | null; priceMax: number | null; isFree: boolean; cover: string | null; source: string | null;
}

export function EventSheet({ ev, busy, error, note, onClose, onRename, onPhoto, onUnpublish, onDelete }: {
  ev: AdminEvent; busy: boolean; error: string | null; note: string | null; onClose: () => void;
  onRename: (title: string) => void; onPhoto: () => void; onUnpublish: () => void; onDelete: () => void;
}) {
  // Переименование открыто, пока название то же, что было при нажатии: сохранили — название сменилось — поле закрылось само.
  const [renamingFrom, setRenamingFrom] = useState<string | null>(null);
  const renaming = renamingFrom === ev.title;
  const [name, setName] = useState(ev.title);
  const [sure, setSure] = useState(false);
  const f = eventFacts({ startsAt: ev.startsAt, venueName: ev.venue, address: ev.address, priceMin: ev.priceMin, priceMax: ev.priceMax, isFree: ev.isFree });
  const clean = cleanTitle(name);
  const valid = !!clean && clean !== ev.title;

  return (
    <Modal transparent visible animationType="none" statusBarTranslucent onRequestClose={onClose}>
      <View style={StyleSheet.absoluteFill}>
        <Backdrop label="Закрыть" onPress={onClose} />
        <BottomSheet label="Карточка события" onClose={onClose} scroll style={{ paddingHorizontal: 0 }}>
          <View style={styles.hero}>
            <EventCover cover={ev.cover} category={ev.category} style={StyleSheet.absoluteFill} iconSize={90} />
            <Pressable onPress={onClose} style={styles.close} accessibilityRole="button" accessibilityLabel="Закрыть"><X size={20} color={colors.ink} strokeWidth={2} /></Pressable>
          </View>
          <View style={styles.body}>
            {renaming ? (
              <View style={{ gap: 8 }}>
                <TextInput value={name} onChangeText={setName} style={styles.input} autoFocus maxLength={TITLE_MAX + 20} accessibilityLabel="Новое название" returnKeyType="done"
                  onSubmitEditing={() => valid && onRename(clean)} />
                <Text style={styles.count}>{name.trim().length} / {TITLE_MAX}{name.trim().length < TITLE_MIN ? ` · минимум ${TITLE_MIN}` : ''}</Text>
                <View style={styles.two}>
                  <Btn flex label={busy ? 'Сохраняю…' : 'Сохранить'} disabled={!valid || busy} onPress={() => valid && onRename(clean)} />
                  <Btn label="Отмена" kind="ghost" onPress={() => { setRenamingFrom(null); setName(ev.title); }} />
                </View>
              </View>
            ) : (
              <Text style={styles.title}>{ev.title}</Text>
            )}
            <View style={{ gap: 6 }}>
              <Fact k="Когда" v={f.when} bad={f.whenMissing || f.when.includes('время не указано')} />
              <Fact k="Где" v={f.place} bad={f.placeMissing} />
              <Fact k="Цена" v={f.price} bad={f.priceMissing} />
            </View>
            {!!error && <Banner tone="error" text={error} />}
            {!!note && !error && <Banner tone="ok" text={note} />}
            {sure ? (
              <View style={styles.confirm}>
                <Text style={styles.confirmH}>Удалить событие?</Text>
                <Text style={styles.confirmT}>Оно исчезнет с карты и из списка, поиск его не вернёт. Планы и чаты людей останутся.</Text>
                <View style={styles.two}>
                  <Pressable onPress={onDelete} disabled={busy} style={[styles.danger, busy && { opacity: 0.5 }]} accessibilityRole="button"><Text style={styles.dangerT}>{busy ? 'Удаляю…' : 'Удалить'}</Text></Pressable>
                  <Btn label="Отмена" kind="ghost" onPress={() => setSure(false)} />
                </View>
              </View>
            ) : (
              <View style={{ gap: 10 }}>
                <Pressable onPress={onPhoto} disabled={busy} style={[styles.photo, busy && { opacity: 0.5 }]} accessibilityRole="button">
                  <Camera size={18} color={colors.ink} strokeWidth={1.9} /><Text style={styles.photoT}>{ev.cover ? 'Заменить фото' : 'Добавить своё фото'}</Text>
                </Pressable>
                <Btn label="Снять с карты" disabled={busy} onPress={onUnpublish} />
                <View style={styles.two}>
                  <Btn flex kind="ghost" label="Переименовать" disabled={busy || renaming} onPress={() => { setName(ev.title); setRenamingFrom(ev.title); }} />
                  <Pressable onPress={() => setSure(true)} disabled={busy} style={[styles.delGhost, busy && { opacity: 0.5 }]} accessibilityRole="button"><Text style={styles.delGhostT}>Удалить</Text></Pressable>
                </View>
                <Text style={styles.hintT}>«Снять с карты» вернёт событие в «Новые».</Text>
              </View>
            )}
          </View>
        </BottomSheet>
      </View>
    </Modal>
  );
}

function Fact({ k, v, bad }: { k: string; v: string; bad?: boolean }) {
  return (
    <View style={styles.fact}>
      {bad ? <X size={14} color={colors.accentText} strokeWidth={2.2} /> : <Check size={14} color={colors.muted} strokeWidth={2.2} />}
      <Text style={styles.k}>{k}</Text>
      <Text style={[styles.v, bad && { color: colors.accentText }]} numberOfLines={2}>{v}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  hero: { height: 170, overflow: 'hidden', marginTop: -10 },
  close: { position: 'absolute', left: 14, top: 14, width: 44, height: 44, borderRadius: 22, backgroundColor: 'rgba(248,246,240,0.92)', alignItems: 'center', justifyContent: 'center' },
  body: { paddingHorizontal: 16, gap: 14 },
  title: { fontFamily: fonts.display700, fontSize: 22, lineHeight: 27, color: colors.ink, letterSpacing: -0.3 },
  input: { minHeight: 48, borderRadius: 14, borderWidth: 1, borderColor: colors.line2, backgroundColor: colors.card, paddingHorizontal: 14, fontFamily: fonts.body600, fontSize: 16, color: colors.ink },
  count: { fontFamily: fonts.mono500, fontSize: 11, color: colors.muted3 },
  two: { flexDirection: 'row', gap: 10 },
  fact: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  k: { width: 48, fontFamily: fonts.mono500, fontSize: 11, color: colors.muted3, textTransform: 'uppercase' },
  v: { flex: 1, fontFamily: fonts.body600, fontSize: 14, color: colors.ink },
  photo: { minHeight: 48, borderRadius: 14, borderWidth: 1, borderColor: colors.line2, backgroundColor: colors.card, flexDirection: 'row', gap: 8, alignItems: 'center', justifyContent: 'center' },
  photoT: { fontFamily: fonts.body700, fontSize: 15, color: colors.ink },
  delGhost: { minHeight: 48, paddingHorizontal: 18, borderRadius: 14, backgroundColor: '#EDC6B2', alignItems: 'center', justifyContent: 'center' },
  delGhostT: { fontFamily: fonts.body700, fontSize: 15, color: colors.accentText },
  confirm: { backgroundColor: '#EDC6B2', borderRadius: 16, padding: 14, gap: 8 },
  confirmH: { fontFamily: fonts.display700, fontSize: 17, color: colors.accentText },
  confirmT: { fontFamily: fonts.body400, fontSize: 13.5, lineHeight: 19, color: colors.ink },
  danger: { flex: 1, minHeight: 48, borderRadius: 14, backgroundColor: colors.accentText, alignItems: 'center', justifyContent: 'center' },
  dangerT: { fontFamily: fonts.body700, fontSize: 15, color: colors.paper },
  hintT: { fontFamily: fonts.body400, fontSize: 12.5, color: colors.muted, textAlign: 'center' },
});
