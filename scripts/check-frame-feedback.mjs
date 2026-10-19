// Реальный web-интерфейс demo: выбор, сохранение, закрытые рамки и комплект одной сборки.
// Сначала EXPO_PUBLIC_DATA_MODE=demo npm run build:web -- --clear.
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { mkdir, readFile, stat, writeFile } from 'node:fs/promises';
import { dirname, extname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const out = join(root, 'docs/progress/oct20-resumed');
await mkdir(out, { recursive: true });
const mime = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.jpg': 'image/jpeg', '.ttf': 'font/ttf', '.wav': 'audio/wav' };
const server = createServer(async (req, res) => {
  const path = decodeURIComponent((req.url ?? '/').split('?')[0]);
  let file;
  for (const suffix of ['', '.html', '/index.html']) {
    const candidate = join(root, 'dist', path + suffix);
    try { if ((await stat(candidate)).isFile()) { file = candidate; break; } } catch { /* SPA fallback */ }
  }
  file ??= join(root, 'dist/index.html');
  res.setHeader('Content-Type', mime[extname(file)] ?? 'application/octet-stream');
  res.end(await readFile(file));
}).listen(0, '127.0.0.1');
await new Promise(resolve => server.on('listening', resolve));
let browser;
const errors = [];
const passed = [];
try {
  browser = await chromium.launch({ executablePath: process.env.SHOTS_CHROMIUM || '/usr/bin/chromium', args: ['--no-sandbox', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, locale: 'ru-RU', timezoneId: 'Asia/Qyzylorda' });
  await context.addInitScript(() => {
    if (!localStorage.getItem('ryadom-session')) localStorage.setItem('ryadom-session', JSON.stringify({ state: { signedIn: true, onboarded: true, locationAsked: true, tutorialDone: true, draft: { provider: 'google', name: 'Данил', photo: 'danil', interests: ['music', 'art', 'games'], times: ['weekday'], withWho: 'friends', budget: 'mid' } }, version: 0 }));
    localStorage.setItem('ryadom-clock', '18:10');
  });
  await context.route('https://**/*', route => route.abort());
  const page = await context.newPage();
  page.on('pageerror', e => errors.push(e.message));
  const go = async path => {
    await page.goto(`http://127.0.0.1:${server.address().port}${path}`, { waitUntil: 'domcontentloaded' });
    await page.evaluate(() => document.fonts.ready);
    await page.waitForTimeout(650);
    const splash = page.getByRole('button', { name: 'Пропустить заставку', exact: true });
    if (await splash.isVisible()) await splash.click();
    await splash.waitFor({ state: 'hidden' });
  };
  const shot = async name => {
    await page.waitForTimeout(400); // Завершение перехода Modal; не снимаем полупрозрачный кадр.
    await page.screenshot({ path: join(out, `${name}.png`) });
  };
  const selected = () => page.evaluate(() => JSON.parse(localStorage.getItem('ryadom-profile')).state.mapFrame);
  const close = () => page.getByRole('button', { name: 'Закрыть предпросмотр рамки', exact: true }).click();

  await go('/profile/achievements');
  await page.getByRole('button', { name: 'Посмотреть рамку «Яблоки Алматы»', exact: true }).click();
  await page.getByRole('button', { name: 'Выбрать рамку «Яблоки Алматы»', exact: true }).click();
  await page.getByRole('button', { name: 'Рамка выбрана', exact: true }).waitFor();
  assert.equal(await selected(), 'almaty-apples');
  await shot('Frame-apples'); await close();
  await go('/me');
  await page.getByRole('button', { name: 'Сменить фото. Рамка «Яблоки Алматы»', exact: true }).waitFor();
  await shot('Profile');
  await page.reload();
  await page.getByRole('button', { name: 'Сменить фото. Рамка «Яблоки Алматы»', exact: true }).waitFor();
  passed.push('Выбранная рамка сохраняется после перезагрузки и используется в профиле.');

  await go('/profile/achievements');
  await page.getByText('Твоя рамка', { exact: true }).evaluate(el => el.scrollIntoView({ block: 'start' })); await shot('Frames');
  const variants = [ ['Тюльпаны', 'tulips'], ['Заилийский Алатау', 'alatau'], ['Тёплый закат', 'dusk'], ['Звёздная ночь', 'night'], ['Золотой узор', 'ornament'] ];
  for (const [name, file] of variants) {
    await page.getByRole('button', { name: `Посмотреть рамку «${name}»`, exact: true }).click();
    if (name === 'Звёздная ночь') {
      assert.equal(await page.getByRole('button', { name: 'Рамка откроется на уровне 5', exact: true }).isDisabled(), true);
      assert.equal(await selected(), 'almaty-apples');
    }
    await shot(`Frame-${file}`); await close();
  }
  passed.push('Все шесть рисунков открываются для просмотра; закрытая рамка не меняет выбор.');
  await page.getByRole('button', { name: 'Классическая коллекция · 4 рамки', exact: true }).click();
  for (const name of ['Рядом', 'Закат', 'Лес', 'Ночь']) assert.equal(await page.getByRole('button', { name: `Посмотреть рамку «${name}»`, exact: true }).count(), 1);
  passed.push('Прежние четыре варианта доступны в классической коллекции.');
  await page.setViewportSize({ width: 320, height: 640 });
  await page.getByRole('button', { name: 'Посмотреть рамку «Тюльпаны»', exact: true }).click();
  const button = await page.getByRole('button', { name: 'Выбрать рамку «Тюльпаны»', exact: true }).boundingBox();
  assert.ok(button && button.x >= 0 && button.x + button.width <= 320 && button.height >= 44);
  assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= 320));
  await shot('Frames-narrow'); await close();
  passed.push('Предпросмотр и кнопки помещаются на 320×640.');

  await page.setViewportSize({ width: 390, height: 844 });
  for (const [path, name] of [['/', 'Map'], ['/foryou', 'Feed'], ['/chats', 'Chats'], ['/chat/dm-igor', 'Chat'], ['/plans', 'Plans']]) {
    await go(path);
    if (path === '/') {
      await page.waitForTimeout(8500); // Недоступные внешние тайлы: честное состояние fallback.
      assert.equal(await page.getByText('Показана схема · 3D недоступно · Повторить', { exact: true }).isVisible(), true);
      assert.equal(await page.getByRole('button', { name: /Переключить карту в [23]D/ }).count(), 0);
    }
    await shot(name);
  }
  assert.deepEqual(errors, []);
  passed.push('Главные экраны одной сборки сняты; ошибок JavaScript нет.');
  await writeFile(join(out, 'browser-checks.json'), JSON.stringify({ mode: 'demo', external_network: 'blocked by test', passed, page_errors: errors }, null, 2) + '\n');
  for (const item of passed) console.log(`PASS ${item}`);
} finally {
  await browser?.close();
  await new Promise(resolve => server.close(resolve));
}
