// «Стекло» для кнопок поверх карты и таб-бара: полупрозрачная светлая подложка, на вебе — с размытием.
import { Platform, type ViewStyle } from 'react-native';

const WEB = Platform.OS === 'web'
  ? ({ backdropFilter: 'blur(16px) saturate(170%)', WebkitBackdropFilter: 'blur(16px) saturate(170%)' } as object)
  : {};

export const glass: ViewStyle = {
  backgroundColor: Platform.OS === 'web' ? 'rgba(251,249,244,0.6)' : 'rgba(251,249,244,0.82)',
  borderWidth: 1,
  borderColor: 'rgba(255,255,255,0.75)',
  shadowColor: '#17161A', shadowOpacity: 0.1, shadowRadius: 10, shadowOffset: { width: 0, height: 4 }, elevation: 4,
  ...WEB,
};
