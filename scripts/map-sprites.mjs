// Объёмные «игровые» значки карты (FIX5): у каждого вида события, места и у каждого ТРЦ — свой предмет,
// который парит над точкой с мягкой тенью на земле. Рисуется векторно (градиенты, блики, тёмный контур, как в мобильных играх)
// и переводится в PNG ×3 через Chromium. Картинки кладутся в assets/map/sprites/, список — в src/map/sprites.ts.
// Запуск: node scripts/map-sprites.mjs
import { mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { chromium } from 'playwright';

import { H, O, W, lg, rg, shine, sprite, stroke } from './map-sprites-kit.mjs';

// ——— События ———
const EVENTS = {
  // Стендап — ретро-микрофон на стойке.
  standup: sprite(`
    <path d="M60 78v30M44 112h32" ${stroke} stroke-width="5" fill="none"/>
    <path d="M60 78v30" stroke="#9AA3AE" stroke-width="3"/>
    <rect x="38" y="16" width="44" height="62" rx="22" fill="url(#mic)" ${stroke}/>
    <path d="M40 46h40M40 56h40M40 36h40" stroke="#5B5560" stroke-width="2.5" opacity="0.6"/>
    <rect x="35" y="56" width="50" height="12" rx="6" fill="url(#ring)" ${stroke}/>
    ${shine('M48 22c-4 6-5 14-4 22 3-8 6-15 10-20z', 0.75)}`,
    lg('mic', '#E8E4EC', '#8E8895') + lg('ring', '#FFD45C', '#E09A12')),
  // Концерт — электрогитара.
  concert: sprite(`
    <path d="M78 14l10 -6 6 8-8 6z" fill="#3A3046" ${stroke}/>
    <rect x="60" y="18" width="10" height="56" rx="3" transform="rotate(28 65 46)" fill="url(#neck)" ${stroke}/>
    <path d="M30 70c-12-4-16 14-6 22 6 6 18 8 26 2 8-6 18-4 22-12 6-12-6-22-16-18-6 2-8-6-14-4-6 2-4 12-12 10z" fill="url(#body)" ${stroke}/>
    <circle cx="44" cy="84" r="5" fill="#2A2230"/>
    <path d="M38 76l22-10" stroke="#FFFFFF" stroke-width="2" opacity="0.7"/>
    ${shine('M30 74c-4 2-6 8-2 12 1-6 3-9 6-11z', 0.7)}`,
    lg('neck', '#C9894E', '#7A4A22') + lg('body', '#FF5A4E', '#B5221B')),
  // Музыка — пластинка с нотой.
  music: sprite(`
    <circle cx="60" cy="62" r="40" fill="url(#vinyl)" ${stroke}/>
    <circle cx="60" cy="62" r="30" fill="none" stroke="#4B4452" stroke-width="2"/><circle cx="60" cy="62" r="22" fill="none" stroke="#4B4452" stroke-width="2"/>
    <circle cx="60" cy="62" r="13" fill="url(#label)" ${stroke} stroke-width="3"/><circle cx="60" cy="62" r="3" fill="${O}"/>
    ${shine('M30 44c6-10 16-16 26-17-10 6-18 12-22 22z', 0.45)}
    <path d="M86 16v26" ${stroke} fill="none"/><ellipse cx="81" cy="43" rx="7" ry="5.5" fill="#FFD45C" ${stroke} stroke-width="3"/><path d="M86 16l12 4v8l-12-4z" fill="#FFD45C" ${stroke} stroke-width="3"/>`,
    rg('vinyl', '#5A5262', '#17131C') + lg('label', '#FF7A3D', '#E04A12')),
  // Вечеринка — диско-шар.
  party: sprite(`
    <path d="M60 4v14" stroke="#9AA3AE" stroke-width="3"/>
    <circle cx="60" cy="60" r="40" fill="url(#disco)" ${stroke}/>
    <path d="M22 60h76M60 20v80M28 40h64M28 80h64M44 22q-12 38 0 76M76 22q12 38 0 76" stroke="#6E6880" stroke-width="2" opacity="0.6" fill="none"/>
    <path d="M38 34l10 3-3 9-9-3zM66 64l10 3-3 9-9-3z" fill="#FFFFFF" opacity="0.9"/>
    <path d="M70 30l8 2-2 7-7-2z" fill="#F7A6FF"/><path d="M42 70l8 2-2 7-7-2z" fill="#9EE8FF"/>
    <path d="M98 22l3 8 8 3-8 3-3 8-3-8-8-3 8-3z" fill="#FFD45C" ${stroke} stroke-width="2"/>`,
    rg('disco', '#F1EEF7', '#8A82A0')),
  // Театр — маски комедии и трагедии.
  theatre: sprite(`
    <path d="M18 26c14-6 30-6 44 0v26c0 18-10 30-22 30S18 70 18 52z" fill="url(#mask1)" ${stroke}/>
    <path d="M27 42q5-5 10 0M45 42q5-5 10 0" ${stroke} fill="none" stroke-width="3.5"/><path d="M28 58q12 12 24 0z" fill="${O}"/>
    <path d="M58 40c14-6 30-6 44 0v26c0 18-10 30-22 30S58 84 58 66z" fill="url(#mask2)" ${stroke}/>
    <path d="M67 58q5 5 10 0M85 58q5 5 10 0" ${stroke} fill="none" stroke-width="3.5"/><path d="M68 84q12-12 24 0z" fill="${O}"/>
    ${shine('M24 30c6-2 12-3 18-2-6 3-12 6-16 10z', 0.7)}`,
    lg('mask1', '#FFD45C', '#E09A12') + lg('mask2', '#E74C8B', '#A11F57')),
  // Кино — ведро попкорна.
  movie: sprite(`
    <circle cx="40" cy="30" r="13" fill="#FFF6DD" ${stroke} stroke-width="3"/><circle cx="60" cy="24" r="14" fill="#FFF6DD" ${stroke} stroke-width="3"/><circle cx="80" cy="30" r="13" fill="#FFF6DD" ${stroke} stroke-width="3"/>
    <circle cx="50" cy="38" r="11" fill="#FFF0C4" ${stroke} stroke-width="3"/><circle cx="70" cy="38" r="11" fill="#FFF0C4" ${stroke} stroke-width="3"/>
    <path d="M28 42h64l-9 62H37z" fill="#FFFFFF" ${stroke}/>
    <path d="M42 42l5 62M60 42v62M78 42l-5 62" stroke="#E5383B" stroke-width="9"/>
    <path d="M28 42h64l-9 62H37z" fill="none" ${stroke}/>
    ${shine('M34 48l4 30 3-30z', 0.6)}`),
  // Поход — гора с флажком.
  hike: sprite(`
    <path d="M8 104L44 34l16 24 14-20 38 66z" fill="url(#mount)" ${stroke}/>
    <path d="M44 34l-10 20 6-2 6 6 6-6zM74 38l-8 12 5-1 4 4 5-4z" fill="#FFFFFF"/>
    <path d="M74 38V12" ${stroke} fill="none"/><path d="M74 12l18 6-18 7z" fill="#F0521F" ${stroke} stroke-width="3"/>
    <path d="M44 34l-6 70" stroke="#2E6B3A" stroke-width="2" opacity="0.4"/>`,
    lg('mount', '#7FC27A', '#3E7E4E')),
  // Настолки и игры — два кубика.
  games: sprite(`
    <g transform="rotate(-12 44 68)"><rect x="18" y="42" width="48" height="48" rx="10" fill="url(#dice1)" ${stroke}/>
    <circle cx="31" cy="55" r="5" fill="${O}"/><circle cx="53" cy="77" r="5" fill="${O}"/><circle cx="42" cy="66" r="5" fill="${O}"/></g>
    <g transform="rotate(14 82 50)"><rect x="60" y="24" width="44" height="44" rx="9" fill="url(#dice2)" ${stroke}/>
    <circle cx="72" cy="36" r="4.5" fill="#FFFFFF"/><circle cx="92" cy="56" r="4.5" fill="#FFFFFF"/><circle cx="92" cy="36" r="4.5" fill="#FFFFFF"/><circle cx="72" cy="56" r="4.5" fill="#FFFFFF"/></g>
    ${shine('M24 50c4-4 10-6 16-6-6 3-10 6-12 10z', 0.8)}`,
    lg('dice1', '#FFFFFF', '#D9D3C6') + lg('dice2', '#7B8BFF', '#3A49C9')),
  // Еда и маркеты — бургер.
  food: sprite(`
    <path d="M22 56c0-22 18-34 38-34s38 12 38 34z" fill="url(#bun)" ${stroke}/>
    <path d="M40 34l3 3M58 30l2 4M74 36l3 2M50 44l3 2M66 44l3 2" stroke="#FFF2D2" stroke-width="3" stroke-linecap="round"/>
    <path d="M18 60q10 8 20 0t20 0 22 0 22 0" fill="none" stroke="#5DB04A" stroke-width="8" stroke-linecap="round"/>
    <rect x="20" y="64" width="80" height="13" rx="6" fill="#7A3E1E" ${stroke}/>
    <path d="M24 64l8 9 8-9 8 9 8-9 8 9 8-9 8 9 8-9" fill="#FFD23F" ${stroke} stroke-width="2.5"/>
    <path d="M22 82h76c0 10-8 16-18 16H40c-10 0-18-6-18-16z" fill="url(#bun)" ${stroke}/>
    ${shine('M34 40c4-8 12-12 20-13-6 4-12 8-15 14z', 0.6)}`,
    lg('bun', '#F7B65A', '#C8781E')),
  // Спорт — мяч.
  sport: sprite(`
    <circle cx="60" cy="60" r="40" fill="url(#ball)" ${stroke}/>
    <path d="M60 44l14 10-5 16H51l-5-16z" fill="${O}"/>
    <path d="M60 44V22M74 54l20-8M69 70l12 18M51 70L39 88M46 54l-20-8" stroke="${O}" stroke-width="3"/>
    <path d="M52 22l8-4 8 4M92 40l4 10-4 6M84 92l-8 6-8-2M36 92l-8-4-2-8M24 52l0-10 6-6" stroke="${O}" stroke-width="3" fill="none"/>
    ${shine('M34 38c6-10 16-16 26-17-10 6-18 12-21 22z', 0.7)}`,
    rg('ball', '#FFFFFF', '#C9C4BA')),
  // Вело — велосипед.
  bike: sprite(`
    <circle cx="32" cy="78" r="20" fill="#F3EFE6" ${stroke}/><circle cx="32" cy="78" r="12" fill="none" stroke="#9AA3AE" stroke-width="2"/>
    <circle cx="88" cy="78" r="20" fill="#F3EFE6" ${stroke}/><circle cx="88" cy="78" r="12" fill="none" stroke="#9AA3AE" stroke-width="2"/>
    <path d="M32 78l18-32h30l8 32M50 46l12 32 18-32M44 38h16M78 46l-4-12h10" stroke="#1F9AA8" stroke-width="7" fill="none" stroke-linecap="round" stroke-linejoin="round"/>
    <path d="M32 78l18-32h30l8 32M50 46l12 32 18-32" ${stroke} fill="none" stroke-width="2" opacity="0.5"/>`),
  // Разговоры — два облачка.
  talks: sprite(`
    <path d="M14 26h60a10 10 0 0 1 10 10v28a10 10 0 0 1-10 10H40l-14 12v-12h-12A10 10 0 0 1 4 64V36a10 10 0 0 1 10-10z" fill="url(#b1)" ${stroke}/>
    <circle cx="28" cy="50" r="4" fill="#FFFFFF"/><circle cx="44" cy="50" r="4" fill="#FFFFFF"/><circle cx="60" cy="50" r="4" fill="#FFFFFF"/>
    <path d="M66 56h40a10 10 0 0 1 10 10v20a10 10 0 0 1-10 10h-4v10l-12-10H66a10 10 0 0 1-10-10V66a10 10 0 0 1 10-10z" fill="url(#b2)" ${stroke}/>`,
    lg('b1', '#8E9BFF', '#4A57D6') + lg('b2', '#FFD45C', '#E09A12')),
  // Лекция — книга и очки.
  lecture: sprite(`
    <path d="M10 40c18-8 34-8 50 2 16-10 32-10 50-2v56c-18-8-34-8-50 2-16-10-32-10-50-2z" fill="url(#book)" ${stroke}/>
    <path d="M60 42v56" ${stroke}/>
    <path d="M20 52c10-4 22-4 32 0M20 62c10-4 22-4 32 0M68 52c10-4 22-4 32 0M68 62c10-4 22-4 32 0" stroke="#B9B3A6" stroke-width="3" fill="none"/>
    <circle cx="44" cy="24" r="11" fill="#BFE4FF" ${stroke} stroke-width="3"/><circle cx="76" cy="24" r="11" fill="#BFE4FF" ${stroke} stroke-width="3"/><path d="M55 24h10" ${stroke} stroke-width="3"/>`,
    lg('book', '#FFFFFF', '#E3DCCB')),
  // Встреча — две чашки «за встречу».
  meetup: sprite(`
    <g transform="rotate(-10 40 66)"><path d="M18 44h40l-5 46H23z" fill="url(#cup1)" ${stroke}/><path d="M56 54h6c8 0 8 16 0 16h-6" fill="none" ${stroke}/></g>
    <g transform="rotate(10 80 66)"><path d="M62 44h40l-5 46H67z" fill="url(#cup2)" ${stroke}/><path d="M64 54h-6c-8 0-8 16 0 16h6" fill="none" ${stroke}/></g>
    <path d="M44 34q-4-8 2-14M76 34q-4-8 2-14" stroke="#B9B3A6" stroke-width="4" fill="none" stroke-linecap="round"/>
    <path d="M60 16l3 6 6 1-5 4 1 6-5-3-5 3 1-6-5-4 6-1z" fill="#FFD45C" ${stroke} stroke-width="2"/>`,
    lg('cup1', '#FF8A5C', '#E0521F') + lg('cup2', '#7FC27A', '#3E7E4E')),
  // Искусство — палитра с кистью.
  art: sprite(`
    <path d="M60 18c-28 0-48 18-48 40s18 36 38 36c8 0 10-6 6-12-4-6 0-12 8-12h14c16 0 30-8 30-22 0-18-20-30-48-30z" fill="url(#pal)" ${stroke}/>
    <circle cx="36" cy="46" r="7" fill="#E5383B" ${stroke} stroke-width="2.5"/><circle cx="56" cy="34" r="7" fill="#FFD23F" ${stroke} stroke-width="2.5"/>
    <circle cx="78" cy="38" r="7" fill="#3BA3E5" ${stroke} stroke-width="2.5"/><circle cx="34" cy="68" r="7" fill="#2FA35A" ${stroke} stroke-width="2.5"/>
    <path d="M70 92l28-40" stroke="#8A5A3C" stroke-width="8" stroke-linecap="round"/><path d="M96 54l8-12-4-3-8 12z" fill="#2A2230"/>`,
    lg('pal', '#F7E2B8', '#D9A860')),
};

// Вторая часть (места и ТРЦ) — в map-sprites-places.mjs, запуск рендера — в конце этого файла.
const { PLACES, MALLS } = await import('./map-sprites-places.mjs');

const all = {
  ...Object.fromEntries(Object.entries(EVENTS).map(([k, v]) => [`ev-${k}`, v])),
  ...Object.fromEntries(Object.entries(PLACES).map(([k, v]) => [`pl-${k}`, v])),
  ...Object.fromEntries(Object.entries(MALLS).map(([k, v]) => [`mall-${k}`, v])),
};
if (process.argv.includes('--html')) {
  writeFileSync(process.argv[process.argv.indexOf('--html') + 1], `<html><body style="background:#E6E1D3;display:flex;flex-wrap:wrap;gap:8px">${Object.entries(all).map(([k, v]) => `<div style="text-align:center;font:11px sans-serif">${v}<br>${k}</div>`).join('')}</body></html>`);
} else {
  mkdirSync('assets/map/sprites', { recursive: true });
  const browser = await chromium.launch();
  const page = await browser.newPage({ deviceScaleFactor: 1.5, viewport: { width: W, height: H } });
  for (const [name, svg] of Object.entries(all)) {
    await page.setContent(`<html><body style="margin:0;background:transparent">${svg}</body></html>`);
    await page.locator('svg').screenshot({ path: `assets/map/sprites/${name}.png`, omitBackground: true });
  }
  // Значки владельца (assets/map/icons-v2, 64×70 pt в @3x, 26 октября) важнее нарисованных здесь: тем же холстом 120×140,
  // тень — на месте нашей (якорь «низ» + сдвиг 15 px в MapCanvas), поэтому точка на карте — центр тени.
  const RENAME = { 'ev-burger': 'ev-food', 'ev-club': 'ev-party', 'pl-shymbulak': 'pl-ski', 'mall-columns': 'mall-forum', 'pl-shopping': 'mall-mall' };
  for (const file of readdirSync('assets/map/icons-v2').filter((f) => f.endsWith('.png')).sort()) {
    const src = file.replace(/\.png$/, '');
    const name = RENAME[src] ?? src;
    const data = readFileSync(`assets/map/icons-v2/${file}`).toString('base64');
    await page.setContent(`<html><body style="margin:0;background:transparent"><div id="c" style="width:${W}px;height:${H}px;position:relative"><img src="data:image/png;base64,${data}" style="position:absolute;left:0;top:${H - 131}px;width:${W}px;height:131px"></div></body></html>`);
    await page.locator('#c').screenshot({ path: `assets/map/sprites/${name}.png`, omitBackground: true });
    all[name] = 'v2';
  }
  await browser.close();
  const lines = Object.keys(all).map((k) => `  '${k}': require('../../assets/map/sprites/${k}.png'),`);
  writeFileSync('src/map/sprites.ts', `// Создано scripts/map-sprites.mjs — не править руками. Объёмные значки карты (FIX5).\n/* eslint-disable @typescript-eslint/no-require-imports */\nexport const SPRITES = {\n${lines.join('\n')}\n} as const;\nexport type SpriteName = keyof typeof SPRITES;\n`);
  console.log(Object.keys(all).length, 'sprites');
}
