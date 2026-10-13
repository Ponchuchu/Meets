// Сгенерировано scripts/build-functions.mjs из src/server/shared.ts — не править руками.

// src/event/series.ts
function groupEventDates(events) {
  const groups = /* @__PURE__ */ new Map();
  for (const e of events) {
    let source = "";
    try {
      const u = new URL(e.sourceUrl ?? "");
      for (const key2 of [...u.searchParams.keys()]) if (/^utm_|^(ref|fbclid|gclid)$/i.test(key2)) u.searchParams.delete(key2);
      if (/^https?:$/.test(u.protocol) && u.pathname !== "/") source = `${u.host}${u.pathname}${u.search}`;
    } catch {
    }
    const key = source && !e.meetup ? [source, e.title.trim().toLowerCase(), e.venueName?.trim().toLowerCase() ?? e.address.trim().toLowerCase(), e.category, e.priceMin, e.priceMax].join("|") : e.id;
    const group = groups.get(key) ?? [];
    if (!group.some((x) => x.id === e.id)) group.push(e);
    groups.set(key, group);
  }
  return [...groups.values()].flatMap((group) => {
    group.sort((a, b) => Date.parse(a.startsAt) - Date.parse(b.startsAt));
    if (group.length < 2 || Date.parse(group.at(-1).startsAt) - Date.parse(group[0].startsAt) > 7 * 864e5) return group;
    const first = group[0], last = group.at(-1);
    return [{ ...first, isLong: true, endsAt: last.endsAt ?? last.startsAt, sessions: group.map((e) => ({ id: e.id, startsAt: e.startsAt, endsAt: e.endsAt })) }];
  });
}

// src/lib/clock.ts
var TZ_MIN = 5 * 60;
function almaty(d) {
  const t = typeof d === "string" ? new Date(d) : d;
  return new Date(t.getTime() + TZ_MIN * 6e4);
}
function dayIndex(d) {
  return Math.floor(almaty(d).getTime() / 864e5);
}
function dayStart(index) {
  return new Date(index * 864e5 - TZ_MIN * 6e4);
}

// src/map/lifecycle.ts
var MIN = 6e4;
var HOUR = 60 * MIN;
var LATE_HIDE = 40 * MIN;
var SOON = HOUR;
var CLOSING = 30 * MIN;
var DEFAULT_LENGTH = 2 * HOUR;
function endOf(e) {
  return e.endsAt ? new Date(e.endsAt).getTime() : new Date(e.startsAt).getTime() + DEFAULT_LENGTH;
}
function phaseOf(e, now, going = false) {
  const t = now.getTime();
  const start = new Date(e.startsAt).getTime();
  const end = endOf(e);
  if (t >= end) return "hidden";
  if (e.isLong) {
    if (t < start) return dayIndex(e.startsAt) === dayIndex(now) ? start - t <= SOON ? "soon" : "today" : "announce";
    if (!openNow(e, now)) return minutesOfDay(now) < minutesOfDay(new Date(e.startsAt)) ? "today" : "hidden";
    return closesToday(e, now) - t <= CLOSING ? "closing" : "live";
  }
  if (t >= start) return t - start <= LATE_HIDE || going ? "live" : "hidden";
  if (start - t <= SOON) return "soon";
  return dayIndex(e.startsAt) === dayIndex(now) ? "today" : "announce";
}
function minutesOfDay(d) {
  const a = almaty(d);
  return a.getUTCHours() * 60 + a.getUTCMinutes();
}
function openNow(e, now) {
  const open = minutesOfDay(new Date(e.startsAt));
  const close = minutesOfDay(new Date(endOf(e)));
  const m = minutesOfDay(now);
  return close > open ? m >= open && m < close : true;
}
function closesToday(e, now) {
  const close = minutesOfDay(new Date(endOf(e)));
  const a = almaty(now);
  const diff = close - (a.getUTCHours() * 60 + a.getUTCMinutes());
  return now.getTime() + diff * MIN;
}

