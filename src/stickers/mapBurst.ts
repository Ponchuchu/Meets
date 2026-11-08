/** Объединяем частые нажатия в короткие посылки, чтобы очередь не забивала сеть. */
export function createMapBurstQueue(send: (to: string, sticker: string, count: number) => void, delay = 250) {
  const pending = new Map<string, { to: string; sticker: string; count: number }>();
  let timer: ReturnType<typeof setTimeout> | undefined;
  const flush = () => {
    clearTimeout(timer); timer = undefined;
    const batches = [...pending.values()]; pending.clear();
    for (const b of batches) send(b.to, b.sticker, b.count);
  };
  return {
    add(to: string, sticker: string, count = 1) {
      if (!Number.isInteger(count) || count < 1) return;
      const key = `${to}:${sticker}`;
      const batch = pending.get(key) ?? { to, sticker, count: 0 };
      batch.count = Math.min(100, batch.count + count);
      pending.set(key, batch);
      timer ??= setTimeout(flush, delay);
    },
    flush,
  };
}
