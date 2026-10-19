// Вход через Supabase Auth: выход и удаление аккаунта (вход — alpha-login, src/live/auth.ts).
import { useOutbox } from '../live/outbox';
import { unregisterDevicePush } from '../live/push';
import { supabase, withTimeout } from '../data/client';

/** «707 123 45 67» → «+77071234567». */
export const e164 = (formatted: string) => `+7${formatted.replace(/\D/g, '')}`;

export async function signOut(): Promise<void> {
  try {
    await unregisterDevicePush().catch(() => undefined);
    useOutbox.setState({ items: [] });
    await supabase().auth.signOut();
  } catch {
    // вход был демо — выходить неоткуда
  }
}

/** Удалить аккаунт навсегда (App Store 5.1.1): сервер стирает человека и всё, что с ним связано. */
export async function deleteAccount(): Promise<boolean> {
  try {
    const { data } = await supabase().auth.getSession();
    if (!data.session) return true; // демо-вход: удалять на сервере нечего
    const { error } = await withTimeout(supabase().rpc('delete_my_account'));
    if (error) return false;
    await unregisterDevicePush().catch(() => undefined);
    useOutbox.setState({ items: [] });
    await supabase().auth.signOut();
    return true;
  } catch {
    return false;
  }
}
