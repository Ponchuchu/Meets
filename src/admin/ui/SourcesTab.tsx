// «Источники» (26 октября, с нуля): откуда берутся события — по папкам (Афиши, Площадки, ТЦ, Театры, Походы…).
// У каждой страницы видно, работает ли она: сколько событий дала, сколько сейчас на карте, когда был последний пост, ошибка.
// «Добавить» — вставь ссылку или @ник: Instagram и Threads сначала проверяются (имя, подписчики, последние посты и сколько в них дат),
// потом выбираешь папку и место по умолчанию (для страницы площадки). «Не работают» — одним списком, удалить можно все сразу.
// ИИ-поиска здесь нет: всё собирает скрипт (решение владельца 26 окт.).
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Image } from 'expo-image';
import { AtSign, Camera, ChevronDown, ExternalLink, Globe, PenLine, Plus, Search, Send, Trash2, TriangleAlert, type LucideIcon } from 'lucide-react-native';
import { memo, useMemo, useState } from 'react';
import { Linking, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { colors, fonts } from '../../theme';
import { Toggle } from '../../ui/v6/Settings';
import { addSource, loadSources, parseSourceLink, probeSource, removeSource, socialTokens, updateSource, type Probe } from '../api';
import type { SourceItem } from '../model';
import { useAdminDemo } from '../store';
import { Banner, Btn, Chip, Empty, Sheet, confirmAsk } from './kit';

export const FOLDERS: [string, string][] = [
  ['afisha', 'Афиши и медиа'], ['venue', 'Площадки'], ['mall', 'Торговые центры'], ['theatre', 'Театры'], ['music', 'Музыка и бары'],
  ['standup', 'Стендап'], ['art', 'Музеи и галереи'], ['cinema', 'Кино'], ['hike', 'Походы'], ['sport', 'Спорт'],
  ['community', 'Сообщества и встречи'], ['kids', 'Детям'], ['city', 'Город'], ['other', 'Другое'],
];
const KIND_ICON: Partial<Record<SourceItem['kind'], LucideIcon>> = { instagram: Camera, threads: AtSign, telegram: Send, site: Globe, manual: PenLine };
const KIND_NAME: Partial<Record<SourceItem['kind'], string>> = { instagram: 'Instagram', threads: 'Threads', telegram: 'Telegram', site: 'Сайт', manual: 'Вручную' };

const ago = (iso?: string | null) => {
  if (!iso) return '';
  const h = (Date.now() - Date.parse(iso)) / 3600e3;
  return h < 1 ? 'только что' : h < 24 ? `${Math.round(h)} ч назад` : `${Math.round(h / 24)} дн назад`;
};
const linkOf = (s: SourceItem) => s.kind === 'instagram' ? `https://instagram.com/${s.handle}` : s.kind === 'threads' ? `https://threads.net/@${s.handle}`
  : s.kind === 'telegram' ? `https://t.me/s/${s.handle}` : s.handle ? `https://${s.handle.replace(/^https?:\/\//, '')}` : null;

/** Что с источником: работает / ошибка / ничего не даёт / выключен — и строка для списка. */
export function health(s: SourceItem): { state: 'ok' | 'error' | 'empty' | 'off' | 'new'; line: string } {
  if (!s.enabled) return { state: 'off', line: 'не читается' };
  const st = s.stats ?? {};
  const r = s.report;
  const failing = !!st.error && (!st.ok_at || Date.parse(st.error_at ?? '') > Date.parse(st.ok_at));
  if (failing && !/Лимит/.test(st.error ?? '')) return { state: 'error', line: st.error ?? 'не открылась' };
  if (!st.ok_at && !s.lastRunAt && !r?.total) return { state: 'new', line: 'ещё не читалась — дождись сбора' };
  const parts = [`событий ${r?.total ?? st.events ?? 0}`, r?.live ? `на карте ${r.live}` : '', r?.drafts ? `ждут ${r.drafts}` : '', st.last_post_at ? `пост ${ago(st.last_post_at)}` : ''].filter(Boolean);
  // Две недели читаем, а событий нет — кандидат на удаление.
  const read = st.ok_at ?? s.lastRunAt;
  if (!r?.total && read) return { state: 'empty', line: `${parts.join(' · ')} · ничего не дала` };
  return { state: 'ok', line: parts.join(' · ') };
}

const Mark = ({ s, size = 38 }: { s: SourceItem; size?: number }) => {
  const Icon = KIND_ICON[s.kind] ?? Globe;
  if (s.stats?.avatar) return <Image source={{ uri: s.stats.avatar }} style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: colors.sand }} />;
  return <View style={[styles.mark, { width: size, height: size, borderRadius: size / 2 }]}><Icon size={size * 0.47} color={colors.ink} strokeWidth={1.8} /></View>;
};

