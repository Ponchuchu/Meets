// Общие помощники рисования объёмных значков карты (scripts/map-sprites.mjs).
export const O = '#2A2230'; // контур
export const W = 120, H = 140; // холст: предмет сверху, тень снизу (кончик — середина тени)

/** Линейный градиент «свет сверху слева». */
export const lg = (id, a, b) => `<linearGradient id="${id}" x1="0" y1="0" x2="0.6" y2="1"><stop offset="0" stop-color="${a}"/><stop offset="1" stop-color="${b}"/></linearGradient>`;
export const rg = (id, a, b) => `<radialGradient id="${id}" cx="35%" cy="30%" r="75%"><stop offset="0" stop-color="${a}"/><stop offset="1" stop-color="${b}"/></radialGradient>`;
/** Блик — белое пятно. */
export const shine = (d, o = 0.55) => `<path d="${d}" fill="#FFFFFF" opacity="${o}"/>`;
export const stroke = `stroke="${O}" stroke-width="4" stroke-linejoin="round" stroke-linecap="round"`;

/** Обёртка: тень на земле + предмет, приподнятый над ней. */
export function sprite(body, defs = '') {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
  <defs>${defs}<radialGradient id="sh" cx="50%" cy="50%" r="50%"><stop offset="0" stop-color="#17161A" stop-opacity="0.38"/><stop offset="1" stop-color="#17161A" stop-opacity="0"/></radialGradient></defs>
  <ellipse cx="60" cy="130" rx="30" ry="8" fill="url(#sh)"/>
  <g transform="translate(0 -4)">${body}</g></svg>`;
}

