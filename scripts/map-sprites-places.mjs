// Объёмные значки постоянных мест и ТРЦ (FIX5): часть генератора scripts/map-sprites.mjs.
import { O, lg, rg, shine, sprite, stroke } from './map-sprites-kit.mjs';

export const PLACES = {
  // Медеу, катки — конёк.
  skate: sprite(`
    <path d="M30 18h30v34c0 4 4 6 8 6h14c10 0 16 6 16 14v6H26V24c0-4 2-6 4-6z" fill="url(#boot)" ${stroke}/>
    <path d="M38 26h14M38 34h14M38 42h14" stroke="#B9B3A6" stroke-width="3"/>
    <path d="M24 92h70c6 0 10-4 10-8" fill="none" stroke="#C9D3DE" stroke-width="6" stroke-linecap="round"/>
    <path d="M24 92h70c6 0 10-4 10-8" fill="none" ${stroke} stroke-width="2"/>
    <path d="M38 78v14M76 78v14" ${stroke} stroke-width="3.5"/>
    ${shine('M34 22h8v22h-8z', 0.6)}`, lg('boot', '#FFFFFF', '#CFE4F5')),
  // Шымбулак — лыжи и вершина.
  ski: sprite(`
    <path d="M8 98l40-70 16 22 12-16 36 64z" fill="url(#snow)" ${stroke}/>
    <path d="M48 28l-10 18 6-2 4 6 6-6zM76 34l-8 12 5-1 3 4 4-4z" fill="#FFFFFF"/>
    <path d="M34 104l56-46M44 110l56-46" stroke="#E5383B" stroke-width="7" stroke-linecap="round"/>
    <path d="M34 104l56-46M44 110l56-46" ${stroke} stroke-width="2"/>`, lg('snow', '#9CC9EA', '#3E78B5')),
  // Канатка (Кок-Тобе) — кабинка.
  cable: sprite(`
    <path d="M4 18l112 22" ${stroke} fill="none"/>
    <path d="M60 28v14" ${stroke}/><circle cx="60" cy="28" r="5" fill="#9AA3AE" ${stroke} stroke-width="2.5"/>
    <rect x="30" y="42" width="60" height="56" rx="14" fill="url(#cab)" ${stroke}/>
    <rect x="38" y="52" width="20" height="18" rx="5" fill="#BFE4FF" ${stroke} stroke-width="3"/><rect x="62" y="52" width="20" height="18" rx="5" fill="#BFE4FF" ${stroke} stroke-width="3"/>
    ${shine('M36 48h18v4H36z', 0.7)}`, lg('cab', '#FF6B5A', '#C2271E')),
  // Колесо обозрения.
  wheel: sprite(`
    <circle cx="60" cy="54" r="38" fill="none" stroke="#E0457B" stroke-width="8"/><circle cx="60" cy="54" r="38" fill="none" ${stroke} stroke-width="2"/>
    <path d="M60 16v76M22 54h76M33 27l54 54M87 27L33 81" stroke="#9AA3AE" stroke-width="3"/>
    <path d="M44 106l16-52 16 52" ${stroke} fill="none" stroke-width="5"/>
    ${[0, 60, 120, 180, 240, 300].map((a) => { const r = (a * Math.PI) / 180; return `<rect x="${60 + 38 * Math.cos(r) - 7}" y="${54 + 38 * Math.sin(r) - 5}" width="14" height="12" rx="3" fill="#FFD45C" ${stroke} stroke-width="2.5"/>`; }).join('')}`),
  // Боулинг — шар и кегля.
  bowling: sprite(`
    <path d="M80 14c8 0 10 10 8 18-2 6-2 10 2 18 6 14 4 34-10 44-14-10-16-30-10-44 4-8 4-12 2-18-2-8 0-18 8-18z" fill="url(#pin)" ${stroke}/>
    <path d="M71 40h18" stroke="#E5383B" stroke-width="5"/>
    <circle cx="44" cy="74" r="30" fill="url(#bball)" ${stroke}/>
    <circle cx="38" cy="62" r="4" fill="${O}"/><circle cx="50" cy="60" r="4" fill="${O}"/><circle cx="44" cy="72" r="4.5" fill="${O}"/>
    ${shine('M24 66c2-10 8-16 16-18-6 5-10 10-12 18z', 0.5)}`, lg('pin', '#FFFFFF', '#D9D3C6') + rg('bball', '#8E7BB8', '#2A1F3A')),
  // Батуты.
  trampoline: sprite(`
    <ellipse cx="60" cy="86" rx="46" ry="14" fill="#2A2230" ${stroke}/><ellipse cx="60" cy="84" rx="40" ry="10" fill="#3BA3E5"/>
    <path d="M18 90l-6 18M102 90l6 18M60 98v12" ${stroke}/>
    <circle cx="60" cy="24" r="10" fill="#FFC93C" ${stroke} stroke-width="3"/><path d="M60 34v20M48 42l12 6 12-6M52 66l8-12 8 12" ${stroke} fill="none" stroke-width="3.5"/>`),
  // Скалодром.
  climb: sprite(`
    <path d="M20 106l14-90h60l-6 90z" fill="url(#wall)" ${stroke}/>
    <circle cx="48" cy="34" r="7" fill="#E5383B" ${stroke} stroke-width="2.5"/><circle cx="72" cy="48" r="6" fill="#FFD23F" ${stroke} stroke-width="2.5"/>
    <circle cx="46" cy="66" r="7" fill="#2FA35A" ${stroke} stroke-width="2.5"/><circle cx="70" cy="84" r="6" fill="#3BA3E5" ${stroke} stroke-width="2.5"/>`, lg('wall', '#E8C79A', '#B5651D')),
  // Квесты — ключ.
  quest: sprite(`
    <circle cx="38" cy="56" r="22" fill="url(#gold)" ${stroke}/><circle cx="38" cy="56" r="8" fill="#E6E1D3" ${stroke} stroke-width="3"/>
    <path d="M58 56h48v12M92 56v14M78 56v10" fill="none" stroke="#F0A21B" stroke-width="10" stroke-linecap="round"/><path d="M58 56h48v12M92 56v14M78 56v10" fill="none" ${stroke} stroke-width="2"/>
    ${shine('M24 48c2-6 6-10 12-11-4 3-7 6-8 11z', 0.7)}`, lg('gold', '#FFE07A', '#E09A12')),
  // VR — очки.
  vr: sprite(`
    <rect x="12" y="36" width="96" height="50" rx="18" fill="url(#vr)" ${stroke}/>
    <rect x="22" y="46" width="34" height="30" rx="10" fill="#2A2230"/><rect x="64" y="46" width="34" height="30" rx="10" fill="#2A2230"/>
    <path d="M52 86l8-10 8 10" fill="#E6E1D3" ${stroke} stroke-width="3"/>
    ${shine('M26 50h10v6H26zM68 50h10v6H68z', 0.5)}`, lg('vr', '#B79BFF', '#6A45C9')),
  // Гольф — флажок в лунке.
  golf: sprite(`
    <ellipse cx="60" cy="98" rx="44" ry="12" fill="#7FC27A" ${stroke}/><ellipse cx="62" cy="98" rx="8" ry="3" fill="${O}"/>
    <path d="M62 98V18" ${stroke}/><path d="M62 18l32 10-32 12z" fill="#E5383B" ${stroke} stroke-width="3"/>
    <circle cx="36" cy="92" r="6" fill="#FFFFFF" ${stroke} stroke-width="2.5"/>`),
  // Пейнтбол — клякса.
  paintball: sprite(`
    <path d="M60 16c6 10 16 4 20 14 3 8-6 12-1 20 5 7 18 4 18 14 0 10-13 8-16 16-3 9 6 16-4 19-11 2-10-10-19-10-9 0-11 12-20 7-8-4 0-14-6-20-6-6-18-4-16-14 1-9 13-7 15-16 2-9-8-13-3-20 6-7 14 1 21-3 6-4 7-14 11-7z" fill="url(#paint)" ${stroke}/>
    ${shine('M44 38c4-4 8-6 12-6-3 3-6 5-8 9z', 0.6)}`, lg('paint', '#FF6B5A', '#C2271E')),
  // Аквапарк — круг.
  aqua: sprite(`
    <circle cx="60" cy="58" r="40" fill="#E5383B" ${stroke}/><circle cx="60" cy="58" r="18" fill="#9EDBF5" ${stroke}/>
    <path d="M32 30l12 12M88 30L76 42M32 86l12-12M88 86L76 74" stroke="#FFFFFF" stroke-width="12"/>
    <circle cx="60" cy="58" r="40" fill="none" ${stroke}/><circle cx="60" cy="58" r="18" fill="none" ${stroke}/>`),
  zipline: sprite(`
    <path d="M4 16l112 38" ${stroke} fill="none"/>
    <path d="M56 34v18" ${stroke}/><circle cx="56" cy="62" r="9" fill="#FFC93C" ${stroke} stroke-width="3"/>
    <path d="M56 70v20l-10 14M56 90l10 14M44 78l12-4 12 4" ${stroke} fill="none" stroke-width="3.5"/>`),
  // Фотозона — фотоаппарат.
  photo: sprite(`
    <path d="M14 42a10 10 0 0 1 10-10h14l8-10h28l8 10h14a10 10 0 0 1 10 10v44a10 10 0 0 1-10 10H24a10 10 0 0 1-10-10z" fill="url(#cam)" ${stroke}/>
    <circle cx="60" cy="62" r="20" fill="#3A3046" ${stroke}/><circle cx="60" cy="62" r="11" fill="url(#lens)"/>
    <circle cx="92" cy="44" r="4" fill="#FFD45C"/>
    ${shine('M54 56c2-3 5-5 8-5-2 2-4 4-5 7z', 0.8)}`, lg('cam', '#FF8A5C', '#E0521F') + rg('lens', '#9EDBF5', '#2C6FB0')),
  // Парк, Терренкур — дерево.
  park: sprite(`
    <path d="M56 86h8v22h-8z" fill="#8A5A3C" ${stroke} stroke-width="3"/>
    <circle cx="60" cy="44" r="28" fill="url(#tree)" ${stroke}/><circle cx="38" cy="64" r="20" fill="url(#tree)" ${stroke}/><circle cx="82" cy="64" r="20" fill="url(#tree)" ${stroke}/>
    ${shine('M46 30c4-6 10-10 16-10-5 3-10 7-12 12z', 0.5)}`, rg('tree', '#8BD47F', '#2F7A3E')),
  // Сад — цветок.
  garden: sprite(`
    <path d="M60 64v42" stroke="#3E8E4E" stroke-width="6"/><path d="M60 92c-14 0-20-8-22-16 12 0 20 6 22 16z" fill="#5DB04A" ${stroke} stroke-width="3"/>
    ${[0, 72, 144, 216, 288].map((r) => `<ellipse cx="60" cy="26" rx="12" ry="18" fill="#F7A6C4" ${stroke} stroke-width="3" transform="rotate(${r} 60 46)"/>`).join('')}
    <circle cx="60" cy="46" r="11" fill="#FFD23F" ${stroke} stroke-width="3"/>`),
  // Музей — колонны.
  museum: sprite(`
    <path d="M10 42L60 14l50 28z" fill="url(#roof)" ${stroke}/>
    <rect x="16" y="42" width="88" height="8" fill="#E3DCCB" ${stroke} stroke-width="3"/>
    ${[24, 44, 64, 84].map((x) => `<rect x="${x}" y="50" width="12" height="40" fill="#FFFFFF" ${stroke} stroke-width="3"/>`).join('')}
    <rect x="10" y="90" width="100" height="12" rx="3" fill="#E3DCCB" ${stroke}/>`, lg('roof', '#F7E2B8', '#C9A061')),
  // Зоопарк — жираф.
  zoo: sprite(`
    <path d="M52 108V60c0-10-8-18-8-30 0-10 8-16 16-16 10 0 14 8 14 14h10c4 0 6 6 2 8l-12 4c0 10-4 18-4 30v38z" fill="url(#gir)" ${stroke}/>
    <circle cx="62" cy="40" r="4" fill="${O}"/><circle cx="56" cy="70" r="5" fill="#B5651D"/><circle cx="66" cy="86" r="5" fill="#B5651D"/><circle cx="58" cy="98" r="4" fill="#B5651D"/>
    <path d="M54 16l-4-10M66 14l2-10" ${stroke} stroke-width="3"/>`, lg('gir', '#FFD45C', '#E0A21B')),
  // Смотровая — бинокль.
  view: sprite(`
    <rect x="16" y="40" width="36" height="54" rx="16" fill="url(#bin)" ${stroke}/><rect x="68" y="40" width="36" height="54" rx="16" fill="url(#bin)" ${stroke}/>
    <rect x="46" y="48" width="28" height="18" rx="6" fill="#3A3046" ${stroke} stroke-width="3"/>
    <circle cx="34" cy="80" r="11" fill="#9EDBF5" ${stroke} stroke-width="3"/><circle cx="86" cy="80" r="11" fill="#9EDBF5" ${stroke} stroke-width="3"/>
    ${shine('M24 48h8v14h-8z', 0.5)}`, lg('bin', '#5A5262', '#1F1A26')),
};

