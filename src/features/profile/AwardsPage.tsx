// «Награды» (FIX3 Ф8): только медали — уровень и оформление живут в «Уровне», без повторов.
// Полученную медаль можно поставить рядом с именем (до трёх) — её увидят друзья в профиле.
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Check, X } from 'lucide-react-native';
import { useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { config } from '../../lib/config';
import { getMeStats } from '../../live/api';
import { getProfileExtras, saveProfileExtras } from '../../live/profileExtras';
import { stepHistory, stepsToday, useSteps } from '../../live/steps';
import { BADGES, BADGE_ICONS, badgeIcon } from '../../profile/badges';
import { stepAwards } from '../../profile/stepAwards';
import { colors, fonts, radii } from '../../theme';
import { BadgeMedal } from '../../ui/BadgeMedal';
import { plate } from '../../ui/glass';
import { SettingsPage } from '../../ui/v6/Settings';

interface Award { id: string; name: string; how: string; goal: number; progress: number; got: boolean; icon: string }
const todayKey = () => new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Almaty' });

export default function AwardsPage() {
  const live = config.dataMode !== 'demo';
  const qc = useQueryClient();
  const stats = useQuery({ queryKey: ['me', 'stats'], queryFn: getMeStats, enabled: live });
  const extras = useQuery({ queryKey: ['me', 'extras'], queryFn: getProfileExtras });
  const history = useQuery({ queryKey: ['me', 'steps'], queryFn: stepHistory, enabled: live });
  const steps = useSteps(stepsToday);
  const [open, setOpen] = useState<Award | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const base: Award[] = (live && stats.data?.badges.length ? stats.data.badges.map(b => ({ ...b, how: b.how ?? BADGES.find(x => x.id === b.id)?.how ?? '' }))
    : BADGES.map((b, i) => ({ ...b, progress: i < 2 ? b.goal : 0, got: !live && i < 2 }))).map(b => ({ ...b, icon: badgeIcon(b.id) }));
  const walk: Award[] = stepAwards(history.data ?? [], { day: todayKey(), steps }).map(a => ({ ...a, icon: BADGE_ICONS.boot }));
  const all = [...walk, ...base];
  const got = all.filter(a => a.got);
  const shown = extras.data?.shown ?? [];

  const toggle = async (a: Award) => {
    if (busy) return;
    const next = shown.includes(a.id) ? shown.filter(x => x !== a.id) : [...shown, a.id].slice(-3);
    setBusy(true); setError('');
    try { await saveProfileExtras({ shown: next }); await qc.invalidateQueries({ queryKey: ['me', 'extras'] }); await qc.invalidateQueries({ queryKey: ['people'] }); }
    catch { setError('Не получилось сохранить. Проверь связь'); }
    finally { setBusy(false); }
  };

  return (
    <SettingsPage title="Награды" sub={`${got.length} из ${all.length}. Полученную можно поставить рядом с именем.`}>
      <View style={styles.slots}>
        <Text style={styles.cap}>У ИМЕНИ</Text>
        <View style={{ flexDirection: 'row', gap: 10 }}>
          {[0, 1, 2].map(i => {
            const id = shown[i];
            const a = all.find(x => x.id === id);
            return a ? (
              <Pressable key={i} onPress={() => setOpen(a)} accessibilityRole="button" accessibilityLabel={`${a.name} у имени`}><BadgeMedal id={a.id} icon={a.icon} got size={46} /></Pressable>
            ) : <View key={i} style={styles.slotEmpty} />;
          })}
        </View>
      </View>

      <View style={styles.grid}>
        {all.map(a => (
          <Pressable key={a.id} onPress={() => setOpen(a)} style={({ pressed }) => [styles.cell, pressed && { transform: [{ scale: 0.96 }] }]} accessibilityRole="button" accessibilityLabel={`${a.name}${a.got ? ', получена' : `, ${a.progress} из ${a.goal}`}`}>
            <BadgeMedal id={a.id} icon={a.icon} got={a.got} progress={a.progress / Math.max(1, a.goal)} size={64} />
            <Text style={[styles.cellName, !a.got && { color: colors.muted }]} numberOfLines={2}>{a.name}</Text>
            {shown.includes(a.id) && <View style={styles.onName}><Check size={11} color={colors.paper} strokeWidth={3} /></View>}
          </Pressable>
        ))}
      </View>

      <Modal visible={!!open} transparent animationType="fade" onRequestClose={() => setOpen(null)}>
        <View style={styles.back}>
          <Pressable style={StyleSheet.absoluteFill} onPress={() => setOpen(null)} accessibilityLabel="Закрыть" />
          {open && (
            <View style={styles.sheet} accessibilityViewIsModal>
              <Pressable onPress={() => setOpen(null)} style={styles.close} accessibilityRole="button" accessibilityLabel="Закрыть"><X size={22} color={colors.ink} /></Pressable>
              <BadgeMedal id={open.id} icon={open.icon} got={open.got} progress={open.progress / Math.max(1, open.goal)} size={120} />
              <Text style={styles.name}>{open.name}</Text>
              <Text style={styles.how}>{open.how}</Text>
              {!open.got && (
                <View style={{ width: '100%', gap: 6 }}>
                  <View style={styles.track}><View style={[styles.fill, { width: `${Math.min(100, (open.progress / Math.max(1, open.goal)) * 100)}%` }]} /></View>
                  <Text style={styles.prog}>{open.progress.toLocaleString('ru-RU')} / {open.goal.toLocaleString('ru-RU')}</Text>
                </View>
              )}
              {open.got && (
                <Pressable disabled={busy} onPress={() => void toggle(open)} style={[styles.btn, shown.includes(open.id) && styles.btnGhost]} accessibilityRole="button">
                  <Text style={[styles.btnText, shown.includes(open.id) && { color: colors.ink }]}>{shown.includes(open.id) ? 'Убрать от имени' : shown.length >= 3 ? 'Поставить у имени вместо первой' : 'Поставить у имени'}</Text>
                </Pressable>
              )}
              {!!error && <Text style={{ color: colors.accentText }}>{error}</Text>}
            </View>
          )}
        </View>
      </Modal>
    </SettingsPage>
  );
}

const styles = StyleSheet.create({
  slots: { borderRadius: radii.xl - 4, ...plate, padding: 16, gap: 10, alignItems: 'center' },
  cap: { fontFamily: fonts.mono600, fontSize: 10.5, letterSpacing: 0.8, color: colors.muted },
  slotEmpty: { width: 46, height: 46, borderRadius: 23, borderWidth: 1.5, borderStyle: 'dashed', borderColor: colors.line2 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  cell: { width: '31%', flexGrow: 1, alignItems: 'center', gap: 6, paddingVertical: 14, paddingHorizontal: 6, borderRadius: 20, ...plate },
  cellName: { fontFamily: fonts.body600, fontSize: 12.5, lineHeight: 16, color: colors.ink, textAlign: 'center', minHeight: 32 },
  onName: { position: 'absolute', top: 8, right: 8, width: 18, height: 18, borderRadius: 9, backgroundColor: colors.ok, alignItems: 'center', justifyContent: 'center' },
  back: { flex: 1, backgroundColor: 'rgba(23,22,26,0.45)', justifyContent: 'center', padding: 24 },
  sheet: { borderRadius: 30, backgroundColor: colors.paper, padding: 22, paddingTop: 30, alignItems: 'center', gap: 10 },
  close: { position: 'absolute', top: 6, right: 6, width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  name: { fontFamily: fonts.display800, fontSize: 24, letterSpacing: -0.5, color: colors.ink, textAlign: 'center', marginTop: 6 },
  how: { fontFamily: fonts.body400, fontSize: 15, lineHeight: 21, color: colors.muted2, textAlign: 'center' },
  track: { height: 6, borderRadius: 3, backgroundColor: colors.sand, overflow: 'hidden' },
  fill: { height: 6, backgroundColor: colors.accent },
  prog: { fontFamily: fonts.mono600, fontSize: 12, color: colors.muted, textAlign: 'center' },
  btn: { alignSelf: 'stretch', minHeight: 52, borderRadius: 17, backgroundColor: colors.ink, alignItems: 'center', justifyContent: 'center', marginTop: 8 },
  btnGhost: { backgroundColor: colors.sand },
  btnText: { fontFamily: fonts.body700, fontSize: 15.5, color: colors.paper },
});
