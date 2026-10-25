// Адреса только по-русски (21 октября): часть адресов приходит по-казахски («Әл-Фараби даңғылы», «Абай көшесі»),
// из-за этого одно место выглядело по-разному, а карточки не находили адрес. Приводим к одному русскому виду.
// Тот же код в приложении — src/lib/ruAddress.ts (держать одинаковыми). Другие языки — позже, вместе с переводом приложения.
const KZ: Record<string, string> = { Ә: 'А', ә: 'а', Ғ: 'Г', ғ: 'г', Қ: 'К', қ: 'к', Ң: 'Н', ң: 'н', Ө: 'О', ө: 'о', Ұ: 'У', ұ: 'у', Ү: 'У', ү: 'у', Һ: 'Х', һ: 'х', І: 'И', і: 'и' };
const KNOWN: [RegExp, string][] = [
  [/Әл[-\s]?Фараби/gi, 'аль-Фараби'], [/Ал[-\s]?Фараби/gi, 'аль-Фараби'], [/Әуезов\S*/gi, 'Ауэзова'], [/Бөкейхан\S*/gi, 'Букейханова'],
  [/Абылай\s+хан(?!а)\b/gi, 'Абылай хана'], [/Төле\s+би/gi, 'Толе би'], [/Қабанбай\s+батыр(?!а)\b/gi, 'Кабанбай батыра'], [/Бөгенбай\s+батыр(?!а)\b/gi, 'Богенбай батыра'],
  [/Жібек\s+жолы/gi, 'Жибек Жолы'], [/Сәтбаев\S*/gi, 'Сатпаева'], [/Төлеби/gi, 'Толе би'],
];

export function ruAddress(s: string): string {
  let t = s;
  for (const [re, r] of KNOWN) t = t.replace(re, r);
  t = t
    .replace(/([^,]+?)\s+даңғылы/gi, (_, x: string) => `проспект ${x.trim()}`)
    .replace(/([^,]+?)\s+(көшесі|көш\.?)(?=[\s,]|$)/gi, (_, x: string) => `улица ${x.trim()}`)
    .replace(/([^,]+?)\s+(шағын|ықшам)\s+ауданы/gi, (_, x: string) => `микрорайон ${x.trim()}`)
    .replace(/([^,]+?)\s+тұйығы/gi, (_, x: string) => `переулок ${x.trim()}`)
    .replace(/([^,]+?)\s+алаңы/gi, (_, x: string) => `площадь ${x.trim()}`)
    .replace(/([^,]+?)\s+ауданы/gi, (_, x: string) => `${x.trim()} район`);
  return t.replace(/[ӘәҒғҚқҢңӨөҰұҮүҺһІі]/g, (c) => KZ[c] ?? c);
}

// Единый вид адреса события (26 октября): «улица Тулебаева, 38А», «проспект Достык, 109».
// Тип улицы — полным словом и впереди, без города, этаж и офис — в отдельную заметку («2 этаж»). То же делает база: public.addr_ru.
const TYPES: [RegExp, string][] = [
  [/^(тас жолы|шоссе)$/i, 'шоссе'], [/^(тракт)$/i, 'тракт'], [/^(проспект|просп\.?|пр-т|пр\.?|даңғылы|дангылы)$/i, 'проспект'],
  [/^(микрорайон|мкр\.?|мкрн\.?)$/i, 'микрорайон'], [/^(переулок|пер\.?|тұйығы|тупик)$/i, 'переулок'], [/^(бульвар|б-р)$/i, 'бульвар'],
  [/^(площадь|пл\.?|алаңы)$/i, 'площадь'], [/^(набережная|наб\.?)$/i, 'набережная'], [/^(проезд)$/i, 'проезд'], [/^(аллея)$/i, 'аллея'],
  [/^(улица|ул\.?|көшесі|кошеси|көш\.?|к\.?)$/i, 'улица'],
];
const typeOf = (w: string) => TYPES.find(([re]) => re.test(w))?.[1] ?? null;