// src/reco/startTaste.ts
var INTEREST_TAGS = {
  music: ["\u0434\u0436\u0430\u0437", "\u0440\u043E\u043A", "\u0430\u043A\u0443\u0441\u0442\u0438\u043A\u0430", "\u0434\u0436\u0435\u043C", "open-air-\u043A\u043E\u043D\u0446\u0435\u0440\u0442", "\u043A\u043E\u043D\u0446\u0435\u0440\u0442", "\u0436\u0438\u0432\u0430\u044F \u043C\u0443\u0437\u044B\u043A\u0430"],
  standup: ["\u0441\u0442\u0435\u043D\u0434\u0430\u043F", "\u0438\u043C\u043F\u0440\u043E\u0432", "\u043E\u0442\u043A\u0440\u044B\u0442\u044B\u0439 \u043C\u0438\u043A\u0440\u043E\u0444\u043E\u043D", "\u044E\u043C\u043E\u0440"],
  hike: ["\u043F\u043E\u0445\u043E\u0434", "\u043F\u0438\u043A\u043D\u0438\u043A", "\u0437\u0430\u043A\u0430\u0442", "\u043E\u0437\u0435\u0440\u043E", "\u0433\u043E\u0440\u044B"],
  sport: ["\u0437\u0430\u0431\u0435\u0433", "\u0432\u0435\u043B\u043E\u043F\u0440\u043E\u0433\u0443\u043B\u043A\u0430", "\u0439\u043E\u0433\u0430 \u0432 \u043F\u0430\u0440\u043A\u0435", "\u0431\u0435\u0433", "\u0441\u043F\u043E\u0440\u0442"],
  people: ["\u043D\u0435\u0442\u0432\u043E\u0440\u043A\u0438\u043D\u0433", "\u044F\u0437\u044B\u043A\u043E\u0432\u043E\u0439 \u043A\u043B\u0443\u0431", "\u043C\u043E\u0436\u043D\u043E \u043E\u0434\u043D\u043E\u043C\u0443", "\u0437\u043D\u0430\u043A\u043E\u043C\u0441\u0442\u0432\u0430"],
  games: ["\u043C\u0430\u0444\u0438\u044F", "\u043D\u0430\u0441\u0442\u043E\u043B\u043A\u0438", "\u043A\u0432\u0438\u0437"],
  art: ["\u0438\u0441\u043A\u0443\u0441\u0441\u0442\u0432\u043E", "\u0444\u043E\u0442\u043E", "\u0430\u043D\u0438\u043C\u0435", "\u043C\u0443\u0437\u0435\u0438", "\u0432\u044B\u0441\u0442\u0430\u0432\u043A\u0430"],
  food: ["\u043C\u0430\u0440\u043A\u0435\u0442", "\u0444\u0443\u0434\u0444\u0435\u0441\u0442", "\u0434\u0435\u0433\u0443\u0441\u0442\u0430\u0446\u0438\u044F", "\u044F\u0440\u043C\u0430\u0440\u043A\u0430"],
  party: ["\u0432\u0435\u0447\u0435\u0440\u0438\u043D\u043A\u0430", "\u0434\u0438\u0434\u0436\u0435\u0439", "\u0442\u0430\u043D\u0446\u044B"],
  talks: ["\u043B\u0435\u043A\u0446\u0438\u044F", "\u043A\u0438\u043D\u043E\u043F\u043E\u043A\u0430\u0437", "\u043C\u0430\u0441\u0442\u0435\u0440-\u043A\u043B\u0430\u0441\u0441"]
};
var BASE = 0.15;
function buildTimeGrid(times) {
  const grid = Array.from({ length: 7 }, () => ({ morning: BASE, day: BASE, evening: BASE }));
  const set = (days, parts, v) => days.forEach((d) => parts.forEach((p) => {
    grid[d][p] = Math.max(grid[d][p], v);
  }));
  if (times.includes("weekday")) set([0, 1, 2, 3, 4], ["evening"], 1);
  if (times.includes("friday")) set([4], ["evening"], 1);
  if (times.includes("weekend")) set([5, 6], ["morning", "day"], 1);
  if (times.includes("weekendNight")) set([5, 6], ["evening"], 1);
  if (times.includes("now")) grid.forEach((d) => Object.keys(d).forEach((p) => {
    d[p] = Math.max(d[p], 0.5);
  }));
  return grid;
}
var PRICE_CEILING = { free: 0, mid: 5e3, any: null };
var FRIENDS_MULTIPLIER = { friends: 2.4, mixed: 1.6, alone: 1.1 };
function buildStartTaste(a) {
  const tags = {};
  for (const i of a.interests) for (const t of INTEREST_TAGS[i]) tags[t] = 1;
  if (a.withWho === "alone") tags["\u043C\u043E\u0436\u043D\u043E \u043E\u0434\u043D\u043E\u043C\u0443"] = Math.max(tags["\u043C\u043E\u0436\u043D\u043E \u043E\u0434\u043D\u043E\u043C\u0443"] ?? 0, 0.6);
  if (a.budget === "free") tags["\u0431\u0435\u0441\u043F\u043B\u0430\u0442\u043D\u043E"] = 0.8;
  return {
    tags,
    timeGrid: buildTimeGrid(a.times),
    priceCeiling: PRICE_CEILING[a.budget],
    friendsMultiplier: FRIENDS_MULTIPLIER[a.withWho],
    startAnswers: a
  };
}