const Row = memo(function Row({ s, onOpen, onToggle }: { s: SourceItem; onOpen: (s: SourceItem) => void; onToggle: (s: SourceItem, v: boolean) => void }) {
  const h = health(s);
  return (
    <View style={styles.row}>
      <Pressable onPress={() => onOpen(s)} style={({ pressed }) => [styles.rowMain, pressed && { opacity: 0.6 }]} accessibilityRole="button" accessibilityLabel={`${s.title}: ${h.line}`}>
        <Mark s={s} />
        <View style={{ flex: 1, gap: 2 }}>
          <Text style={styles.title} numberOfLines={1}>{s.title}</Text>
          <Text style={[styles.line, h.state === 'error' && { color: colors.accentText }, h.state === 'empty' && { color: '#9A6B12' }]} numberOfLines={2}>
            {KIND_NAME[s.kind] ?? s.kind}{s.handle && s.kind !== 'site' ? ` · @${s.handle}` : ''} · {h.line}
          </Text>
        </View>
      </Pressable>
      <Toggle on={s.enabled} onChange={(v) => onToggle(s, v)} label={`Собирать: ${s.title}`} />
    </View>
  );
});

export function SourcesTab({ live }: { live: boolean }) {
  const qc = useQueryClient();
  const demo = useAdminDemo();
  const q = useQuery({ queryKey: ['admin', 'sources'], queryFn: loadSources, enabled: live });
  const tokens = useQuery({ queryKey: ['admin', 'social-tokens'], queryFn: socialTokens, enabled: live, staleTime: 3600e3 });
  const list = useMemo(() => (live ? q.data ?? [] : demo.sources).filter((s) => s.kind !== 'search'), [live, q.data, demo.sources]);
  const [find, setFind] = useState('');
  const [onlyBad, setOnlyBad] = useState(false);
  const [open, setOpen] = useState<Record<string, boolean>>({});
  const [openId, setOpenId] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [note, setNote] = useState<{ tone: 'ok' | 'error'; text: string } | null>(null);
  const current = list.find((s) => s.id === openId) ?? null;

  const bad = list.filter((s) => ['error', 'empty'].includes(health(s).state));
  const shown = list.filter((s) => (!onlyBad || bad.includes(s)) && (!find.trim() || `${s.title} ${s.handle ?? ''}`.toLowerCase().includes(find.trim().toLowerCase())));
  const groups = FOLDERS.map(([k, name]) => ({ k, name, items: shown.filter((s) => (s.folder ?? 'other') === k) })).filter((g) => g.items.length);
  const working = list.filter((s) => health(s).state === 'ok').length;

  const change = useMutation({
    mutationFn: async ({ s, patch }: { s: SourceItem; patch: Partial<SourceItem> }) => {
      if (!live) return demo.setSource(s.id, patch);
      await updateSource(s.id, { trusted: patch.trusted, enabled: patch.enabled, title: patch.title, folder: patch.folder, venue_name: patch.venueName,
        auto_publish: patch.autoPublish ?? (patch.trusted === false ? false : undefined) });
    },
    // Строка меняется сразу, сохранение — в фоне; ошибка — откат и плашка.
    onMutate: ({ s, patch }) => { if (live) qc.setQueryData<SourceItem[]>(['admin', 'sources'], (old) => old?.map((x) => (x.id === s.id ? { ...x, ...patch } : x))); },
    onError: (_e, { s }) => {
      if (live) qc.setQueryData<SourceItem[]>(['admin', 'sources'], (old) => old?.map((x) => (x.id === s.id ? s : x)));
      setNote({ tone: 'error', text: 'Не удалось сохранить. Проверь связь' });
    },
  });
  const toggle = (s: SourceItem, v: boolean) => change.mutate({ s, patch: { enabled: v } });
  const setFolderOn = (k: string, v: boolean) => list.filter((s) => (s.folder ?? 'other') === k && s.enabled !== v).forEach((s) => toggle(s, v));

  const remove = async (items: SourceItem[]) => {
    const ok = await confirmAsk(items.length > 1 ? `Удалить ${items.length} источников?` : 'Удалить источник?', 'Они больше не будут читаться. Уже найденные события останутся на карте.', 'Удалить');
    if (!ok) return;
    try {
      for (const s of items) { if (live) await removeSource(s.id); else demo.removeSource(s.id); }
      setOpenId(null); setOnlyBad(false);
      setNote({ tone: 'ok', text: items.length > 1 ? `Удалено: ${items.length}` : 'Источник удалён' });
      void qc.invalidateQueries({ queryKey: ['admin', 'sources'] });
    } catch { setNote({ tone: 'error', text: 'Не удалось удалить. Проверь связь' }); }
  };

  const ig = tokens.data?.instagram;
  // Дни до конца токена — от времени ответа (не от «сейчас» при каждой отрисовке).
  const days = ig?.expires_at ? Math.round((Date.parse(ig.expires_at) - tokens.dataUpdatedAt) / 86400e3) : null;
  return (
    <View style={{ gap: 12 }}>
      {live && tokens.data && (!ig?.ok ? <Banner tone="error" title="Instagram не подключён" hint={`${ig?.error ?? 'Нет ключа'}. Новый токен — docs/KEYS.md, раздел Instagram`} />
        : days != null && days < 14 ? <Banner tone="warn" title={`Токен Instagram закончится через ${days} дн`} hint="Обнови IG_TOKEN в секретах Supabase — инструкция в docs/KEYS.md" /> : null)}
      <View style={styles.summary}>
        <Text style={styles.sumN}>{list.length}</Text><Text style={styles.sumL}>источников</Text>
        <Text style={[styles.sumN, { color: colors.ok }]}>{working}</Text><Text style={styles.sumL}>дают события</Text>
        {bad.length > 0 && <><Text style={[styles.sumN, { color: colors.accentText }]}>{bad.length}</Text><Text style={styles.sumL}>не работают</Text></>}
      </View>
      {ig?.ok && days != null && <Text style={styles.help}>Instagram подключён · токен ещё {days} дн{tokens.data?.threads.ok ? ' · Threads подключён' : ' · Threads: нужен ключ (docs/KEYS.md)'}</Text>}

      <View style={styles.searchBox}>
        <Search size={18} color={colors.muted} strokeWidth={1.9} />
        <TextInput value={find} onChangeText={setFind} placeholder="Найти источник" placeholderTextColor={colors.muted3} style={styles.searchInput} accessibilityLabel="Найти источник" autoCapitalize="none" />
      </View>
      <View style={styles.chips}>
        <Chip label="Все" on={!onlyBad} onPress={() => setOnlyBad(false)} />
        <Chip label="Не работают" count={bad.length} on={onlyBad} onPress={() => setOnlyBad(true)} />
      </View>
      {onlyBad && bad.length > 0 && <Btn label={`Удалить все неработающие (${bad.length})`} kind="ghost" onPress={() => void remove(bad)} />}

      {live && q.isLoading ? <Empty loading title="Загружаю источники…" />
        : live && q.isError ? <Empty tone="error" title="Источники не загрузились" text="Проверь связь." action={{ label: 'Повторить', onPress: () => void q.refetch() }} />
          : !groups.length ? <Empty title={onlyBad ? 'Все источники работают' : 'Ничего не нашлось'} />
            : groups.map((g) => {
              const isOpen = open[g.k] ?? (onlyBad || !!find.trim());
              const on = g.items.filter((s) => s.enabled).length;
              const live2 = g.items.reduce((n, s) => n + (s.report?.live ?? 0), 0);
              return (
                <View key={g.k} style={styles.box}>
                  <Pressable onPress={() => setOpen((o) => ({ ...o, [g.k]: !isOpen }))} style={styles.folder} accessibilityRole="button" accessibilityState={{ expanded: isOpen }}>
                    <View style={{ flex: 1, gap: 2 }}>
                      <Text style={styles.folderName}>{g.name}</Text>
                      <Text style={styles.line}>{g.items.length} · читаются {on}{live2 ? ` · на карте ${live2}` : ''}</Text>
                    </View>
                    <Toggle on={on > 0} onChange={(v) => setFolderOn(g.k, v)} label={`Собирать всю папку: ${g.name}`} />
                    <ChevronDown size={20} color={colors.ink} strokeWidth={2} style={{ transform: [{ rotate: isOpen ? '180deg' : '0deg' }] }} />
                  </Pressable>
                  {isOpen && g.items.map((s) => <Row key={s.id} s={s} onOpen={(x) => setOpenId(x.id)} onToggle={toggle} />)}
                </View>
              );
            })}

      {note && <Banner tone={note.tone} text={note.text} />}
      <Pressable onPress={() => { setNote(null); setAdding(true); }} style={({ pressed }) => [styles.addBtn, pressed && { opacity: 0.85 }]} accessibilityRole="button">
        <Plus size={18} color={colors.paper} strokeWidth={2} /><Text style={styles.addText}>Добавить источник</Text>
      </Pressable>
      <Text style={styles.help}>Как это работает: при каждом сборе скрипт читает новые посты включённых источников, находит в них дату, время, место и цену, склеивает дубли (одно событие из разных страниц — одна карточка, повторы спектакля — даты одной карточки) и копирует фото и видео. Источники «с доверием» публикуются сразу, если всё понятно; остальное ждёт во вкладке «Проверка».</Text>

      {current && <Details s={current} onClose={() => setOpenId(null)} onChange={(patch) => change.mutate({ s: current, patch })} onRemove={() => void remove([current])} />}
      {adding && <AddSheet live={live} onClose={() => setAdding(false)} onAdded={(t) => { setAdding(false); setNote({ tone: 'ok', text: `Добавлен: ${t}. Начнёт читаться при следующем сборе` }); }} />}
    </View>
  );
}

