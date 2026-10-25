// Кто выступает (26 октября, просьба владельца): у концерта или стендапа в тексте афиши часто нет имён — «будет живая музыка».
// Для таких карточек Kimi ищет официальную страницу события в интернете и называет состав. Ответу ИИ на слово не верим:
// имя попадает в карточку, только если оно действительно написано на найденной странице. Потом редактор описаний
// вплетает состав в текст (polish.ts, строка «Состав из интернета»).
import { SHOW_CATEGORIES } from './polish.ts';
import { almatyDate, kimiSearch, type Found } from './search.ts';

const UA = { 'User-Agent': 'Mozilla/5.0 (compatible; ryadom-worker/0.2; +https://ryadom.app)', 'Accept-Language': 'ru' };
const isUrl = (u: unknown): u is string => typeof u === 'string' && /^https?:\/\/\S+$/.test(u);

/** Нужен ли поиск состава: раздел «со сценой», а имён редактор не нашёл. */
export const needsLineup = (f: Found): boolean => SHOW_CATEGORIES.has(f.category) && !f.performers?.length && !f.lineup?.length;

/** Текст страницы без тегов — для проверки, что имя там правда есть. */
export function pageText(html: string): string {
  return html.replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>/gi, ' ').replace(/<[^>]+>/g, ' ').replace(/&nbsp;|&#160;/g, ' ').replace(/\s+/g, ' ').toLowerCase();
}

/** Имена, которые действительно есть на странице (по фамилии или названию группы целиком). */
export function confirmed(names: string[], text: string): string[] {
  return names.filter((n) => {
    const words = n.toLowerCase().split(/\s+/).filter((w) => w.length >= 3);
    return words.length > 0 && (text.includes(n.toLowerCase()) || words.some((w) => w.length >= 5 && text.includes(w)));
  });
}

/** До max карточек: спросить Kimi, проверить по странице, записать в f.lineup. Возвращает, сколько нашлось. */
export async function findLineups(list: Found[], key: string, model: string, max: number): Promise<number> {
  let filled = 0;
  for (const f of list.filter(needsLineup).slice(0, max)) {
    try {
      const day = f.starts_at ? almatyDate(new Date(f.starts_at)) : '';
      const { text } = await kimiSearch(`Кто выступает на событии «${f.title}» (${day}, ${f.venue_name ?? 'Алматы'}, Алматы)? Найди официальную страницу или афишу этого события.
Верни только JSON {"performers":["имя артиста, группы, комика или лектора"],"page":"ссылка на страницу, где это написано"}. Не нашёл точно — {"performers":[],"page":null}. Ничего не выдумывай.`, key, model, 1);
      const hit = JSON.parse(text.slice(text.indexOf('{'), text.lastIndexOf('}') + 1)) as { performers?: unknown; page?: unknown };
      const names = Array.isArray(hit.performers) ? hit.performers.filter((x): x is string => typeof x === 'string' && x.trim().length > 1 && x.length < 80).map((x) => x.trim()) : [];
      if (!names.length || !isUrl(hit.page)) continue;
      const res = await fetch(hit.page, { headers: UA, redirect: 'follow', signal: AbortSignal.timeout(12_000) });
      if (!res.ok) continue;
      const ok = confirmed(names, pageText((await res.text()).slice(0, 1_500_000)));
      if (ok.length) { f.lineup = ok.slice(0, 12); filled++; console.error(`  состав найден: ${f.title.slice(0, 40)} — ${ok.slice(0, 3).join(', ')}`); }
    } catch (err) { console.error(`  ✕ состав для «${f.title.slice(0, 30)}»: ${(err as Error).message.slice(0, 120)}`); }
  }
  return filled;
}
