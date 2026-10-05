// Балл пробок Алматы (FIX1 И2 п.13): раз в 10 минут (pg_cron) берём TomTom Flow Segment Data в ~15 точках главных улиц.
// Балл = round(10 × (1 − средняя(текущая / свободная скорость))), от 1 до 10. Пишем в traffic_score (одна строка).
// Ключ — секрет TomTom_KEY. Вызов — только по секрету расписания.
import { admin, isServiceCall, json, preflight } from '../_shared/supabase.ts';

// Точки на проспектах (центр полосы), имя — для «до Абая 25 мин» в приложении.
const POINTS: { name: string; lat: number; lon: number }[] = [
  { name: 'Аль-Фараби', lat: 43.2186, lon: 76.9030 }, { name: 'Аль-Фараби', lat: 43.2087, lon: 76.9500 },
  { name: 'Абая', lat: 43.2399, lon: 76.8770 }, { name: 'Абая', lat: 43.2420, lon: 76.9300 },
  { name: 'Райымбека', lat: 43.2716, lon: 76.8800 }, { name: 'Райымбека', lat: 43.2690, lon: 76.9450 },
  { name: 'Толе би', lat: 43.2530, lon: 76.8650 }, { name: 'Толе би', lat: 43.2555, lon: 76.9200 },
  { name: 'Сейфуллина', lat: 43.2480, lon: 76.9365 }, { name: 'Сейфуллина', lat: 43.2700, lon: 76.9330 },
  { name: 'Достык', lat: 43.2450, lon: 76.9575 }, { name: 'Достык', lat: 43.2250, lon: 76.9585 },
  { name: 'Розыбакиева', lat: 43.2300, lon: 76.8880 }, { name: 'Назарбаева', lat: 43.2560, lon: 76.9455 },
  { name: 'ВОАД', lat: 43.1980, lon: 76.8550 },
];

export function scoreOf(ratios: number[]): number {
  if (!ratios.length) return 1;
  const avg = ratios.reduce((a, b) => a + b, 0) / ratios.length;
  return Math.min(10, Math.max(1, Math.round(10 * (1 - avg))));
}

Deno.serve(async (req) => {
  const pre = preflight(req);
  if (pre) return pre;
  if (!isServiceCall(req)) return json({ error: 'cron-only' }, 403);
  const key = Deno.env.get('TomTom_KEY') ?? Deno.env.get('TOMTOM_KEY');
  if (!key) return json({ error: 'no TomTom_KEY' }, 500);
  const res = await Promise.all(POINTS.map(async (p) => {
    const r = await fetch(`https://api.tomtom.com/traffic/services/4/flowSegmentData/absolute/10/json?point=${p.lat},${p.lon}&unit=KMPH&key=${key}`).catch(() => null);
    const d = r?.ok ? (await r.json())?.flowSegmentData : null;
    if (!d?.freeFlowSpeed) return null;
    return { ...p, ratio: Math.min(1, d.currentSpeed / d.freeFlowSpeed), speed: d.currentSpeed };
  }));
  const ok = res.filter((x): x is NonNullable<typeof x> => !!x);
  if (!ok.length) return json({ error: 'no data' }, 502);
  const score = scoreOf(ok.map((x) => x.ratio));
  const ratio = ok.reduce((a, b) => a + b.ratio, 0) / ok.length;
  const db = admin();
  await db.from('traffic_score').upsert({ id: 1, score, ratio, points: ok, at: new Date().toISOString() });
  return json({ score, ratio, n: ok.length });
});