function FolderPick({ value, onChange }: { value: string; onChange: (k: string) => void }) {
  return <View style={styles.chips}>{FOLDERS.map(([k, n]) => <Chip key={k} label={n} on={value === k} onPress={() => onChange(k)} />)}</View>;
}

function Details({ s, onClose, onChange, onRemove }: { s: SourceItem; onClose: () => void; onChange: (p: Partial<SourceItem>) => void; onRemove: () => void }) {
  const [title, setTitle] = useState(s.title);
  const [venue, setVenue] = useState(s.venueName ?? '');
  const h = health(s);
  const url = linkOf(s);
  const r = s.report;
  return (
    <Sheet title={s.title} onClose={onClose}>
      <View style={styles.headRow}>
        <Mark s={s} size={52} />
        <View style={{ flex: 1, gap: 2 }}>
          <Text style={styles.title}>{KIND_NAME[s.kind] ?? s.kind}{s.handle ? ` · ${s.kind === 'site' ? s.handle : `@${s.handle}`}` : ''}</Text>
          {s.stats?.followers != null && <Text style={styles.line}>{s.stats.followers.toLocaleString('ru-RU')} подписчиков</Text>}
          <Text style={[styles.line, h.state === 'error' && { color: colors.accentText }]}>{h.line}</Text>
        </View>
      </View>
      {r && (
        <View style={styles.statsRow}>
          {[[r.total, 'всего'], [r.live, 'на карте'], [r.drafts, 'ждут'], [r.week, 'за неделю']].map(([n, l]) => (
            <View key={String(l)} style={styles.stat}><Text style={styles.statN}>{n}</Text><Text style={styles.statL}>{l}</Text></View>
          ))}
        </View>
      )}
      {s.stats?.ok_at && <Text style={styles.help}>Последний сбор {ago(s.stats.ok_at)}: постов {s.stats.posts ?? 0}, событий {s.stats.events ?? 0}, дублей {s.stats.dups ?? 0}, не события {s.stats.junk ?? 0}</Text>}
      {url && <Pressable onPress={() => void Linking.openURL(url)} style={styles.link} accessibilityRole="link"><ExternalLink size={16} color={colors.ink} strokeWidth={2} /><Text style={styles.title}>Открыть страницу</Text></Pressable>}

      <Text style={styles.label}>Название</Text>
      <TextInput value={title} onChangeText={setTitle} onEndEditing={() => title.trim() && title.trim() !== s.title && onChange({ title: title.trim() })} style={styles.input} accessibilityLabel="Название источника" />
      <Text style={styles.label}>Папка</Text>
      <FolderPick value={s.folder ?? 'other'} onChange={(folder) => onChange({ folder })} />
      <Text style={styles.label}>Место по умолчанию</Text>
      <TextInput value={venue} onChangeText={setVenue} onEndEditing={() => venue.trim() !== (s.venueName ?? '') && onChange({ venueName: venue.trim() || null })} placeholder="Для страницы площадки: «Almaty Arena»" placeholderTextColor={colors.muted3} style={styles.input} accessibilityLabel="Место по умолчанию" />
      <Text style={styles.help}>Страница театра, клуба или ТЦ почти никогда не пишет свой адрес — события от неё ставим сюда, если в посте другого места нет.</Text>

      <View style={styles.box}>
        <View style={styles.row}><View style={{ flex: 1 }}><Text style={styles.title}>Собирать</Text><Text style={styles.line}>Читать при каждом сборе</Text></View><Toggle on={s.enabled} onChange={(v) => onChange({ enabled: v })} label="Собирать" /></View>
        <View style={styles.row}><View style={{ flex: 1 }}><Text style={styles.title}>Публиковать сразу</Text><Text style={styles.line}>Если в посте понятны дата, время и место — сразу на карту, без проверки</Text></View>
          <Toggle on={s.trusted && s.autoPublish} onChange={(v) => onChange({ trusted: v, autoPublish: v })} label="Публиковать сразу" /></View>
      </View>
      <Pressable onPress={onRemove} style={({ pressed }) => [styles.del, pressed && { opacity: 0.7 }]} accessibilityRole="button">
        <Trash2 size={18} color={colors.accentText} strokeWidth={1.8} /><Text style={styles.delText}>Удалить источник</Text>
      </Pressable>
    </Sheet>
  );
}

