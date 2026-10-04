// «Добро пожаловать» — design/png/V5LoginDone.png. Имя пишется от руки, через 3 с — карта (тап — сразу).
import { router } from 'expo-router';
import { useEffect, useRef } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { setSetting } from '../../src/live/api';
import { useSession } from '../../src/state/session';
import { colors } from '../../src/theme';
import { Hand } from '../../src/ui/v6/Hand';
import { MascotField } from '../../src/ui/v6/Mascot';
import { OrangeBg } from '../../src/ui/v6/OrangeBg';
import { skipSplash } from '../../src/ui/v6/Splash';

export default function Done() {
  const name = useSession((s) => s.draft.name) || 'друг';
  const finish = useSession((s) => s.finish);
  const gone = useRef(false);

  const go = () => {
    if (gone.current) return;
    gone.current = true;
    void setSetting('onboarded', true).catch(() => undefined);
    skipSplash();
    finish();
    router.replace('/');
  };
  useEffect(() => {
    const t = setTimeout(go, 3000);
    return () => clearTimeout(t);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <Pressable style={styles.root} onPress={go} accessibilityRole="button" accessibilityLabel={`Добро пожаловать, ${name}. Открыть карту`}>
      <OrangeBg />
      <View style={styles.field}><MascotField variant="welcome" /></View>
      <View style={styles.center}>
        <Hand text="добро пожаловать" size={34} ms={1100} />
        <Hand text={name} size={76} color={colors.ink} delay={1100} ms={900} />
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  field: { position: 'absolute', left: '50%', marginLeft: -195, top: 0, width: 390, height: 844 },
  center: { alignItems: 'center', gap: 0, marginTop: -60 },
});