// src/reco/index.ts
var SIGNAL_WEIGHT = {
  arrived: 3,
  company: 1.5,
  go: 1,
  invite: 1,
  save: 0.6,
  open: 0.3,
  dwell: 0.2,
  skipAfterOpen: -0.2,
  noShow: -0.3,
  skip: -0.4
};
var HALF_LIFE_DAYS = 30;
var LEARNING_RATE = 0.25;
var CALIBRATION = 10;
var SKIP_STREAK = 3;
var STREAK_PENALTY = 0.5;
function eventTags(e) {
  const group = {
    music: "music",
    concert: "music",
    standup: "standup",
    hike: "hike",
    sport: "sport",
    bike: "sport",
    meetup: "people",
    games: "games",
    art: "art",
    theatre: "art",
    movie: "art",
    food: "food",
    party: "party",
    talks: "talks",
    lecture: "talks"
  };
  const g = group[e.category];
  const base = g ? INTEREST_TAGS[g].slice(0, 2) : [];
  const set = /* @__PURE__ */ new Set([...e.tags.map((t) => t.toLowerCase()), ...base]);
  if (e.isFree || e.priceMin === 0) set.add("\u0431\u0435\u0441\u043F\u043B\u0430\u0442\u043D\u043E");
  return [...set];
}
function applySignal(taste, s, now, calibration = false) {
  const ageDays = Math.max(0, (now.getTime() - new Date(s.at).getTime()) / 864e5);
  const decay = 0.5 ** (ageDays / HALF_LIFE_DAYS);
  const w = SIGNAL_WEIGHT[s.kind] * decay * LEARNING_RATE * (calibration ? 2 : 1);
  const tags = { ...taste.tags };
  for (const t of s.tags) tags[t] = Math.max(-1.5, Math.min(3, (tags[t] ?? 0) + w));
  return { ...taste, tags };
}
function tasteFrom(answers, signals, now) {
  let taste = buildStartTaste(answers);
  let streakCat = null;
  let streak = 0;
  signals.forEach((s, i) => {
    taste = applySignal(taste, s, now, i < CALIBRATION);
    if (s.kind === "skip" || s.kind === "skipAfterOpen") {
      streak = s.category === streakCat ? streak + 1 : 1;
      streakCat = s.category;
      if (streak === SKIP_STREAK) {
        const tags = { ...taste.tags };
        for (const t of s.tags) tags[t] = (tags[t] ?? 0) - STREAK_PENALTY;
        taste = { ...taste, tags };
      }
    } else if (s.kind === "go" || s.kind === "save" || s.kind === "company" || s.kind === "arrived") {
      streak = 0;
      streakCat = null;
    }
  });
  return taste;
}
var WEIGHTS = { taste: 0.35, friends: 0.2, time: 0.15, price: 0.1, soon: 0.1, similar: 0.05, novelty: 0.05 };
function dayPartOf(iso) {
  const a = almaty(iso);
  const h = a.getUTCHours();
  return { wd: (a.getUTCDay() + 6) % 7, part: h < 12 ? "morning" : h < 17 ? "day" : "evening" };
}
function scoreEvent(taste, e, ctx) {
  const tags = eventTags(e);
  const ws = tags.map((t) => taste.tags[t] ?? 0);
  const positive = ws.filter((w) => w > 0);
  const tasteRaw = ws.reduce((a, b) => a + b, 0) / Math.max(1, Math.min(tags.length, 4));
  const tasteScore = Math.max(0, Math.min(1, tasteRaw));
  const friends = Math.min(1, e.friendsGoing.length / 2) * Math.min(1, taste.friendsMultiplier / 2.4);
  const { wd, part } = dayPartOf(e.startsAt);
  const time = taste.timeGrid[wd]?.[part] ?? 0.15;
  const price = e.isFree || !e.priceMin ? 1 : taste.priceCeiling == null ? 1 : taste.priceCeiling === 0 ? 0 : e.priceMin <= taste.priceCeiling ? 1 : Math.max(0, 1 - (e.priceMin - taste.priceCeiling) / taste.priceCeiling);
  const days = Math.max(0, dayIndex(e.startsAt) - dayIndex(ctx.now));
  const soon = Math.max(0, 1 - days / 14);
  const similar = ctx.similar ? ctx.similar(e) : Math.min(1, Math.log10(1 + e.goingCount) / Math.log10(5e3));
  const novelty = positive.length === 0 ? 1 : 0;
  const parts = { taste: tasteScore, friends, time, price, soon, similar, novelty };
  const total = Object.keys(WEIGHTS).reduce((sum, k) => sum + WEIGHTS[k] * parts[k], 0);
  return { total, parts };
}
function buildDeck(taste, candidates, history, ctx, opts = {}) {
  const size = opts.size ?? 10;
  const every = opts.noveltyEvery ?? 8;
  const pool = groupEventDates(candidates).filter((e) => !history.decided.has(e.id) && !e.sessions?.some((s) => history.decided.has(s.id)) && phaseOf(e, ctx.now) !== "hidden" && !e.meetup).map((e) => ({ e, s: scoreEvent(taste, e, ctx) })).sort((a, b) => b.s.total - a.s.total || Date.parse(a.e.startsAt) - Date.parse(b.e.startsAt));
  const deck = [];
  const used = /* @__PURE__ */ new Set();
  const calibrating = history.swipes < CALIBRATION;
  while (deck.length < size && used.size < pool.length) {
    const pos = deck.length;
    const last2 = deck.slice(-2).map((e) => e.category);
    const blocked = last2.length === 2 && last2[0] === last2[1] ? last2[0] : null;
    const recent = new Set(deck.slice(-3).map((e) => e.category));
    const free = pool.filter((x) => !used.has(x.e.id));
    let pick;
    if (pos >= 3 && (pos + 1) % every === 0) {
      pick = [...free].sort((a, b) => b.s.parts.novelty - a.s.parts.novelty || a.s.parts.taste - b.s.parts.taste || b.s.total - a.s.total).find((x) => x.e.category !== blocked);
    }
    if (!pick && calibrating && pos >= 3) pick = free.find((x) => !recent.has(x.e.category) && x.s.parts.taste > 0);
    if (!pick) pick = free.find((x) => x.e.category !== blocked) ?? free[0];
    if (!pick) break;
    used.add(pick.e.id);
    deck.push(pick.e);
  }
  return deck;
}

