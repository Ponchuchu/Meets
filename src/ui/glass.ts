// Фон кнопок поверх карты и таб-бара (V6MapTop): светлый rgba(251,250,246,0.96), тень, без внутренней рамки.
// Android: тень (elevation) просвечивает сквозь полупрозрачный фон «восьмиугольником» (FIX1 И2 п.4) — там фон плотный.
// Web: лёгкое размытие под стеклом.
import { Platform, type ViewStyle } from 'react-native';

const WEB = Platform.OS === 'web'
  ? ({ backdropFilter: 'blur(16px) saturate(170%)', WebkitBackdropFilter: 'blur(16px) saturate(170%)' } as object)
  : {};

export const glass: ViewStyle = {
  backgroundColor: Platform.OS === 'android' ? '#FBFAF6' : 'rgba(251,250,246,0.96)',
  shadowColor: '#17161A', shadowOpacity: 0.12, shadowRadius: 10, shadowOffset: { width: 0, height: 4 }, elevation: 4,
  ...WEB,
};
