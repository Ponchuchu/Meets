const mockSend = jest.fn();
const mockChannel = jest.fn(() => ({ httpSend: mockSend }));
const mockRemove = jest.fn().mockResolvedValue('ok');
const mockAuth = jest.fn().mockResolvedValue(undefined);
jest.mock('../data/client', () => ({ supabase: () => ({ channel: mockChannel, removeChannel: mockRemove, realtime: { setAuth: mockAuth } }) }));
jest.mock('../data/realtime', () => ({ isRemoteId: (s: string | undefined) => !!s && /^[0-9a-f-]{36}$/.test(s) }));
import { sendMapSticker, stickerTopic } from '../stickers/mapRealtime';

it('отправляет пакет в приватный канал без сообщений чата', async () => {
  const a = '00000000-0000-4000-8000-000000000001', b = '00000000-0000-4000-8000-000000000002';
  mockSend.mockResolvedValue({ success: true });
  await sendMapSticker(a, b, 'heart', 42);
  expect(mockChannel).toHaveBeenCalledWith(stickerTopic(a, b), { config: { private: true } });
  expect(mockSend).toHaveBeenCalledWith('sticker', { sticker: 'heart', count: 42 });
  expect(mockRemove).toHaveBeenCalledTimes(1);
  await expect(sendMapSticker(a, b, 'heart', 101)).rejects.toThrow();
  await expect(sendMapSticker(a, a, 'heart', 1)).rejects.toThrow();
});

it('не скрывает отказ отправки', async () => {
  mockSend.mockResolvedValue({ success: false, status: 403 });
  await expect(sendMapSticker('00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000002', 'heart', 1)).rejects.toThrow();
});