const DATE_HINT = /\d{1,2}\s*(январ|феврал|март|апрел|ма[яй]|июн|июл|август|сентябр|октябр|ноябр|декабр|қаңтар|ақпан|наурыз|сәуір|мамыр|маусым|шілде|тамыз|қыркүйек|қазан|қараша|желтоқсан)|\d{1,2}:\d{2}/i;

function AddSheet({ live, onClose, onAdded }: { live: boolean; onClose: () => void; onAdded: (title: string) => void }) {
  const qc = useQueryClient();
  const demo = useAdminDemo();
  const [link, setLink] = useState('');
  const [folder, setFolder] = useState('afisha');
  const [venue, setVenue] = useState('');
  const [name, setName] = useState('');
  const [probe, setProbe] = useState<Probe | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const parsed = link.trim() ? parseSourceLink(link) : null;
  const social = parsed?.kind === 'instagram' || parsed?.kind === 'threads';
  const dated = probe?.posts?.filter((p) => DATE_HINT.test(p.text)).length ?? 0;

  const check = async () => {
    if (!parsed) return setError('Не похоже на ссылку. Примеры: instagram.com/almatyarena, @almatyarena, t.me/afisha_almaty, sxodim.com/almaty');
    if (!social || !live) return;
    setBusy(true); setError(null); setProbe(null);
    try {
      const r = await probeSource(parsed.kind as 'instagram' | 'threads', parsed.handle);
      setProbe(r);
      if (!r.ok) setError(r.error ?? 'Страница не открылась');
      else if (!name) setName(r.profile?.name?.slice(0, 60) ?? '');
    } catch { setError('Проверка не прошла. Проверь связь'); }
    setBusy(false);
  };
  const add = async () => {
    if (!parsed) return setError('Вставь ссылку или @ник');
    setBusy(true); setError(null);
    const title = name.trim() || probe?.profile?.name || parsed.title;
    try {
      if (live) { await addSource(link, title, { folder, venueName: venue }); void qc.invalidateQueries({ queryKey: ['admin', 'sources'] }); }
      else demo.addSource({ id: `s-${Date.now()}`, kind: parsed.kind, handle: parsed.handle, title, note: null, trusted: false, autoPublish: false, enabled: true, folder, venueName: venue || null });
      onAdded(title);
    } catch { setError('Не получилось добавить: такой источник уже есть или нет связи'); }
    setBusy(false);
  };

  return (
    <Sheet title="Новый источник" onClose={onClose}>
      <Text style={styles.label}>Ссылка или @ник</Text>
      <TextInput value={link} onChangeText={(v) => { setLink(v); setProbe(null); setError(null); }} onSubmitEditing={() => void check()} autoFocus autoCapitalize="none" autoCorrect={false}
        keyboardType="url" placeholder="instagram.com/almatyarena или @ник" placeholderTextColor={colors.muted3} style={styles.input} accessibilityLabel="Ссылка или ник" />
      {parsed && <Text style={styles.help}>{KIND_NAME[parsed.kind]} · {parsed.kind === 'site' ? parsed.handle : `@${parsed.handle}`}{parsed.kind === 'instagram' ? ' (Telegram — ссылкой t.me/…)' : ''}</Text>}
      {social && live && !probe && <Btn label={busy ? 'Проверяю…' : 'Проверить страницу'} kind="ghost" disabled={busy} onPress={() => void check()} />}
      {probe?.ok && (
        <View style={styles.probe}>
          <View style={styles.headRow}>
            {probe.profile?.avatar ? <Image source={{ uri: probe.profile.avatar }} style={{ width: 44, height: 44, borderRadius: 22 }} /> : null}
            <View style={{ flex: 1 }}>
              <Text style={styles.title} numberOfLines={1}>{probe.profile?.name ?? parsed?.handle}</Text>
              <Text style={styles.line}>{probe.profile?.followers?.toLocaleString('ru-RU') ?? '—'} подписчиков · постов {probe.profile?.posts ?? '—'}</Text>
            </View>
          </View>
          <Text style={[styles.line, { color: dated >= 4 ? colors.ok : '#9A6B12' }]}>В {dated} из {probe.posts?.length ?? 0} последних постов есть дата или время{dated < 4 ? ' — событий может быть мало' : ' — подходит'}</Text>
          <View style={styles.thumbs}>
            {(probe.posts ?? []).slice(0, 6).map((p) => { const m = p.media.find((x) => x.type === 'image') ?? p.media[0]; const u = m?.type === 'image' ? m.url : m?.poster; return u ? <Image key={p.id} source={{ uri: u }} style={styles.thumb} /> : null; })}
          </View>
        </View>
      )}
      {probe && !probe.ok && <View style={styles.headRow}><TriangleAlert size={18} color={colors.accentText} strokeWidth={2} /><Text style={[styles.line, { color: colors.accentText, flex: 1 }]}>{probe.error}</Text></View>}
      <Text style={styles.label}>Папка</Text>
      <FolderPick value={folder} onChange={setFolder} />
      <Text style={styles.label}>Название (можно не менять)</Text>
      <TextInput value={name} onChangeText={setName} placeholder={parsed?.title ?? 'Появится из ссылки'} placeholderTextColor={colors.muted3} style={styles.input} accessibilityLabel="Название источника" />
      {['venue', 'mall', 'theatre', 'music', 'standup', 'art', 'cinema'].includes(folder) && (
        <>
          <Text style={styles.label}>Место по умолчанию</Text>
          <TextInput value={venue} onChangeText={setVenue} placeholder="Например: Almaty Arena" placeholderTextColor={colors.muted3} style={styles.input} accessibilityLabel="Место по умолчанию" />
        </>
      )}
      {error && !probe && <Banner tone="error" text={error} />}
      <Btn label={busy ? 'Сохраняю…' : 'Добавить'} onPress={() => void add()} disabled={busy || !parsed || (probe != null && !probe.ok)} />
    </Sheet>
  );
}

