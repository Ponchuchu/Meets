import { useState } from 'react';
import { Check, Lock, X } from 'lucide-react-native';
import { Modal, Pressable, ScrollView, Text, View } from 'react-native';
import { AvatarFrame, frameById, ILLUSTRATED_FRAMES, LEGACY_FRAMES } from '../../profile/frames';
import { colors, fonts } from '../../theme';

export function FramePicker({ selected, level, image, initial, busy, error, onSelect }: {
  selected: string; level: number; image?: string | null; initial: string; busy: boolean; error?: string; onSelect: (id: string) => Promise<void>;
}) {
  const [preview, setPreview] = useState<string | null>(null);
  const [showLegacy, setShowLegacy] = useState(false);
  const frame = frameById(preview ?? selected);
  const current = frameById(selected);
  const locked = level < frame.level;
  const chosen = frame.id === selected;
  return <View style={{ gap: 16 }}>
    <Text style={{ fontFamily: fonts.display700, fontSize: 22, color: colors.ink }}>Твоя рамка</Text>
    <Text style={{ fontFamily: fonts.body400, color: colors.muted, lineHeight: 21 }}>Маленькие истории Алматы. Рассмотри любую — доступные можно выбрать для профиля и карты.</Text>
    <Pressable accessibilityRole="button" accessibilityLabel="Посмотреть текущую рамку" onPress={() => setPreview(current.id)} style={{ flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12, borderRadius: 20, backgroundColor: '#F5F1E8' }}>
      <AvatarFrame frameId={current.id} photo={image} initial={initial} size={64} />
      <View style={{ flex: 1, gap: 4 }}><Text style={{ fontFamily: fonts.body700, color: colors.ink }}>{current.name}</Text><Text style={{ fontFamily: fonts.body400, fontSize: 12, color: colors.muted }}>Сейчас в профиле и на карте</Text></View>
      <Check size={18} color={current.color} />
    </Pressable>
    <Modal visible={preview !== null} transparent animationType="fade" onRequestClose={() => setPreview(null)}>
      <View style={{ flex: 1, justifyContent: 'center', padding: 20, backgroundColor: 'rgba(23,22,26,0.45)' }}>
      <View accessibilityViewIsModal style={{ maxHeight: '90%', width: '100%', maxWidth: 420, alignSelf: 'center', backgroundColor: colors.paper, borderRadius: 28, padding: 16, gap: 12 }}>
      <Pressable accessibilityRole="button" accessibilityLabel="Закрыть предпросмотр рамки" onPress={() => setPreview(null)} style={{ minHeight: 44, minWidth: 44, alignSelf: 'flex-end', alignItems: 'center', justifyContent: 'center' }}><X size={22} color={colors.ink} /></Pressable>
      <ScrollView contentContainerStyle={{ gap: 16 }}>
      <View style={{ alignItems: 'center', gap: 10, paddingVertical: 18, paddingHorizontal: 12, borderRadius: 24, backgroundColor: frame.paper }}>
      <AvatarFrame frameId={frame.id} photo={image} initial={initial} size={144} />
      <Text style={{ fontFamily: fonts.display700, fontSize: 20, textAlign: 'center', color: frame.id === 'starry-night' ? '#F7EAD0' : colors.ink }}>{frame.name}</Text>
      <Text style={{ fontFamily: fonts.body400, fontSize: 14, lineHeight: 20, textAlign: 'center', color: frame.id === 'starry-night' ? '#D6DFED' : colors.muted }}>{frame.description}</Text>
    </View>
    <Pressable accessibilityRole="button" accessibilityLabel={locked ? `Рамка откроется на уровне ${frame.level}` : chosen ? 'Рамка выбрана' : `Выбрать рамку «${frame.name}»`}
      disabled={busy || locked || chosen} accessibilityState={{ disabled: busy || locked || chosen, busy }} onPress={() => { void onSelect(frame.id); }}
      style={{ minHeight: 48, padding: 12, borderRadius: 18, backgroundColor: locked || chosen ? colors.sand : colors.ink, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
      {locked ? <Lock size={16} color={colors.muted} /> : chosen ? <Check size={18} color={colors.ink} /> : null}
      <Text style={{ fontFamily: fonts.body700, color: locked || chosen ? colors.ink : colors.paper }}>{busy ? 'Сохраняю…' : locked ? `Откроется на уровне ${frame.level}` : chosen ? 'Выбрана' : 'Выбрать рамку'}</Text>
    </Pressable>
      {!!error && <Text accessibilityRole="alert" style={{ color: colors.accentText }}>{error}</Text>}
      </ScrollView></View></View>
    </Modal>
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
      {[...ILLUSTRATED_FRAMES, ...(showLegacy ? LEGACY_FRAMES : [])].map(f => <Pressable key={f.id} accessibilityRole="button" accessibilityLabel={`Посмотреть рамку «${f.name}»`}
        onPress={() => setPreview(f.id)} style={{ flexBasis: '47%', flexGrow: 1, minHeight: 150, alignItems: 'center', justifyContent: 'center', gap: 7, padding: 10, borderRadius: 20, borderWidth: 1.5, borderColor: f.id === selected ? f.color : 'transparent', backgroundColor: '#F5F1E8' }}>
        <AvatarFrame frameId={f.id} photo={image} initial={initial} size={82} />
        <Text style={{ fontFamily: fonts.body600, fontSize: 13, textAlign: 'center', color: colors.ink }}>{f.name}</Text>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
          {level < f.level && <Lock size={11} color={colors.muted} />}
          <Text style={{ fontFamily: fonts.body400, fontSize: 12, color: f.id === selected ? f.color : colors.muted }}>{f.id === selected ? 'Выбрана' : level < f.level ? `Уровень ${f.level}` : 'Доступна'}</Text>
        </View>
      </Pressable>)}
    </View>
    <Pressable accessibilityRole="button" accessibilityState={{ expanded: showLegacy }} onPress={() => setShowLegacy(x => !x)} style={{ minHeight: 44, justifyContent: 'center' }}>
      <Text style={{ fontFamily: fonts.body600, textAlign: 'center', color: colors.muted }}>{showLegacy ? 'Скрыть классическую коллекцию' : 'Классическая коллекция · 4 рамки'}</Text>
    </Pressable>
  </View>;
}
