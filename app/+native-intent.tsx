// Ссылки извне (уведомления, «Открыть» после обновления): пустой путь «meets:///» ведём на главный экран.
export function redirectSystemPath({ path }: { path: string; initial: boolean }) {
  try {
    const p = path.replace(/^[a-z]+:\/\/+/i, '/');
    if (p === '/admin' || p.startsWith('/admin?')) return '/dev?tab=events';
    return p === '/' || p === '' ? '/' : path;
  } catch {
    return '/';
  }
}
