// Токены из docs/DESIGN.md. Любой цвет, шрифт и радиус в приложении берётся отсюда.

export const colors = {
  ink: '#17161A',
  paper: '#E2DDD0',
  card: '#EEE9DE',
  cardAlt: '#EBE6DA',
  sand: '#D5CFC1',
  sand2: '#D9D4C7',
  line: '#C8C2B2',
  line2: '#BAB3A2',
  muted: '#55524C',
  muted2: '#3A3833',
  muted3: '#6B675F',
  accent: '#F0521F',
  accentText: '#8A3A12',
  friend: '#2447B8',
  friendLight: '#5B7FEA',
  ok: '#2F8F5B',
  darkCard: '#2A292E',
  softGreen: '#C5D3BB',
  softYellow: '#D9CC9E',
  softBlue: '#BFCCDF',
  softPink: '#D2BCC8',
} as const;

export const mapPalettes = {
  paper: {
    land: '#D9D4C6', street: '#E7E2D5', highway: '#EDE8DC', park: '#C6D0B6', water: '#AFC3CB',
    mountains: ['#D0CABC', '#C9C2B3', '#C1BAA9'], label: '#7C7568', district: '#9A9384',
  },
  night: {
    land: '#1C1D21', street: '#222328', highway: '#2E3036', park: '#1F2924', water: '#1C2E36',
    mountains: ['#202125', '#24252A', '#28292E'], label: '#62656F', district: '#45474F',
  },
  mono: {
    land: '#FAFAF8', street: '#F1F1ED', highway: '#FFFFFF', park: '#EEF0E9', water: '#E6ECEE',
    mountains: ['#F4F4F0', '#EEEEE9', '#E8E8E2'], label: '#A5A59E', district: '#C4C4BD',
  },
} as const;

export type MapTheme = keyof typeof mapPalettes;

// Имена семейств совпадают с ключами, под которыми шрифты грузятся в app/_layout.tsx.
export const fonts = {
  display600: 'Geologica_600SemiBold',
  display700: 'Geologica_700Bold',
  display800: 'Geologica_800ExtraBold',
  body400: 'GolosText_400Regular',
  body500: 'GolosText_500Medium',
  body600: 'GolosText_600SemiBold',
  body700: 'GolosText_700Bold',
  mono500: 'JetBrainsMono_500Medium',
  mono600: 'JetBrainsMono_600SemiBold',
  /** «От руки» — заставка, «привет», «добро пожаловать» (V6 §2). */
  hand: 'Pacifico_400Regular',
} as const;

export const shadows = {
  card: { shadowColor: colors.ink, shadowOpacity: 0.14, shadowRadius: 17, shadowOffset: { width: 0, height: 14 }, elevation: 8 },
  float: { shadowColor: colors.ink, shadowOpacity: 0.3, shadowRadius: 12, shadowOffset: { width: 0, height: 10 }, elevation: 10 },
  small: { shadowColor: colors.ink, shadowOpacity: 0.3, shadowRadius: 1.5, shadowOffset: { width: 0, height: 1 }, elevation: 2 },
} as const;
