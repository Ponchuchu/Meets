// h3-js через обёртку: встроенный TextDecoder в Expo (winter) не знает utf-16le, а h3-js (emscripten)
// создаёт такой декодер при загрузке. Без TextDecoder библиотека сама берёт медленный, но рабочий путь.
type H3 = typeof import('h3-js');

function load(): H3 {
  const g = globalThis as { TextDecoder?: unknown };
  const saved = g.TextDecoder;
  let broken = false;
  try {
    if (saved) new (saved as any)('utf-16le');
  } catch {
    broken = true;
  }
  if (broken) g.TextDecoder = undefined;
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    return require('h3-js') as H3;
  } finally {
    if (broken) g.TextDecoder = saved;
  }
}

const h3 = load();
export const { latLngToCell, cellToLatLng, gridDisk, gridDistance, cellToBoundary } = h3;
