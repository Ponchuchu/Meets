/** Bounded, memory-only signed URLs; concurrent refreshes share requests. Never persists credentials. */
export function createSignedMediaCache(limit = 512, lifetimeMs = 55 * 60e3) {
  let owner: string | null = null;
  let generation = 0;
  const entries = new Map<string, { url: string; until: number }>();
  const pending = new Map<string, Promise<string | undefined>>();
  const clear = () => { generation++; entries.clear(); pending.clear(); owner = null; };
  return {
    clear,
    async resolve(user: string, paths: string[], sign: (paths: string[]) => Promise<{ path: string; signedUrl: string }[]>, now = Date.now()) {
      if (owner !== user) { clear(); owner = user; }
      const token = generation;
      const result = new Map<string, string>();
      const missing: string[] = [];
      const waits = new Map<string, Promise<string | undefined>>();
      for (const path of new Set(paths)) {
        const entry = entries.get(path);
        if (entry && entry.until > now) { result.set(path, entry.url); entries.delete(path); entries.set(path, entry); }
        else {
          entries.delete(path);
          const existing = pending.get(path);
          if (existing) waits.set(path, existing); else missing.push(path);
        }
      }
      if (missing.length) {
        const batch = Promise.resolve().then(() => sign(missing)).then(urls => new Map(urls.map(item => [item.path, item.signedUrl])));
        for (const path of missing) {
          const request = batch.then(urls => {
            const url = urls.get(path);
            if (url && generation === token) {
              entries.set(path, { url, until: now + lifetimeMs });
              while (entries.size > limit) entries.delete(entries.keys().next().value!);
            }
            return url;
          }).finally(() => { if (pending.get(path) === request) pending.delete(path); });
          pending.set(path, request); waits.set(path, request);
        }
      }
      await Promise.all([...waits].map(async ([path, request]) => { const url = await request; if (url) result.set(path, url); }));
      return result;
    },
  };
}
export const signedMediaCache = createSignedMediaCache();