/** Стеклянный фасад: полосы окон. */
const glassRows = (x, y, w, h, n, c = '#FFFFFF', o = 0.5) => Array.from({ length: n }, (_, i) => `<path d="M${x} ${y + (h / n) * (i + 0.5)}h${w}" stroke="${c}" stroke-width="2" opacity="${o}"/>`).join('');

/** ТРЦ — мультяшные портреты в узнаваемом стиле каждого центра (без чужих логотипов, только цвет и форма). */
export const MALLS = {
  // MEGA — длинный светлый короб с большой красной вывеской.
  mega: sprite(`
    <path d="M8 58l52-18 52 18v38l-52 14-52-14z" fill="#E9E6EF" ${stroke}/>
    <path d="M60 40v70M8 58l52 14 52-14" ${stroke} fill="none"/>
    <path d="M60 72l52-14v38l-52 14z" fill="#C9C4D6"/>
    <path d="M60 72l52-14v38l-52 14zM8 58l52 14v38L8 96z" fill="none" ${stroke}/>
    <rect x="20" y="22" width="80" height="26" rx="8" fill="url(#megaRed)" ${stroke}/>
    <text x="60" y="42" text-anchor="middle" font-family="Arial Black, Arial" font-weight="900" font-size="19" fill="#FFFFFF">MEGA</text>`, lg('megaRed', '#FF4D3D', '#B32F27')),
  // MEGA Park — тот же короб с зелёной крышей-парком.
  megapark: sprite(`
    <path d="M8 58l52-18 52 18v38l-52 14-52-14z" fill="#E9E6EF" ${stroke}/>
    <path d="M8 58l52 14 52-14" ${stroke} fill="none"/>
    <path d="M60 72l52-14v38l-52 14z" fill="#C9C4D6"/>
    <path d="M60 72l52-14v38l-52 14zM8 58l52 14v38L8 96z" fill="none" ${stroke}/>
    <circle cx="30" cy="54" r="9" fill="#5DB04A" ${stroke} stroke-width="3"/><circle cx="90" cy="54" r="9" fill="#5DB04A" ${stroke} stroke-width="3"/>
    <rect x="28" y="20" width="64" height="24" rx="8" fill="url(#megaRed)" ${stroke}/>
    <text x="60" y="38" text-anchor="middle" font-family="Arial Black, Arial" font-weight="900" font-size="13" fill="#FFFFFF">MEGA PARK</text>`, lg('megaRed', '#FF4D3D', '#B32F27')),
  // Dostyk Plaza — стеклянный полукруглый фасад бирюзового цвета с белыми рёбрами.
  dostyk: sprite(`
    <path d="M10 104V54c0-22 22-40 50-40s50 18 50 40v50z" fill="url(#dpGlass)" ${stroke}/>
    ${[22, 36, 50, 64, 78, 92].map((x) => `<path d="M${x} 104V${x < 60 ? 40 - (x - 22) / 3 : 34 + (x - 64) / 2}" stroke="#FFFFFF" stroke-width="2.5" opacity="0.8"/>`).join('')}
    ${glassRows(10, 40, 100, 64, 4, '#FFFFFF', 0.35)}
    <path d="M10 104V54c0-22 22-40 50-40s50 18 50 40v50z" fill="none" ${stroke}/>
    <rect x="42" y="84" width="36" height="20" rx="4" fill="#0E4F55" ${stroke} stroke-width="3"/>
    ${shine('M22 50c6-16 20-26 36-28-14 6-26 16-32 30z', 0.55)}`, lg('dpGlass', '#7FE0DA', '#1F8A8A')),
  // Esentai — низкий тёмный корпус с золотыми полосами и стеклянная башня рядом.
  esentai: sprite(`
    <path d="M78 104V16l22-6v94z" fill="url(#tower)" ${stroke}/>${glassRows(78, 14, 22, 90, 10, '#FFFFFF', 0.35)}
    <path d="M78 16l22-6v94" fill="none" ${stroke}/>
    <path d="M6 70q36-16 76 0v34H6z" fill="url(#esDark)" ${stroke}/>
    <path d="M10 82h68M10 92h68" stroke="#E6C27A" stroke-width="3"/>
    ${shine('M82 22l6-2v40l-6 2z', 0.4)}`, lg('tower', '#9FC4DE', '#3B5B78') + lg('esDark', '#4A423A', '#1E1A16')),
  // Aport — широкий короб с полосой-витриной и зелёным акцентом.
  aport: sprite(`
    <rect x="8" y="44" width="104" height="60" rx="8" fill="url(#apBody)" ${stroke}/>
    <rect x="8" y="44" width="104" height="16" rx="8" fill="url(#apGreen)" ${stroke}/>
    <rect x="18" y="68" width="84" height="22" rx="4" fill="#BFE4FF" ${stroke} stroke-width="3"/>${glassRows(18, 68, 84, 22, 2, '#FFFFFF', 0.6)}
    <text x="60" y="57" text-anchor="middle" font-family="Arial Black, Arial" font-weight="900" font-size="12" fill="#FFFFFF">APORT</text>`, lg('apBody', '#F3EFE6', '#CFC8B8') + lg('apGreen', '#5DB04A', '#2F7A3E')),
  // Forum — фасад с колоннами и фиолетовым фронтоном.
  forum: sprite(`
    <path d="M10 46L60 18l50 28z" fill="url(#fRoof)" ${stroke}/>
    ${[18, 38, 58, 78, 98].map((x) => `<rect x="${x - 4}" y="46" width="12" height="46" fill="#FFFFFF" ${stroke} stroke-width="3"/>`).join('')}
    <rect x="8" y="92" width="104" height="14" rx="3" fill="#E3DCCB" ${stroke}/>
    <text x="60" y="40" text-anchor="middle" font-family="Arial Black, Arial" font-weight="900" font-size="11" fill="#FFFFFF">FORUM</text>`, lg('fRoof', '#B79BFF', '#6A45C9')),
  // Любой другой центр — объёмное здание.
  mall: sprite(`
    <path d="M60 20l46 22-46 22-46-22z" fill="#9EB4F5" ${stroke}/>
    <path d="M14 42l46 22v44L14 86z" fill="#5A72D6" ${stroke}/><path d="M60 64l46-22v44l-46 22z" fill="#3A4FB0" ${stroke}/>
    ${[0, 1, 2, 3].map((i) => `<path d="M20 ${54 + i * 9}l34 16" stroke="#FFFFFF" stroke-width="2.5" opacity="0.6"/>`).join('')}`),
};
