// Расписание робота (V6 §10.3): pg_cron раз в 5 минут → смотрим robot_schedule и паузу → robot-run.
// Время — по Алматы (UTC+5). Запускаем, если «пора» наступила за последние 5 минут и сегодня ещё не запускали.
import { admin, isServiceCall, json } from '../_shared/supabase.ts';

const ALMATY = 5 * 3600e3;

Deno.serve(async (req) => {
  if (!isServiceCall(req)) return json({ error: 'forbidden' }, 403);
  const db = admin();
  const { data: flags } = await db.from('app_flags').select('key,value').in('key', ['robot_paused', 'covers_paused']);
  const paused = (k: string) => flags?.find((f) => f.key === k)?.value === true;
  const { data: rows } = await db.from('robot_schedule').select('*');
  const now = new Date();
  const local = new Date(now.getTime() + ALMATY);
  const started: string[] = [];
  for (const s of rows ?? []) {
    if (s.paused || paused(s.task === 'search' ? 'robot_paused' : 'covers_paused')) continue;
    const last = s.last_run_at ? new Date(s.last_run_at).getTime() : 0;
    let due = false;
    if (s.repeat === 'hours' && s.every_hours) due = now.getTime() - last >= s.every_hours * 3600e3;
    else {
      const [hh, mm] = String(s.time).split(':').map(Number);
      const today = Date.UTC(local.getUTCFullYear(), local.getUTCMonth(), local.getUTCDate(), hh, mm) - ALMATY;
      const dayOk = (s.days ?? []).includes(local.getUTCDay());
      due = dayOk && now.getTime() >= today && now.getTime() - today < 5 * 60e3 && last < today;
    }
    if (!due) continue;
    await db.from('robot_schedule').update({ last_run_at: now.toISOString() }).eq('task', s.task);
    await fetch(`${Deno.env.get('SUPABASE_URL')}/functions/v1/robot-run`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-cron-secret': Deno.env.get('CRON_SECRET') ?? '' },
      body: JSON.stringify({ action: 'start', task: s.task, scheduled: true }),
    });
    started.push(s.task);
  }
  return json({ ok: true, started });
});
