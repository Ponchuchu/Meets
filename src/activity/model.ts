// Лента уведомлений (FIX5): строки из my_activity() → текст, значок, куда вести и что можно сделать прямо в строке.
// Без интерфейса — покрыто тестами.

export interface ActivityRow { kind: string; at: string; person_id: string | null; person_name: string | null; person_photo: string | null; event_id: string | null; event_title: string | null; detail: string | null }

export type ActivityIcon = 'alert' | 'person' | 'friend' | 'calendar' | 'sticker' | 'near' | 'bell' | 'cancel' | 'shield' | 'sparkles';
export interface ActivityItem {
  id: string; kind: string; at: string;
  /** Жирное имя в начале строки (как в Instagram) и остальной текст. */
  who: string | null; text: string;
  personId: string | null; photo: string | null; eventId: string | null;
  icon: ActivityIcon;
  /** Куда ведёт нажатие. */
  href: string | null;
  /** Действие в строке: принять заявку, ответить на приглашение, выйти с других устройств. */
  action: 'friend' | 'invite' | 'security' | null;
}

/** «okhttp/4.12.0», «Mozilla/5.0 (iPhone…)» → «Android», «iPhone», «браузер». */
export function deviceOf(ua: string | null): string {
  const s = (ua ?? '').toLowerCase();
  if (/iphone|ipad|cfnetwork|darwin/.test(s)) return 'iPhone';
  if (/android|okhttp|dalvik/.test(s)) return 'Android';
  if (/mozilla|chrome|safari|firefox/.test(s)) return 'браузер';
  return 'неизвестное устройство';
}

export function toItem(r: ActivityRow, i = 0): ActivityItem {
  const base = { id: `${r.kind}:${r.at}:${r.person_id ?? r.event_id ?? i}`, kind: r.kind, at: r.at, personId: r.person_id, photo: r.person_photo, eventId: r.event_id, who: r.person_name, action: null };
  const ev = r.event_title ? `«${r.event_title}»` : 'событие';
  switch (r.kind) {
    case 'friend_request': return { ...base, text: `хочет добавить тебя в друзья${r.detail ? `: «${r.detail}»` : ''}`, icon: 'person', href: r.person_id ? `/person/${r.person_id}` : null, action: 'friend' };
    case 'friend_added': return { ...base, text: 'теперь у тебя в друзьях', icon: 'friend', href: r.person_id ? `/person/${r.person_id}` : null };
    case 'invite': return { ...base, text: `зовёт тебя на ${ev}`, icon: 'calendar', href: r.event_id ? `/event/${r.event_id}` : null, action: r.detail ? null : 'invite' };
    case 'invite_answer': return { ...base, text: r.detail === 'yes' ? `идёт с тобой на ${ev}` : `не сможет прийти на ${ev}`, icon: 'calendar', href: r.event_id ? `/event/${r.event_id}` : null };
    case 'push_sticker': return { ...base, text: 'кинул(а) тебе стикер на карте', icon: 'sticker', href: r.person_id ? `/chat/dm-${r.person_id}` : null };
    case 'push_friendNear': return { ...base, text: 'рядом с тобой', icon: 'near', href: '/' };
    case 'push_reminder': return { ...base, who: null, text: `Скоро ${ev} — не забудь`, icon: 'bell', href: r.event_id ? `/event/${r.event_id}` : null };
    case 'push_cancelled': return { ...base, who: null, text: `Отменили ${ev}`, icon: 'cancel', href: r.event_id ? `/event/${r.event_id}` : null };
    case 'push_dailyFeed': return { ...base, who: null, text: 'Новая подборка «Для тебя» — 10 событий под твои интересы', icon: 'sparkles', href: '/foryou' };
    case 'push_weekend': return { ...base, who: null, text: 'Подборка на выходные готова', icon: 'sparkles', href: '/foryou' };
    case 'login_failed': return { ...base, who: null, photo: null, text: `Кто-то пытался войти в твой аккаунт · неверный код · ${deviceOf(r.detail)}`, icon: 'alert', href: null, action: 'security' };
    case 'login': return { ...base, who: null, photo: null, text: `Вход в аккаунт · ${deviceOf(r.detail)}`, icon: 'shield', href: null, action: 'security' };
    default: return { ...base, who: null, text: 'Уведомление', icon: 'bell', href: null };
  }
}

/** Группы как в Instagram: «Новые» (после последнего просмотра), «Сегодня», «Вчера», «На этой неделе», «Раньше». */
export function groupActivity(items: ActivityItem[], seenAt: number, now: number): { title: string; items: ActivityItem[] }[] {
  const day = (t: number) => Math.floor((t + 5 * 3600e3) / 86400e3);
  const today = day(now);
  const title = (it: ActivityItem) => {
    const t = Date.parse(it.at);
    if (t > seenAt) return 'Новые';
    const d = today - day(t);
    return d <= 0 ? 'Сегодня' : d === 1 ? 'Вчера' : d < 7 ? 'На этой неделе' : 'Раньше';
  };
  const out: { title: string; items: ActivityItem[] }[] = [];
  for (const it of [...items].sort((a, b) => Date.parse(b.at) - Date.parse(a.at))) {
    const g = title(it);
    const last = out.find((x) => x.title === g);
    if (last) last.items.push(it); else out.push({ title: g, items: [it] });
  }
  return out;
}

/** Сколько нового с последнего просмотра — число на колокольчике. */
export const unseenCount = (items: Pick<ActivityItem, 'at'>[], seenAt: number) => items.filter((x) => Date.parse(x.at) > seenAt).length;

/** «2 мин», «3 ч», «вчера», «5 дн», «2 нед». */
export function shortAgo(iso: string, now: number): string {
  const m = Math.max(0, Math.round((now - Date.parse(iso)) / 60000));
  if (m < 1) return 'сейчас';
  if (m < 60) return `${m} мин`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h} ч`;
  const d = Math.round(h / 24);
  if (d === 1) return 'вчера';
  return d < 7 ? `${d} дн` : `${Math.round(d / 7)} нед`;
}
