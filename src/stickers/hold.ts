/** One timer per held sticker. No catch-up burst after a stalled JS thread. */
export const STICKER_HOLD_LIMIT = 100;

export function createStickerHold(onTick: (count: number) => void) {
  let timer: ReturnType<typeof setTimeout> | undefined;
  let running = false;
  let count = 0;
  const stop = () => { running = false; clearTimeout(timer); timer = undefined; };
  const tick = () => {
    if (!running) return;
    count += 1;
    onTick(count);
    if (count >= STICKER_HOLD_LIMIT) { stop(); return; }
    if (running) timer = setTimeout(tick, count < 10 ? 120 : count < 30 ? 80 : 50);
  };
  return {
    start: () => { if (!running) { count = 0; running = true; tick(); } },
    stop,
  };
}
