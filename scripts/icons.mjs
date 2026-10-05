// Иконки приложения (FIX1 И1, вариант 11 «Двое · финал»): node scripts/icons.mjs → assets/icon/*.png и favicon.
import { chromium } from 'playwright';
const pair = (big, small, ring, k = 1) => `<g transform="translate(50 50) scale(${k}) translate(-50 -50)"><circle cx="41" cy="55" r="25" fill="${big}"/><circle cx="66" cy="36" r="15.5" fill="${small}" stroke="${ring}" stroke-width="5"/></g>`;
const svg = (body, bg) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" width="1024" height="1024">${bg ? `<rect width="100" height="100" fill="${bg}"/>` : ''}${body}</svg>`;
const mono = `<defs><mask id="m" maskUnits="userSpaceOnUse" x="0" y="0" width="100" height="100"><rect width="100" height="100" fill="#fff"/><circle cx="66" cy="36" r="18" fill="#000"/><circle cx="66" cy="36" r="13" fill="#fff"/></mask></defs><g transform="translate(50 50) scale(0.8) translate(-50 -50)" mask="url(#m)"><circle cx="41" cy="55" r="25" fill="#fff"/><circle cx="66" cy="36" r="13" fill="#fff"/></g>`;
const out = {
  'icon.png': svg(pair('#17161A', '#FBFAF6', '#F0521F'), '#F0521F'),
  'icon-dark.png': svg(pair('#F0521F', '#FBFAF6', '#1C1B20'), '#1C1B20'),
  'icon-tinted.png': svg(pair('#9A9A9A', '#FFFFFF', '#000000'), '#000000'),
  'adaptive-foreground.png': svg(pair('#17161A', '#FBFAF6', '#F0521F', 0.8)),
  'adaptive-monochrome.png': svg(mono),
};
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
const p = await b.newPage({ viewport: { width: 1024, height: 1024 } });
for (const [f, s] of Object.entries(out)) {
  await p.setContent(`<html><body style="margin:0;background:transparent">${s}</body></html>`);
  await p.locator('svg').screenshot({ path: `assets/icon/${f}`, omitBackground: true });
  console.log(f);
}
await p.setViewportSize({ width: 48, height: 48 });
await p.setContent(`<html><body style="margin:0">${out['icon.png'].replace('width="1024" height="1024"', 'width="48" height="48"')}</body></html>`);
await p.locator('svg').screenshot({ path: 'assets/images/favicon.png' });
await b.close();
