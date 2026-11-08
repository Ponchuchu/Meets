// Actual app, public event snapshots, demo identity. All non-GET remote requests are blocked.
import { chromium } from 'playwright';
import { createServer } from 'node:http';
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { resolve, extname } from 'node:path';
import assert from 'node:assert/strict';
const dist = resolve('dist');
const out = resolve('docs/progress/discovery-20261109');
const fixtures = JSON.parse(await readFile(`${out}/fixtures.json`, 'utf8'));
const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.jpg': 'image/jpeg', '.ttf': 'font/ttf', '.mp4': 'video/mp4' };
const server = createServer(async (req, res) => {
  const clean = decodeURIComponent((req.url || '/').split('?')[0]);
  for (const suffix of ['', '.html', '/index.html']) {
    const file = resolve(dist, `.${clean}${suffix}`);
    if (!file.startsWith(`${dist}/`)) continue;
    try { const body = await readFile(file); res.setHeader('Content-Type', types[extname(file)] || 'application/octet-stream'); res.end(body); return; } catch { /* next */ }
  }
  res.setHeader('Content-Type', 'text/html'); res.end(await readFile(`${dist}/index.html`));
}).listen(0);
const browser = await chromium.launch({ executablePath: '/usr/bin/chromium', args: ['--autoplay-policy=no-user-gesture-required'] });
const failures = [], errors = [], checks = [];
async function context(events, size = { width: 390, height: 844 }, video = false) {
  const ctx = await browser.newContext({ viewport: size, isMobile: true, hasTouch: true, deviceScaleFactor: 2, locale: 'ru-RU', timezoneId: 'Asia/Almaty', ...(video ? { recordVideo: { dir: '/tmp/reco-recording', size: { width: 390, height: 844 } } } : {}) });
  await ctx.route(/^https:\/\//, async route => {
    const r = route.request();
    if (!['GET', 'HEAD'].includes(r.method())) { await route.abort(); return; }
    if (!['image', 'media'].includes(r.resourceType())) { await route.abort(); return; }
    try {
      const response = await fetch(r.url(), { headers: r.headers(), signal: AbortSignal.timeout(25000) });
      const headers = Object.fromEntries(response.headers);
      delete headers['content-encoding']; delete headers['content-length'];
      if (!response.ok) failures.push({ resource: r.resourceType(), status: response.status });
      await route.fulfill({ status: response.status, headers, body: Buffer.from(await response.arrayBuffer()) });
    } catch { failures.push({ resource: r.resourceType(), status: 'network' }); await route.abort(); }
  });
  await ctx.addInitScript(events => {
    const now = Date.now();
    const session = { signedIn: true, onboarded: true, locationAsked: true, tutorialDone: true, draft: { name: 'Демо', photo: null, interests: ['music', 'art', 'food'], times: ['weekday', 'weekend'], withWho: 'friends', budget: 'any' } };
    localStorage.setItem('ryadom-session', JSON.stringify({ state: session, version: 0 }));
    localStorage.setItem('ryadom-feed', JSON.stringify({ state: { hintShown: [now, now, now] }, version: 0 }));
    const query = (key, data) => ({ queryKey: key, queryHash: JSON.stringify(key), state: { data, dataUpdateCount: 1, dataUpdatedAt: now + 300000, error: null, errorUpdateCount: 0, errorUpdatedAt: 0, fetchFailureCount: 0, fetchFailureReason: null, fetchMeta: null, isInvalidated: false, status: 'success', fetchStatus: 'idle' } });
    localStorage.setItem('ryadom-cache-v6', JSON.stringify({ timestamp: now, buster: 'v6', clientState: { mutations: [], queries: [query(['events'], events), query(['people'], []), query(['spots'], [])] } }));
  }, events);
  const page = await ctx.newPage(); page.on('pageerror', e => errors.push(e.message));
  await page.goto(`http://localhost:${server.address().port}/foryou`, { waitUntil: 'domcontentloaded' });
  await page.getByRole('heading', { name: 'Куда пойдём?', exact: true }).waitFor().catch(async error => { console.log(JSON.stringify({ errors, crashes: await page.evaluate(() => localStorage.getItem('meets:crashes')), body: await page.locator('body').innerText() })); await page.screenshot({ path: '/tmp/reco-debug.png' }); throw error; });
  const splash = page.getByRole('button', { name: 'Пропустить заставку' });
  if (await splash.count()) await splash.waitFor({ state: 'hidden', timeout: 12000 });
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(1600);
  return { ctx, page };
}
try {
  await mkdir(out, { recursive: true });
  for (const [index, name, size] of (process.env.RECORD_ONLY === '1' ? [] : [[0, 'portrait', { width: 390, height: 844 }], [1, 'landscape', { width: 390, height: 844 }], [0, 'small', { width: 320, height: 568 }]])) {
    const { ctx, page } = await context([fixtures[index]], size);
    await page.getByText(fixtures[index].title, { exact: true }).first().waitFor();
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
    const geometry = await page.evaluate(() => [...document.images].filter(image => image.naturalWidth > 0).map(image => {
      const rect = image.getBoundingClientRect();
      return { sourceWidth: image.naturalWidth, sourceHeight: image.naturalHeight, renderedWidth: rect.width, renderedHeight: rect.height, blurred: getComputedStyle(image).filter.includes('blur') };
    }));
    assert(geometry.some(image => Math.abs(image.renderedWidth / image.renderedHeight - image.sourceWidth / image.sourceHeight) < 0.02));
    assert(geometry.every(image => !image.blurred));
    await page.screenshot({ path: `${out}/${name}.png` });
    await page.getByRole('button', { name: /^Пойду:/ }).first().scrollIntoViewIfNeeded();
    await page.screenshot({ path: `${out}/${name}-actions.png` });
    checks.push({ name, size, publicEventId: fixtures[index].id, naturalAspectRatio: true, noBlur: true, geometry });
    await ctx.close();
  }
  if (process.env.RECORD_RECO === '1') {
    const { ctx, page } = await context(fixtures.slice(0, 3), undefined, true);
    await page.waitForTimeout(1000);
    await page.getByRole('button', { name: 'Подробнее', exact: true }).first().click();
    await page.getByRole('button', { name: 'Вернуться в рекомендации', exact: true }).waitFor();
    await page.waitForTimeout(1000);
    await page.screenshot({ path: `${out}/detail.png` });
    await page.getByRole('button', { name: 'Вернуться в рекомендации', exact: true }).click();
    await page.waitForTimeout(500);
    await page.getByRole('button', { name: /^Пойду:/ }).first().click();
    await page.getByRole('button', { name: /^В планах:/ }).first().waitFor();
    await page.waitForTimeout(800);
    await page.screenshot({ path: `${out}/planned-inline.png` });
    await page.getByRole('button', { name: /^Не интересно:/ }).nth(1).click();
    await page.waitForTimeout(400);
    await page.getByRole('button', { name: 'Вернуть', exact: true }).click();
    await page.waitForTimeout(700);
    await page.getByRole('button', { name: /^Планы/ }).click();
    await page.waitForTimeout(900);
    await page.screenshot({ path: `${out}/planned.png` });
    await page.getByRole('tab', { name: 'Рекомендации', exact: true }).click();
    await page.waitForTimeout(700);
    assert.deepEqual(await page.evaluate(() => JSON.parse(localStorage.getItem('meets:crashes') || '[]')), []);
    const video = page.video(); await ctx.close();
    await video.saveAs(`${out}/walkthrough.webm`);
  }
  assert.deepEqual(errors, []);
  await writeFile(`${out}/checks.json`, JSON.stringify({ identity: 'demo; public events snapshot only', productionWrites: 0, checks, mediaFailures: failures, pageErrors: errors }, null, 2));
  console.log(JSON.stringify({ checks: checks.length, mediaFailures: failures, pageErrors: errors }));
} finally { await browser.close(); server.close(); }
