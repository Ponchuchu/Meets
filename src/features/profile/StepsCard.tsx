import { Footprints, Check, Lock } from 'lucide-react-native';
import { Platform, Pressable, Text, View } from 'react-native';
import { enableSteps, STEP_GOALS, useSteps } from '../../live/steps';
import { colors, fonts } from '../../theme';
import { useState } from 'react';

export function StepsCard() {
  const { enabled, day, count, status, setEnabled } = useSteps();
  const [busy, setBusy] = useState(false);
  const today = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Almaty' });
  const steps = day === today ? count : 0;
  const next = STEP_GOALS.find(g => steps < g.steps);
  const turnOn = async () => { if (busy) return; setBusy(true); try { await enableSteps(); } catch { useSteps.setState({ status: 'unavailable' }); } finally { setBusy(false); } };
  return <View style={{ padding: 20, borderRadius: 24, backgroundColor: colors.card, gap: 14 }}>
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}><Footprints size={28} color={colors.accent} /><Text style={{ fontFamily: fonts.display700, fontSize: 22, color: colors.ink }}>Прогулка сегодня</Text></View>
    <Text style={{ fontFamily: fonts.display700, fontSize: 42, color: colors.ink }}>{steps.toLocaleString('ru-RU')} <Text style={{ fontSize: 16 }}>шагов</Text></Text>
    <View style={{ height: 8, borderRadius: 4, backgroundColor: colors.sand, overflow: 'hidden' }}><View style={{ width: `${Math.min(100, steps / 100)}%`, height: 8, backgroundColor: colors.accent }} /></View>
    <Text style={{ fontFamily: fonts.body400, color: colors.muted }}>{next ? `Ещё ${(next.steps - steps).toLocaleString('ru-RU')} шагов до +${next.points} очков` : 'Все задания на сегодня выполнены'}</Text>
    {STEP_GOALS.map(g => <View key={g.steps} style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>{steps >= g.steps ? <Check size={18} color={colors.ok} /> : <Lock size={18} color={colors.muted} />}<Text style={{ flex: 1, fontFamily: fonts.body600, color: colors.ink }}>{g.steps.toLocaleString('ru-RU')} шагов</Text><Text style={{ fontFamily: fonts.mono600, color: colors.accentText }}>+{g.points}</Text></View>)}
    <Text style={{ fontFamily: fonts.body400, color: colors.muted, lineHeight: 20 }}>{Platform.OS === 'web' ? 'Шаги доступны в приложении на телефоне.' : Platform.OS === 'ios' ? 'Шаги за сегодня из датчика телефона. Награды сохраняются после подключения к сети.' : 'Android считает шаги, пока приложение открыто. Шаги за весь день из других приложений пока не подключены.'}</Text>
    {status === 'denied' && <Text style={{ color: colors.accentText }}>Разреши физическую активность в настройках телефона</Text>}
    {status === 'unavailable' && <Text style={{ color: colors.muted }}>Датчик шагов недоступен на этом устройстве</Text>}
    <Pressable onPress={() => enabled ? setEnabled(false) : void turnOn()} disabled={busy} accessibilityRole="button" style={{ minHeight: 48, borderRadius: 16, backgroundColor: colors.ink, alignItems: 'center', justifyContent: 'center' }}><Text style={{ color: colors.paper, fontFamily: fonts.body600 }}>{busy ? 'Проверяю датчик…' : enabled ? 'Остановить подсчёт' : 'Подключить шаги'}</Text></Pressable>
  </View>;
}
