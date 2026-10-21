// «Плашка» поверх карты и контента (референс владельца, 20.10): тёплый белый фон, тонкая градиентная кромка
// (сверху светлая, снизу темнее), внутренний блик по верхнему краю и мягкая тень. Без размытия на телефонах —
// boxShadow статичный и дешёвый; фон плотный, поэтому тень не просвечивает «восьмиугольником» на Android (FIX1 И2 п.4).
// Web: лёгкое размытие под стеклом.
import { Platform, type ViewStyle } from 'react-native';

const WEB = Platform.OS === 'web'
  ? ({ backdropFilter: 'blur(16px) saturate(170%)', WebkitBackdropFilter: 'blur(16px) saturate(170%)' } as object)
  : {};

/** Кромка: сверху почти белая, по бокам — волосок, снизу чуть темнее — читается как градиентная рамка стекла. */
export const edgeBorder: ViewStyle = {
  borderWidth: 1,
  borderTopColor: 'rgba(255,255,255,0.95)',
  borderLeftColor: 'rgba(23,22,26,0.07)',
  borderRightColor: 'rgba(23,22,26,0.07)',
  borderBottomColor: 'rgba(23,22,26,0.13)',
};

export const glass: ViewStyle = {
  backgroundColor: Platform.OS === 'web' ? 'rgba(252,251,248,0.94)' : '#FCFBF8',
  ...edgeBorder,
  boxShadow: 'inset 0 1px 1px rgba(255,255,255,0.9), 0 10px 26px -8px rgba(23,22,26,0.22), 0 2px 6px rgba(23,22,26,0.06)',
  ...WEB,
};

/** Та же плашка для карточек на бумажном фоне (без размытия, тень слабее). */
export const plate: ViewStyle = {
  backgroundColor: '#F1ECE2',
  ...edgeBorder,
  // На Android внутренняя тень дорого обходится при прокрутке (8+ карточек в профиле) — там только внешняя.
  boxShadow: Platform.OS === 'android' ? '0 6px 18px -10px rgba(23,22,26,0.25)' : 'inset 0 1px 1px rgba(255,255,255,0.75), 0 6px 18px -10px rgba(23,22,26,0.25)',
};
