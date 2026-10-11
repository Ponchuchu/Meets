// Иконки Meets: человечек держится за две палочки (node scripts/icons.mjs → assets/icon/*.png и favicon).
import { chromium } from 'playwright';

const INK = '#17161A', CREAM = '#FBFAF6', ORANGE = '#F0521F';
/** Человечек: голова, тело, руки на палочках. k — масштаб человечка (палочки всегда во всю высоту). */
const person = ({ body, face, k = 1 }) => `<g transform="translate(50 54) scale(${k}) translate(-50 -54)">
  <path d="M38 67Q26 65 24.5 51" stroke="${body}" stroke-width="7" stroke-linecap="round" fill="none"/>
  <path d="M62 67Q74 65 75.5 51" stroke="${body}" stroke-width="7" stroke-linecap="round" fill="none"/>
  <circle cx="24.5" cy="49" r="6" fill="${body}"/><circle cx="75.5" cy="49" r="6" fill="${body}"/>
  <path d="M35 66q0-10 15-10t15 10v19q0 6-6 6H41q-6 0-6-6z" fill="${body}"/>
  <path d="M42 90v6M58 90v6" stroke="${body}" stroke-width="7" stroke-linecap="round"/>
  <circle cx="50" cy="38" r="14" fill="${body}"/>
  <circle cx="45" cy="36.5" r="2.3" fill="${face}"/><circle cx="55" cy="36.5" r="2.3" fill="${face}"/>
  <path d="M44.5 43q5.5 4.5 11 0" stroke="${face}" stroke-width="2.4" stroke-linecap="round" fill="none"/>
</g>`;
const poles = (c) => `<rect x="20.5" y="-10" width="8" height="120" fill="${c}"/><rect x="71.5" y="-10" width="8" height="120" fill="${c}"/>`;
const svg = (body, bg, size = 1024) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" width="${size}" height="${size}">${bg ? `<rect width="100" height="100" fill="${bg}"/>` : ''}${body}</svg>`;
const mono = `<defs><mask id="m" maskUnits="userSpaceOnUse" x="0" y="0" width="100" height="100"><rect width="100" height="100" fill="#fff"/><circle cx="45" cy="36.5" r="2.6" fill="#000"/><circle cx="55" cy="36.5" r="2.6" fill="#000"/></mask></defs><g mask="url(#m)">${poles('#fff')}${person({ body: '#fff', face: '#000', k: 0.74 })}</g>`;
const out = {
  'icon.png': svg(poles(CREAM) + person({ body: INK, face: CREAM, k: 0.92 }), ORANGE),
  'icon-dark.png': svg(poles('#3A3940') + person({ body: ORANGE, face: '#1C1B20', k: 0.92 }), '#1C1B20'),
  'icon-tinted.png': svg(poles('#FFFFFF') + person({ body: '#9A9A9A', face: '#000', k: 0.92 }), '#000000'),
  'adaptive-foreground.png': svg(poles(CREAM) + person({ body: INK, face: CREAM, k: 0.74 })),
  'adaptive-monochrome.png': svg(mono),
};
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
const p = await b.newPage({ viewport: { width: 1024, height: 1024 } });
for (const [f, s] of Object.entries(out)) {
  await p.setContent(`<html><body style="margin:0;background:transparent">${s}</body></html>`);
  await p.locator('svg').screenshot({ path: `assets/icon/${f}`, omitBackground: true });
  console.log(f);
}
// Пустая картинка для системной заставки: настоящую анимацию рисует приложение (Splash.tsx), чтобы не было скачка.
await p.setContent('<html><body style="margin:0;background:transparent"><div style="width:200px;height:200px"></div></body></html>');
await p.setViewportSize({ width: 200, height: 200 });
await p.locator('div').screenshot({ path: 'assets/icon/splash-blank.png', omitBackground: true });
await p.setViewportSize({ width: 48, height: 48 });
await p.setContent(`<html><body style="margin:0">${svg(poles(CREAM) + person({ body: INK, face: CREAM, k: 0.92 }), ORANGE, 48)}</body></html>`);
await p.locator('svg').screenshot({ path: 'assets/images/favicon.png' });
await b.close();