// src/notify/rules.ts
var DEFAULT_PREFS = { friendNear: true, interestNear: true, remind2h: true, messages: true, weekend: false };
var DAILY_LIMIT = 4;
var QUIET_FROM = 23;
var QUIET_TO = 9;
var FRIEND_NEAR_COOLDOWN_MS = 3 * 36e5;
var STICKER_COOLDOWN_MS = 3e4;
var REMINDER_BEFORE_MS = 2 * 36e5;
var INSTANT = ["message", "sticker", "invite", "cancelled", "staff"];
var OUTSIDE_LIMIT = ["message", "sticker", "cancelled", "staff"];
function isQuiet(at) {
  const h = almaty(at).getUTCHours();
  return h >= QUIET_FROM || h < QUIET_TO;
}
function quietEnd(at) {
  const day = dayIndex(at) + (almaty(at).getUTCHours() >= QUIET_FROM ? 1 : 0);
  return new Date(dayStart(day).getTime() + QUIET_TO * 36e5);
}
function allowedByPrefs(kind, p) {
  switch (kind) {
    case "message":
    case "sticker":
    case "invite":
      return p.messages;
    case "friendNear":
      return p.friendNear;
    case "interestNear":
      return p.interestNear;
    case "reminder":
      return p.remind2h;
    case "weekend":
      return p.weekend;
    case "dailyFeed":
    case "cancelled":
    case "staff":
      return true;
  }
}
function decide(c, sent, prefs = DEFAULT_PREFS) {
  if (!allowedByPrefs(c.kind, prefs)) return { send: false, reason: "prefs" };
  const t = c.at.getTime();
  if (c.kind === "sticker" && c.about) {
    const last = sent.find((s) => s.kind === "sticker" && s.about === c.about && t - s.at.getTime() < STICKER_COOLDOWN_MS);
    if (last) return { send: false, reason: "stickerCooldown", retryAt: new Date(last.at.getTime() + STICKER_COOLDOWN_MS) };
  }
  if (c.kind === "friendNear" && c.about) {
    const last = sent.find((s) => s.kind === "friendNear" && s.about === c.about && t - s.at.getTime() < FRIEND_NEAR_COOLDOWN_MS);
    if (last) return { send: false, reason: "friendCooldown" };
  }
  if ((c.kind === "reminder" || c.kind === "dailyFeed" || c.kind === "weekend") && sent.some((s) => s.kind === c.kind && s.about === (c.about ?? void 0) && dayIndex(s.at) === dayIndex(c.at))) {
    return { send: false, reason: "duplicate" };
  }
  if (!OUTSIDE_LIMIT.includes(c.kind)) {
    const today = dayIndex(c.at);
    const counted = sent.filter((s) => !OUTSIDE_LIMIT.includes(s.kind) && dayIndex(s.at) === today).length;
    if (counted >= DAILY_LIMIT) return { send: false, reason: "dailyLimit" };
  }
  if (isQuiet(c.at)) {
    if (INSTANT.includes(c.kind) || c.kind === "reminder") return { send: true, silent: true };
    if (c.kind === "friendNear" || c.kind === "interestNear") return { send: false, reason: "quiet" };
    return { send: false, reason: "quiet", retryAt: quietEnd(c.at) };
  }
  return { send: true, silent: false };
}
function reminderAt(startsAt, now) {
  const start = new Date(startsAt).getTime();
  if (start <= now.getTime()) return null;
  return new Date(Math.max(start - REMINDER_BEFORE_MS, now.getTime()));
}
function nextScheduled(kind, now) {
  const hour = kind === "dailyFeed" ? 10 : 18;
  let day = dayIndex(now);
  for (let i = 0; i < 8; i++, day++) {
    const at = new Date(dayStart(day).getTime() + hour * 36e5);
    if (at > now && (kind === "dailyFeed" || day % 7 === 0)) return at;
  }
  throw new Error("unreachable");
}

