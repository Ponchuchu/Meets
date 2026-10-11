// Результат сборки доступен через git даже в среде без доступа к GitHub API.
// В отчёт попадают только статус и ссылки на сборку; ключи и полный ответ EAS не записываются.
import { execFileSync } from 'node:child_process';
import { mkdir, readFile, writeFile } from 'node:fs/promises';

const tag = process.env.GITHUB_REF_NAME ?? '';
if (!/^(apk|backend)-review-[a-zA-Z0-9.-]+$/.test(tag)) throw new Error('Ожидалась метка review-сборки');
const kind = tag.startsWith('apk-') ? 'apk' : 'backend';
let apkUrl = null, buildId = null, prUrl = null;
if (kind === 'apk') {
  try {
    const raw = JSON.parse(await readFile('/tmp/meets-eas-build.json', 'utf8'));
    const build = (Array.isArray(raw) ? raw : [raw]).find((b) => b.platform === 'ANDROID');
    if (build?.status === 'FINISHED') {
      const link = build.artifacts?.buildUrl ?? build.artifacts?.applicationArchiveUrl;
      if (typeof link === 'string' && link.startsWith('https://')) apkUrl = link;
      buildId = build.id ?? null;
    }
  } catch { /* Сбой до запуска EAS или ответ без завершённой сборки. */ }
  try {
    const link = (await readFile('/tmp/meets-pr-url.txt', 'utf8')).trim();
    if (link.startsWith(`https://github.com/${process.env.GITHUB_REPOSITORY}/pull/`)) prUrl = link;
  } catch { /* PR не удалось открыть или его ссылка отсутствует. */ }
}
const result = {
  kind, tag, source: process.env.GITHUB_SHA, status: apkUrl ? 'success' : process.env.RESULT_STATUS,
  job_status: process.env.RESULT_STATUS, stage: process.env.RESULT_STAGE,
  run_url: `https://github.com/${process.env.GITHUB_REPOSITORY}/actions/runs/${process.env.GITHUB_RUN_ID}`,
  ...(kind === 'apk' ? { apk_url: apkUrl, build_id: buildId, pr_url: prUrl } : {}),
};
const git = (...args) => execFileSync('git', args, { stdio: 'inherit' });
git('config', 'user.name', 'meets-build-bot');
git('config', 'user.email', 'meets-build-bot@users.noreply.github.com');
const branch = `build-results/${tag}`;
const exists = execFileSync('git', ['ls-remote', '--heads', 'origin', `refs/heads/${branch}`], { encoding: 'utf8' }).trim();
if (exists) { git('fetch', 'origin', branch); git('checkout', '-B', branch, 'FETCH_HEAD'); }
else git('checkout', '-b', branch);
await mkdir('docs/builds', { recursive: true });
const path = `docs/builds/${tag}.json`;
await writeFile(path, JSON.stringify(result, null, 2) + '\n');
git('add', path);
if (execFileSync('git', ['diff', '--cached', '--name-only'], { encoding: 'utf8' }).trim()) {
  git('commit', '-m', `Результат ${tag}`);
  git('push', 'origin', `HEAD:refs/heads/${branch}`);
}
console.log(`Результат: ${result.status}. ${result.run_url}`);