const styles = StyleSheet.create({
  summary: { flexDirection: 'row', alignItems: 'baseline', flexWrap: 'wrap', columnGap: 6, rowGap: 2 },
  sumN: { fontFamily: fonts.display800, fontSize: 24, color: colors.ink },
  sumL: { fontFamily: fonts.body500, fontSize: 13.5, color: colors.muted, marginRight: 10 },
  searchBox: { flexDirection: 'row', alignItems: 'center', gap: 8, minHeight: 46, borderRadius: 14, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.line, paddingHorizontal: 12 },
  searchInput: { flex: 1, fontFamily: fonts.body500, fontSize: 15, color: colors.ink, minHeight: 44 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  box: { backgroundColor: colors.card, borderRadius: 18, borderWidth: 1, borderColor: colors.line, overflow: 'hidden' },
  folder: { flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: 60, paddingHorizontal: 14, paddingVertical: 8 },
  folderName: { fontFamily: fonts.display700, fontSize: 16, color: colors.ink },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 14, minHeight: 64, paddingVertical: 8, borderTopWidth: 1, borderTopColor: colors.line },
  rowMain: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 48 },
  mark: { backgroundColor: colors.sand, alignItems: 'center', justifyContent: 'center' },
  headRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  title: { fontFamily: fonts.body700, fontSize: 15, color: colors.ink },
  line: { flexShrink: 1, fontFamily: fonts.body400, fontSize: 13, lineHeight: 17, color: colors.muted },
  help: { fontFamily: fonts.body400, fontSize: 13, lineHeight: 18, color: colors.muted },
  label: { fontFamily: fonts.body600, fontSize: 13, color: colors.muted2 },
  input: { minHeight: 48, borderRadius: 14, borderWidth: 1, borderColor: colors.line2, backgroundColor: colors.card, paddingHorizontal: 14, fontFamily: fonts.body500, fontSize: 15, color: colors.ink },
  statsRow: { flexDirection: 'row', gap: 8 },
  stat: { flex: 1, borderRadius: 14, backgroundColor: colors.card, paddingVertical: 10, alignItems: 'center' },
  statN: { fontFamily: fonts.display800, fontSize: 20, color: colors.ink },
  statL: { fontFamily: fonts.body500, fontSize: 12, color: colors.muted },
  link: { flexDirection: 'row', alignItems: 'center', gap: 8, minHeight: 44 },
  probe: { gap: 10, padding: 12, borderRadius: 16, backgroundColor: colors.card },
  thumbs: { flexDirection: 'row', gap: 6 },
  thumb: { flex: 1, aspectRatio: 1, borderRadius: 10, backgroundColor: colors.sand },
  addBtn: { minHeight: 50, borderRadius: 14, backgroundColor: colors.ink, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  addText: { fontFamily: fonts.body700, fontSize: 15, color: colors.paper },
  del: { minHeight: 48, borderRadius: 14, borderWidth: 1, borderColor: colors.line2, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, marginTop: 4 },
  delText: { fontFamily: fonts.body700, fontSize: 15, color: colors.accentText },
});

