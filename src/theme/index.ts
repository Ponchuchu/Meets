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
    land: '#D9D4C6', street: '#E7E2D5', highway: '#EDE8DC', park: '#C6D0B6', water: '#A9C4D0', waterEdge: '#8FAEBC',
    mountains: ['#D0CABC', '#C9C2B3', '#C1BAA9'], label: '#7C7568', district: '#9A9384',
    extrude: '#E3DBCB',
  },
  night: {
    land: '#1C1D21', street: '#222328', highway: '#2E3036', park: '#1F2924', water: '#1C2E36', waterEdge: '#244050',
    mountains: ['#202125', '#24252A', '#28292E'], label: '#62656F', district: '#45474F',
    extrude: '#2C2D33',
  },
  mono: {
    land: '#FAFAF8', street: '#F1F1ED', highway: '#FFFFFF', park: '#EEF0E9', water: '#E6ECEE', waterEdge: '#D3DDE1',
    mountains: ['#F4F4F0', '#EEEEE9', '#E8E8E2'], label: '#A5A59E', district: '#C4C4BD',
    extrude: '#F3F3EE',
  },
} as const;

export type MapTheme = keyof typeof mapPalettes;

// Имена семейств совпадают с ключами, под которыми шрифты грузятся в app/_layout.tsx.
// Один шрифт на всё приложение — Rubik (выбор владельца 25 октября: «не так ИИ-дизайно»).
// Ключи прежние, чтобы не трогать экраны: display — заголовки, body — текст, mono — мелкие подписи и цифры.
export const fonts = {
  display600: 'Rubik_600SemiBold',
  display700: 'Rubik_700Bold',
  display800: 'Rubik_800ExtraBold',
  body400: 'Rubik_400Regular',
  body500: 'Rubik_500Medium',
  body600: 'Rubik_600SemiBold',
  body700: 'Rubik_700Bold',
  mono500: 'Rubik_500Medium',
  mono600: 'Rubik_600SemiBold',
  /** «От руки» — заставка, «привет», «добро пожаловать» (V6 §2). */
  hand: 'Pacifico_400Regular',
} as const;

/** Радиусы: плашки и чипсы — sm, кнопки и поля — md, карточки — lg, шторки и плавающие панели — xl. */
export const radii = { sm: 10, md: 14, lg: 20, xl: 28, pill: 999 } as const;
/** Шаг отступов: 4 · 8 · 12 · 16 · 24. Края экрана — 16, между карточками — 10–12. */
export const space = { xs: 4, s: 8, m: 12, l: 16, xl: 24 } as const;