// src/data/weather.ts
function skyOf(code) {
  if (code === 0) return { sky: "sun", text: "\u044F\u0441\u043D\u043E" };
  if (code <= 2) return { sky: "part", text: "\u043F\u0435\u0440\u0435\u043C\u0435\u043D\u043D\u0430\u044F \u043E\u0431\u043B\u0430\u0447\u043D\u043E\u0441\u0442\u044C" };
  if (code === 3) return { sky: "cloud", text: "\u043E\u0431\u043B\u0430\u0447\u043D\u043E" };
  if (code === 45 || code === 48) return { sky: "cloud", text: "\u0442\u0443\u043C\u0430\u043D" };
  if (code >= 71 && code <= 77 || code === 85 || code === 86) return { sky: "cloud", text: "\u0441\u043D\u0435\u0433" };
  if (code >= 95) return { sky: "rain", text: "\u0433\u0440\u043E\u0437\u0430" };
  return { sky: "rain", text: "\u0434\u043E\u0436\u0434\u044C" };
}
function fromOpenMeteo(p, today) {
  const { time, weather_code: codes, temperature_2m_max: temps } = p.daily;
  const start = Math.max(0, time.indexOf(today));
  const out = [];
  for (let i = start; i < time.length && out.length < 7; i++) out.push({ ...skyOf(codes[i]), temp: Math.round(temps[i]) });
  if (!out.length) throw new Error("empty forecast");
  while (out.length < 7) out.push(out[out.length - 1]);
  return out;
}

