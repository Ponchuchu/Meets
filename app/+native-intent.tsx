// Ссылки извне (уведомления, «Открыть» после обновления): пустой путь «meets:///» ведём на главный экран.
export function redirectSystemPath({ path }: { path: string; initial: boolean }) {
  try {
    const p = path.replace(/^[a-z]+:\/\/+/i, '/');
    return p === '/' || p === '' ? '/' : path;
  } catch {
    return '/';
  }
}
