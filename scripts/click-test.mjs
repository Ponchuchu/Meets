// Проверка нажатий (26 октября): открывает экраны web-версии (демо), по очереди нажимает каждую кнопку, ссылку,
// вкладку и переключатель и ловит ошибки — падения JS, экран «Что-то пошло не так», бесконечные перерисовки.
// После каждого нажатия экран открывается заново, чтобы следующая кнопка проверялась с чистого листа.
// «Выйти» и «Удалить» не нажимаем. Отчёт — в консоль и в docs/progress/click-test/report.md.
// Запуск: EXPO_PUBLIC_DATA_MODE=demo npx expo export -p web && node scripts/click-test.mjs [маршрут …]
import { createServer } from 'node:http';
import { existsSync } from 'node:fs';
import { mkdir, readFile, stat, writeFile } from 'node:fs/promises';
import { dirname, extname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const dist = join(root, 'dist');
const ROUTES = process.argv.slice(2).length ? process.argv.slice(2) : [
  '/', '/foryou', '/plans', '/chats', '/me', '/friends', '/activity', '/profile/steps', '/profile/places', '/profile/awards',
  '/solo', '/city-year', '/create', '/settings', '/event/jazz', '/person/igor', '/chat/dm-igor', '/dev',
];
const MAX = Number(process.env.CLICK_MAX || 30);
const SKIP = /выйти|удалить|log ?out|delete|сбросить/i;
const BROKEN = /Что-то пошло не так|Maximum update depth|Unexpected error|Cannot read propert/i;

const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.jpg': 'image/jpeg', '.ttf': 'font/ttf', '.svg': 'image/svg+xml', '.wav': 'audio/wav' };
const server = createServer(async (req, res) => {
  const clean = decodeURIComponent((req.url || '/').split('?')[0]);
  let f = join(dist, 'index.html');
  for (const p of [clean, `${clean}.html`, join(clean, 'index.html')]) { try { if ((await stat(join(dist, p))).isFile()) { f = join(dist, p); break; } } catch { /* дальше */ } }
  res.writeHead(200, { 'Content-Type': TYPES[extname(f)] || 'application/octet-stream' });
  res.end(await readFile(f));
}).listen(0);
const base = `http://localhost:${server.address().port}`;

const draft = { provider: 'google', phone: '', name: 'Данил', photo: 'danil', birthDate: '14.03.2001', interests: ['music', 'hike', 'games'], times: ['weekday', 'weekend'], withWho: 'friends', budget: 'mid' };
const session = { signedIn: true, onboarded: true, locationAsked: true, tutorialDone: true, taste: null, draft };
const preinstalled = '/opt/pw-browsers/chromium';
const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'], ...(existsSync(preinstalled) && (await stat(preinstalled)).isFile() ? { executablePath: preinstalled } : {}) });
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, locale: 'ru-RU', timezoneId: 'Asia/Almaty', isMobile: true, hasTouch: true });
// Внешние адреса (карта, фото) в проверке не нужны — отвечаем пустым, чтобы не ждать сеть.
await ctx.route(/^https?:\/\/(?!localhost)/, (r) => r.fulfill({ status: 204, body: '' }));
const page = await ctx.newPage();
let errors = [];
page.on('pageerror', (e) => errors.push(`JS: ${e.message.slice(0, 160)}`));
page.on('console', (m) => { if (m.type() === 'error' && !/Failed to load resource|net::|404|204|mapbox|WebGL|favicon|Download the React DevTools/i.test(m.text())) errors.push(`console: ${m.text().slice(0, 160)}`); });

async function open(route, reset) {
  if (reset) {
    await page.goto(`${base}/+not-found`);
    await page.evaluate((st) => { localStorage.clear(); localStorage.setItem('ryadom-session', JSON.stringify({ state: st, version: 0 })); }, session);
  }
  await page.goto(`${base}${route}`, { waitUntil: 'load' });
  await page.waitForTimeout(900);
}
const SEL = '[role="button"],[role="link"],[role="tab"],[role="switch"],[role="checkbox"],[role="radio"],a[href]';
const report = [];
let total = 0, bad = 0, small = 0;
for (const route of ROUTES) {
  errors = [];
  await open(route, true);
  const loadErrors = [...errors];
  const broken = BROKEN.test(await page.locator('body').innerText().catch(() => ''));
  const count = Math.min(MAX, await page.locator(SEL).count());
  const rows = [];
  if (loadErrors.length || broken) rows.push(`- ✕ при открытии: ${broken ? 'экран ошибки' : ''} ${loadErrors.slice(0, 2).join(' | ')}`);
  for (let i = 0; i < count; i++) {
    const el = page.locator(SEL).nth(i);
    if (!(await el.isVisible().catch(() => false))) continue;
    const label = ((await el.getAttribute('aria-label').catch(() => null)) || (await el.innerText().catch(() => '')) || '').replace(/\s+/g, ' ').trim().slice(0, 50) || `кнопка ${i + 1}`;
    if (SKIP.test(label)) continue;
    const box = await el.boundingBox().catch(() => null);
    if (box && (box.width < 32 || box.height < 32)) small++;
    errors = [];
    total++;
    await el.click({ timeout: 1500 }).catch(() => undefined);
    await page.waitForTimeout(450);
    const text = await page.locator('body').innerText().catch(() => '');
    if (errors.length || BROKEN.test(text)) { bad++; rows.push(`- ✕ «${label}»: ${BROKEN.test(text) ? 'экран ошибки; ' : ''}${errors.slice(0, 2).join(' | ')}`); }
    await open(route, false);
  }
  const line = `${route}: нажатий ${count}, ошибок ${rows.length}`;
  console.log(line);
  rows.forEach((r) => console.log(`  ${r}`));
  report.push(`### ${route}\n${line}\n${rows.join('\n')}`);
}
const summary = `Проверено нажатий: ${total}, с ошибками: ${bad}. Кнопок меньше 32 pt (без учёта невидимой зоны нажатия): ${small}.`;
console.log(summary);
await mkdir(join(root, 'docs/progress/click-test'), { recursive: true });
await writeFile(join(root, 'docs/progress/click-test/report.md'), `# Проверка нажатий\n\n${summary}\n\n${report.join('\n\n')}\n`);
await browser.close();
server.close();