// src/data/seed.ts
var LONG_EVENT_MS = 6 * 3600 * 1e3;
function isLongEvent(startsAt, endsAt) {
  return !!endsAt && new Date(endsAt).getTime() - new Date(startsAt).getTime() > LONG_EVENT_MS;
}
var SOURCES = [
  [/sxodim/, "Sxodim"],
  [/ticketon/, "Ticketon"],
  [/afisha\.yandex|yandex\.[a-z]+\/afisha/, "\u042F\u043D\u0434\u0435\u043A\u0441 \u0410\u0444\u0438\u0448\u0430"],
  [/kino\.kz/, "Kino.kz"],
  [/t\.me/, "Telegram"],
  [/instagram/, "Instagram"],
  [/threads/, "Threads"]
];
function sourceName(url) {
  if (!url) return void 0;
  const hit = SOURCES.find(([re]) => re.test(url));
  if (hit) return hit[1];
  const m = /^https?:\/\/(?:www\.)?([^/]+)/.exec(url);
  return m ? m[1] : void 0;
}

// src/data/feedRow.ts
function mapFeedRow(r) {
  return {
    id: r.external_id ?? r.id,
    title: r.title,
    category: r.category,
    tags: r.tags ?? [],
    startsAt: r.starts_at,
    endsAt: r.ends_at,
    isLong: r.is_long || isLongEvent(r.starts_at, r.ends_at),
    venueName: r.venue_name,
    address: r.address ?? "",
    addressNote: r.address_note ?? void 0,
    lat: r.lat ?? 43.2389,
    lon: r.lon ?? 76.8897,
    needsPin: r.needs_pin || r.lat == null,
    ...r.lat == null ? { noPoint: true } : {},
    priceMin: r.price_min,
    priceMax: r.price_max,
    isFree: r.is_free,
    about: r.about ?? "",
    organizer: r.organizer,
    sourceUrl: r.source_url,
    source: sourceName(r.source_url),
    cover: r.cover_url,
    visibility: r.visibility,
    origin: "real",
    friendsGoing: [],
    lookingCount: 0,
    goingCount: 0
  };
}
export {
  DEFAULT_PREFS,
  buildDeck,
  buildStartTaste,
  decide,
  fromOpenMeteo,
  mapFeedRow,
  nextScheduled,
  reminderAt,
  scoreEvent,
  skyOf,
  tasteFrom
};
