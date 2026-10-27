// Запуск GitHub Actions (search.yml, covers.yml) через workflow_dispatch. Токен — секрет GITHUB_DISPATCH_TOKEN.
export const REPO = 'Ponchuchu/Meets';

export async function dispatch(workflow: string, inputs: Record<string, string>): Promise<string | null> {
  const token = Deno.env.get('GITHUB_DISPATCH_TOKEN');
  if (!token) return 'нет токена GitHub (GITHUB_DISPATCH_TOKEN) — запуск только вручную в Actions';
  const res = await fetch(`https://api.github.com/repos/${REPO}/actions/workflows/${workflow}/dispatches`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, Accept: 'application/vnd.github+json', 'User-Agent': 'ryadom-robot' },
    body: JSON.stringify({ ref: Deno.env.get('ROBOT_GITHUB_REF') || 'main', inputs }),
  });
  return res.ok ? null : `GitHub ${res.status}: ${(await res.text()).slice(0, 160)}`;
}

/** Проверка токена без запуска: видит ли он воркфлоу. null — всё хорошо, иначе — текст ошибки. */
export async function checkToken(workflow = 'search.yml'): Promise<string | null> {
  const token = Deno.env.get('GITHUB_DISPATCH_TOKEN');
  if (!token) return 'нет токена GitHub (GITHUB_DISPATCH_TOKEN)';
  const res = await fetch(`https://api.github.com/repos/${REPO}/actions/workflows/${workflow}`, {
    headers: { Authorization: `Bearer ${token}`, Accept: 'application/vnd.github+json', 'User-Agent': 'ryadom-robot' },
  });
  return res.ok ? null : `GitHub ${res.status}: ${(await res.text()).slice(0, 160)}`;
}
