// Токены из docs/DESIGN.md. Любой цвет, шрифт и радиус в приложении берётся отсюда.

export const colors = {
  ink: '#17161A',
  paper: '#F3F0E8',
  card: '#FBFAF6',
  cardAlt: '#FBF9F4',
  sand: '#E7E2D6',
  sand2: '#E9E5DB',
  line: '#DDD8CC',
  line2: '#CFC9BB',
  muted: '#55524C',
  muted2: '#3A3833',
  muted3: '#6B675F',
  accent: '#F0521F',
  accentText: '#8A3A12',
  friend: '#2447B8',
  friendLight: '#5B7FEA',
  ok: '#2F8F5B',
  darkCard: '#2A292E',
  softGreen: '#D9E4D2',
  softYellow: '#EADFB8',
  softBlue: '#D6E0EE',
  softPink: '#E5D3DC',
} as const;

export type ColorToken = keyof typeof colors;

export const mapPalettes = {
  paper: {
    land: '#EFEBE2', street: '#F6F3EC', highway: '#FBF9F4', park: '#DCE3CE', water: '#C4D5DB',
    mountains: ['#E8E3D8', '#E1DBCE', '#D9D2C3'], label: '#9A9387', district: '#BDB6A8',
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

export const radius = {
  feedCard: 26,
  card: 24,
  button: 16,
  field: 14,
  chip: 999,
  plate: 10,
} as const;

export const space = {
  screen: 16,
  block: 20,
} as const;

export const shadows = {
  card: { shadowColor: colors.ink, shadowOpacity: 0.14, shadowRadius: 17, shadowOffset: { width: 0, height: 14 }, elevation: 8 },
  float: { shadowColor: colors.ink, shadowOpacity: 0.3, shadowRadius: 12, shadowOffset: { width: 0, height: 10 }, elevation: 10 },
  small: { shadowColor: colors.ink, shadowOpacity: 0.3, shadowRadius: 1.5, shadowOffset: { width: 0, height: 1 }, elevation: 2 },
} as const;

export const type = {
  screenTitle: { fontFamily: fonts.display700, fontSize: 30, color: colors.ink, letterSpacing: -0.6 },
  blockTitle: { fontFamily: fonts.display700, fontSize: 21, color: colors.ink },
  body: { fontFamily: fonts.body400, fontSize: 15, color: colors.ink },
  secondary: { fontFamily: fonts.body400, fontSize: 13.5, color: colors.muted },
  label: { fontFamily: fonts.mono600, fontSize: 11, letterSpacing: 0.8, color: colors.muted, textTransform: 'uppercase' as const },
} as const;

export const layout = {
  tabBarHeight: 84,
} as const;
