// Балл пробок Алматы (FIX1 И2 п.13): раз в 10 минут (pg_cron) берём TomTom Flow Segment Data в ~15 точках главных улиц.
// Балл — по худшим двум третям точек (scoreOf), от 1 до 10; без ответа TomTom — оценка по часам (typicalScore). Пишем в traffic_score (одна строка).
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

/** Балл 1–10 как у навигаторов: пробка обычно местная, поэтому смотрим худшие две трети точек, а не среднее по всем
 *  (среднее «растворяло» час пик до 1–2 баллов). Половина свободной скорости на главных улицах — уже 8–9 баллов. */
export function scoreOf(ratios: number[]): number {
  if (!ratios.length) return 1;
  const worst = [...ratios].sort((a, b) => a - b).slice(0, Math.max(1, Math.ceil(ratios.length * 2 / 3)));
  const jam = 1 - worst.reduce((a, b) => a + b, 0) / worst.length;
  return Math.min(10, Math.max(1, Math.round(1 + 9 * Math.min(1, jam / 0.55))));
}

/** Запасная оценка, если сервис пробок не ответил: обычный будний / выходной день Алматы по часам. */
export function typicalScore(at: Date): number {
  const local = new Date(at.getTime() + 5 * 3600e3);
  const h = local.getUTCHours() + local.getUTCMinutes() / 60, day = local.getUTCDay();
  const weekend = day === 0 || day === 6;
  const peak = (c: number, w: number, top: number) => top * Math.exp(-((h - c) ** 2) / (2 * w * w));
  const v = weekend ? 1 + peak(14, 3, 3) + peak(19, 2, 2) : 1 + peak(8.7, 1, 6) + peak(13, 1.5, 2) + peak(18.4, 1.3, 7);
  return Math.min(10, Math.max(1, Math.round(v)));
}

// По одной точке на проспект — для «до Абая 25 мин» этого хватает.
const SAMPLE = POINTS.filter((p, i) => POINTS.findIndex(q => q.name === p.name) === i).slice(0, 8);

Deno.serve(async (req) => {
  const pre = preflight(req);
  if (pre) return pre;
  if (!isServiceCall(req)) return json({ error: 'cron-only' }, 403);
  const key = Deno.env.get('TomTom_KEY') ?? Deno.env.get('TOMTOM_KEY');
  if (!key) return json({ error: 'no TomTom_KEY' }, 500);
  // Квота TomTom общая с плитками пробок на карте, поэтому опрашиваем 8 точек (по одной на проспект), а не 15.
  const statuses: number[] = [];
  const res = await Promise.all(SAMPLE.map(async (p) => {
    const r = await fetch(`https://api.tomtom.com/traffic/services/4/flowSegmentData/absolute/10/json?point=${p.lat},${p.lon}&unit=KMPH&key=${key}`).catch(() => null);
    statuses.push(r?.status ?? 0);
    const d = r?.ok ? (await r.json())?.flowSegmentData : null;
    if (!d?.freeFlowSpeed) return null;
    return { ...p, ratio: Math.min(1, d.currentSpeed / d.freeFlowSpeed), speed: d.currentSpeed };
  }));
  const ok = res.filter((x): x is NonNullable<typeof x> => !!x);
  const db = admin();
  const now = new Date();
  if (!ok.length) {
    // Сервис не ответил (лимит, сеть) — пишем оценку по времени суток с пустым списком точек: приложение покажет «примерно».
    const est = typicalScore(now);
    await db.from('traffic_score').upsert({ id: 1, score: est, ratio: 1 - (est - 1) / 9 * 0.55, points: [], at: now.toISOString() });
    return json({ score: est, estimated: true, statuses }, 200);
  }
  const score = scoreOf(ok.map((x) => x.ratio));
  const ratio = ok.reduce((a, b) => a + b.ratio, 0) / ok.length;
  await db.from('traffic_score').upsert({ id: 1, score, ratio, points: ok, at: now.toISOString() });
  return json({ score, ratio, n: ok.length });
});