/** Для «Сводки»: какие источники сейчас дают больше всего событий на карте и сколько не работают. */
export function SourcesTop({ live, onOpen }: { live: boolean; onOpen: () => void }) {
  const q = useQuery({ queryKey: ['admin', 'sources'], queryFn: loadSources, enabled: live });
  const list = q.data ?? [];
  if (!live || !list.length) return null;
  const top = [...list].filter((s) => (s.report?.live ?? 0) > 0).sort((a, b) => (b.report?.live ?? 0) - (a.report?.live ?? 0)).slice(0, 8);
  const bad = list.filter((s) => ['error', 'empty'].includes(health(s).state)).length;
  const total = list.reduce((n, s) => n + (s.report?.live ?? 0), 0);
  return (
    <Pressable onPress={onOpen} style={({ pressed }) => [styles.box, { padding: 14, gap: 8 }, pressed && { opacity: 0.85 }]} accessibilityRole="button">
      <Text style={styles.folderName}>Источники: на карте {total} событий</Text>
      {top.map((s) => (
        <View key={s.id} style={{ flexDirection: 'row', gap: 8 }}>
          <Text style={[styles.line, { flex: 1 }]} numberOfLines={1}>{s.title}</Text>
          <Text style={[styles.line, { color: colors.ink }]}>{s.report?.live}</Text>
        </View>
      ))}
      {bad > 0 && <Text style={[styles.line, { color: colors.accentText }]}>Не работают: {bad} — открой «Источники»</Text>}
    </Pressable>
  );
}
