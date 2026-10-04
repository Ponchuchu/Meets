// npm run icons — иконка «Двое» (V6.md §11, вариант 5) в assets/icon/ через Playwright.
// Большой оранжевый круг — ты, маленький белый — друг; щель между ними цвета фона.
import { chromium } from 'playwright';
import { existsSync } from 'node:fs';
import { mkdir, readFile } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const out = join(root, 'assets/icon');
const O = '#F0521F', INK = '#17161A', CR = '#FBFAF6';
const glyph = (a, b, bg) => `<circle cx="42" cy="56" r="21" fill="${a}"/><circle cx="64" cy="38" r="13" fill="${b}" stroke="${bg}" stroke-width="4"/>`;
const svg = (body, { bg = null, scale = 1 } = {}) => `<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="1024" viewBox="0 0 100 100">
  <defs><linearGradient id="hl" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff" stop-opacity="0.10"/><stop offset="0.6" stop-color="#fff" stop-opacity="0"/></linearGradient></defs>
  ${bg ? `<rect width="100" height="100" fill="${bg}"/><rect width="100" height="100" fill="url(#hl)"/>` : ''}
  <g transform="translate(50 50) scale(${scale}) translate(-50 -50)">${body}</g></svg>`;

const files = {
  'icon.png': svg(glyph(O, CR, INK), { bg: INK }),
  'icon-dark.png': svg(glyph(O, CR, 'transparent')),
  'icon-tinted.png': svg(glyph('#fff', '#fff', 'transparent')),
  // Android: глиф в безопасной зоне 66 %, фон — цветом.
  'adaptive-foreground.png': svg(glyph(O, CR, INK), { scale: 0.66 }),
  'adaptive-monochrome.png': svg(glyph('#fff', '#fff', 'transparent'), { scale: 0.66 }),
  'splash.png': svg(glyph(O, CR, INK), { scale: 0.9 }),
};

await mkdir(out, { recursive: true });
const pre = '/opt/pw-browsers/chromium';
const browser = await chromium.launch(existsSync(pre) ? { executablePath: pre } : {});
const page = await browser.newPage({ viewport: { width: 1024, height: 1024 } });
for (const [name, s] of Object.entries(files)) {
  await page.setContent(`<html><body style="margin:0;background:transparent">${s}</body></html>`);
  await page.locator('svg').screenshot({ path: join(out, name), omitBackground: true });
  console.log('✓', name);
}
// Системная заставка: «рядом» от руки (Pacifico) белым — фон оранжевый задаёт app.json.
const font = join(root, 'node_modules/@expo-google-fonts/pacifico/400Regular/Pacifico_400Regular.ttf');
await page.setViewportSize({ width: 1024, height: 1024 });
await page.setContent(`<html><head><style>@font-face{font-family:P;src:url(data:font/ttf;base64,${(await readFile(font)).toString('base64')})}</style></head><body style="margin:0;background:transparent">
<div id="w" style="width:1024px;height:1024px;display:flex;align-items:center;justify-content:center;font-family:P;font-size:220px;color:#FBFAF6">рядом</div></body></html>`);
await page.waitForTimeout(300);
await page.locator('#w').screenshot({ path: join(out, 'splash-word.png'), omitBackground: true });
console.log('✓ splash-word.png');
await browser.close();
