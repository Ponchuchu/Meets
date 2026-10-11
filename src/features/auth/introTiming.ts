const WORD_DONE_MS = 1950;
const OPEN_BY_MS = 2550;
export const REVEAL_MS = 650;

/** Карта ждёт готовности только до 2,55 с; приветствие открывается сразу после слова. */
export function startIntroReveal({ map, subscribe, open, end }: {
  map: () => { mapActive: boolean; mapReady: boolean };
  subscribe: (fn: () => void) => () => void;
  open: () => void;
  end: () => void;
}): () => void {
  let wordDone = false;
  let opened = false;
  const timers: ReturnType<typeof setTimeout>[] = [];
  const reveal = () => {
    if (opened) return;
    opened = true;
    open();
    timers.push(setTimeout(end, REVEAL_MS));
  };
  const check = () => {
    const state = map();
    if (wordDone && (!state.mapActive || state.mapReady)) reveal();
  };
  timers.push(setTimeout(() => { wordDone = true; check(); }, WORD_DONE_MS), setTimeout(reveal, OPEN_BY_MS));
  const unsubscribe = subscribe(check);
  return () => { timers.forEach(clearTimeout); unsubscribe(); };
}
