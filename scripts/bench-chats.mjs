// Synthetic long-list benchmark. Demo only; blocks remote requests and never writes to production.
import { chromium } from 'playwright';
import { createServer } from 'node:http';
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { resolve, extname } from 'node:path';
import assert from 'node:assert/strict';
const dist = resolve('dist');
const out = resolve(process.env.PERF_OUT || 'docs/progress/optimization/chats');
const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.jpg': 'image/jpeg', '.ttf': 'font/ttf' };
const server = createServer(async (req, res) => {
  const clean = decodeURIComponent((req.url || '/').split('?')[0]);
  for (const suffix of ['', '.html', '/index.html']) {
    const file = resolve(dist, `.${clean}${suffix}`);
    if (!file.startsWith(`${dist}/`)) continue;
    try { const body = await readFile(file); res.setHeader('Content-Type', types[extname(file)] || 'application/octet-stream'); res.end(body); return; } catch { /* next candidate */ }
  }
  res.setHeader('Content-Type', 'text/html'); res.end(await readFile(`${dist}/index.html`));
}).listen(0);
const browser = await chromium.launch({ executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH || '/usr/bin/chromium', args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
try {
  await mkdir(out, { recursive: true });
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  await page.route(/^https:\/\//, route => route.abort());
  await page.addInitScript(() => {
    window.__long = [];
    new PerformanceObserver(list => list.getEntries().forEach(e => window.__long.push(e.duration))).observe({ type: 'longtask', buffered: true });
    localStorage.setItem('ryadom-session', JSON.stringify({ state: { signedIn: true, onboarded: true, locationAsked: true, tutorialDone: true, draft: { name: 'QA', interests: [], times: [], withWho: 'friends', budget: 'mid' } }, version: 0 }));
    const groups = Array.from({ length: 500 }, (_, i) => ({ id: `load-${i}`, kind: 'group', title: `Нагрузочный чат ${String(i).padStart(4, '0')}`, members: 3, lastText: 'Сообщение', lastTime: '18:10', unread: 0 }));
    const sent = Array.from({ length: 10000 }, (_, i) => ({ id: `sent-${i}`, chatId: `load-${i % 500}`, kind: 'text', authorId: 'me', text: 'Тестовое сообщение', time: '18:11', delivery: 'sending' }));
    localStorage.setItem('ryadom-chat', JSON.stringify({ state: { groups, sent }, version: 0 }));
  });
  const cdp = await page.context().newCDPSession(page);
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: Number(process.env.CPU_RATE || 1) });
  const started = Date.now();
  await page.goto(`http://localhost:${server.address().port}/chats`, { waitUntil: 'domcontentloaded' });
  await page.getByText('Нагрузочный чат 0000', { exact: true }).waitFor({ timeout: 90000 });
  const contentMs = Date.now() - started;
  await page.getByRole('button', { name: 'Пропустить заставку' }).click({ timeout: 1000 }).catch(() => {});
  await page.waitForTimeout(1000);
  const mountedRows = await page.getByText(/^Нагрузочный чат \d+$/).count();
  const long = await page.evaluate(() => window.__long);
  assert.deepEqual(errors, []);
  const result = { fixture: { chats: 500, sentMessages: 10000 }, environment: 'demo Chromium, remote network blocked, not Android FPS', cpuSlowdown: Number(process.env.CPU_RATE || 1), contentMs, mountedRows, domNodes: await page.locator('*').count(), longTasks: long.length, longTaskMs: Math.round(long.reduce((a,b) => a+b,0)), pageErrors: errors };
  await page.screenshot({ path: `${out}/chats.png` });
  await writeFile(`${out}/chats.json`, JSON.stringify(result, null, 2));
  console.log(result);
  if (process.env.VERIFY_LIST === '1') {
    await page.mouse.move(200, 400);
    // Variable-height lists discover unmeasured rows while scrolling; advance until the tail is mounted.
    for (let i = 0; i < 120 && !(await page.getByText('Нагрузочный чат 0499', { exact: true }).count()); i++) {
      await page.evaluate(() => {
        const scroll = [...document.querySelectorAll('div')].find(el => el.scrollHeight > el.clientHeight + 200 && ['auto', 'scroll'].includes(getComputedStyle(el).overflowY));
        if (!scroll) throw new Error('List has no scroll container');
        scroll.scrollTop = scroll.scrollHeight - scroll.clientHeight;
      });
      await page.waitForTimeout(100);
    }
    assert.equal(await page.getByText('Нагрузочный чат 0499', { exact: true }).count(), 1);
    await page.evaluate(() => {
      for (const el of document.querySelectorAll('div')) if (el.scrollTop > 0) el.scrollTop = 0;
    });
    await page.getByRole('button', { name: 'Поиск по чатам', exact: true }).click();
    await page.getByRole('textbox', { name: 'Поиск по чатам', exact: true }).fill('Нагрузочный чат 0499');
    await page.getByText('Нагрузочный чат 0499', { exact: true }).waitFor();
    assert.equal(await page.getByText(/^Нагрузочный чат \d+$/).count(), 1);
    assert.deepEqual(errors, []);
    await writeFile(`${out}/list-checks.json`, JSON.stringify({ reachesLastOf500: true, searchFindsLastChat: true, filteredRows: 1, pageErrors: errors }, null, 2));
    console.log('Passed: scroll reaches chat 500; search returns the last chat.');
  }
} finally { await browser.close(); server.close(); }
