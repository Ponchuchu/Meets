import * as Location from 'expo-location';
import { LATER_MS, mayAutoAsk, noDialog, precision, shouldExplain } from '../live/accuracy';
jest.mock('expo-location', () => ({ getForegroundPermissionsAsync: jest.fn(), getProviderStatusAsync: jest.fn() }));
jest.mock('react-native', () => ({ Platform: { OS: 'android' }, Linking: { openSettings: jest.fn() } }));
jest.mock('../state/storage', () => ({ deviceStorage: () => undefined }));

it('системное окно Google «Повысить точность» само не всплывает', () => {
  expect(noDialog({ accuracy: 4 })).toEqual({ accuracy: 4, mayShowUserSettingsDialog: false });
});

it('разрешение спрашиваем сами только раз; «Не сейчас» держится 30 дней', () => {
  expect(mayAutoAsk(null)).toBe(true);
  expect(mayAutoAsk(Date.now())).toBe(false);
  const now = Date.now();
  expect(shouldExplain('approx', null, now)).toBe(true);
  expect(shouldExplain('approx', now - 1000, now)).toBe(false);
  expect(shouldExplain('approx', now - LATER_MS - 1, now)).toBe(true);
  expect(shouldExplain('precise', null, now)).toBe(false);
  expect(shouldExplain('none', null, now)).toBe(false);
});

it('приблизительно: «Примерно» в разрешении или выключена точность Google', async () => {
  const perm = Location.getForegroundPermissionsAsync as jest.Mock;
  const prov = Location.getProviderStatusAsync as jest.Mock;
  perm.mockResolvedValue({ granted: true, android: { accuracy: 'coarse' } });
  await expect(precision()).resolves.toBe('approx');
  perm.mockResolvedValue({ granted: true, android: { accuracy: 'fine' } });
  prov.mockResolvedValue({ networkAvailable: false });
  await expect(precision()).resolves.toBe('approx');
  prov.mockResolvedValue({ networkAvailable: true });
  await expect(precision()).resolves.toBe('precise');
  perm.mockResolvedValue({ granted: false });
  await expect(precision()).resolves.toBe('none');
});