/** Казахское имя улицы → русское: фамилии и имена перед ними — в родительном падеже (как public.kz_name_ru в базе). */
export function kzNameRu(name: string): string {
  const w = name.trim().split(/\s+/);
  const n = w.length;
  if (/(ов|ев|ин|ын)$/i.test(w[n - 1])) {
    w[n - 1] += 'а';
    for (let i = 0; i < n - 1; i++) {
      if (/[бвгджзклмнпрстфхцчшщ]$/i.test(w[i])) w[i] += 'а';
      else if (/й$/i.test(w[i])) w[i] = w[i].replace(/й$/i, 'я');
    }
  } else if (n === 1 && /[ае]й$/i.test(w[0])) w[0] = w[0].replace(/й$/i, 'я');
  else if (n === 1 && /[^аеиоуыэюя]ль$/i.test(w[0])) w[0] = w[0].replace(/ь$/i, 'я');
  return w.join(' ');
}

/** Название улицы в одном виде: «ул.Тулебаева» → «улица Тулебаева», «Райымбека проспект» → «проспект Райымбека». */
export function canonStreet(s: string): string {
  const words = ruAddress(s).replace(/[​﻿]/g, '').replace(/(ул|пр|пр-т|просп|мкр|мкрн|пер|пл|наб)\.(?=\S)/gi, '$1. ').split(/\s+/).filter(Boolean);
  let type: string | null = null;
  const rest: string[] = [];
  for (const w of words) {
    const t = typeOf(w);
    if (t && !type) type = t; else rest.push(w);
  }
  const kz = /[әғқңөұүһі]|көшесі|даңғылы|(^|\s)к\.?$/i.test(s);
  const plain = rest.join(' ').replace(/^[,.\s-]+|[,.\s-]+$/g, '');
  const name = kz && plain ? kzNameRu(plain) : plain;
  if (!name) return s.trim();
  if (!type && /^(СТ|ДНТ|ЖК|СНТ|ПК)\s/.test(name)) return name;
  return `${type ?? 'улица'} ${name.charAt(0).toUpperCase()}${name.slice(1)}`;
}

/** Адрес события → { address: «улица Жандосова, 1/1», note: «2 этаж» }. Без дома — как есть, только без города. */
export function canonAddress(raw: string | null | undefined): { address: string | null; note: string | null } {
  if (!raw?.trim()) return { address: raw ?? null, note: null };
  const notes: string[] = [];
  let t = raw.replace(/[​﻿]/g, '')
    .replace(/\(([^)]*)\)/g, (_, x: string) => { notes.push(x.trim()); return ' '; })
    .replace(/,?\s*(г\.?\s*)?(Алматы|Алма-Ата)(\s*,\s*Казахстан)?\s*$/i, '')
    .replace(/^\s*(г\.?\s*)?(Алматы|Алма-Ата)\s*,\s*/i, '');
  t = t.replace(/[,.]?\s*(\d+\s*-?\s*(й\s*)?(этаж|эт\.?)|(офис|оф\.|кв\.|каб\.|кабинет|зал|блок|вход|подъезд)\s*[^,]*)/gi, (m) => { notes.push(m.replace(/^[,.\s]+/, '').trim()); return ''; });
  t = t.replace(/\s+/g, ' ').trim().replace(/[,.\s]+$/, '');
  const m = t.match(/^(.*?)[,\s]+(\d+\s?[а-яa-z]?(?:\s?\/\s?\d+[а-яa-z]?)?(?:\s?к\.?\s?\d+[а-яa-z]?)?)$/i);
  const note = notes.filter(Boolean).join(', ') || null;
  if (!m || !/[а-яa-zәғқңөұүһі]/i.test(m[1])) return { address: ruAddress(t) || null, note };
  // «Джаз-клуб, ул. Жандосова» — площадку отбрасываем: она в venue_name.
  const parts = m[1].split(',').map((x) => x.trim()).filter(Boolean);
  const street = parts.find((p) => /(^|\s)(ул|улица|пр|пр-т|проспект|просп|мкр|микрорайон|пер|переулок|б-р|бульвар|пл|площадь|наб|шоссе|көш|көшесі|даңғылы|к)\.?(\s|$)/i.test(p)) ?? parts[parts.length - 1];
  return { address: `${canonStreet(street)}, ${m[2].replace(/\s+/g, '').replace(/к(\d)/i, ' к$1')}`, note };
}
