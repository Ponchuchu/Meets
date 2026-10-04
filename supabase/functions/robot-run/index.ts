// «Искать сейчас» и «Стоп» в панели разработчика (V6 §10.2). Только staff.
// POST { action: 'start', topics?: string[], days?: number, limit?: number, model?: string } → { run_id }
// POST { action: 'stop', run_id }  → { ok }
// Из robot-tick (CRON_SECRET): { action: 'start', task: 'search' | 'covers', scheduled: true }
import { dispatch } from '../_shared/github.ts';
import { admin, isServiceCall, json, userFrom } from '../_shared/supabase.ts';

Deno.serve(async (req) => {
  const db = admin();
  const service = isServiceCall(req);
  const me = service ? null : await userFrom(req, db);
  if (!service) {
    if (!me) return json({ error: 'auth' }, 401);
    const { data: staff } = await db.from('staff').select('user_id').eq('user_id', me).maybeSingle();
    if (!staff) return json({ error: 'forbidden' }, 403);
  }
  const body = await req.json().catch(() => ({})) as { action?: string; run_id?: string; task?: string; topics?: string[]; days?: number; limit?: number; model?: string; scheduled?: boolean };

  if (body.action === 'stop' && body.run_id) {
    await db.from('robot_runs').update({ cancel: true }).eq('id', body.run_id);
    await db.from('robot_log').insert({ run_id: body.run_id, level: 'warn', text: 'стоп — закончу текущую тему и остановлюсь' });
    return json({ ok: true });
  }

  const task = body.task === 'covers' ? 'covers' : 'search';
  const params = { task, topics: body.topics ?? [], days: body.days ?? 7, limit: body.limit ?? 40, model: body.model ?? 'flash', scheduled: !!body.scheduled };
  const { data: run, error } = await db.from('robot_runs').insert({ params, status: 'queued', started_by: me }).select('id').single();
  if (error || !run) return json({ error: error?.message ?? 'insert' }, 500);
  await db.from('robot_log').insert({ run_id: run.id, text: `${body.scheduled ? 'по расписанию' : 'вручную'} · ${task === 'search' ? 'поиск событий' : 'обложки ИИ'} · жду GitHub Actions` });
  const err = await dispatch(task === 'search' ? 'search.yml' : 'covers.yml', {
    run_id: run.id, topics: params.topics.join(','), days: String(params.days), limit: String(params.limit), model: params.model,
  });
  if (err) {
    await db.from('robot_runs').update({ status: 'failed', finished_at: new Date().toISOString() }).eq('id', run.id);
    await db.from('robot_log').insert({ run_id: run.id, level: 'error', text: err });
    return json({ run_id: run.id, error: err }, 502);
  }
  return json({ run_id: run.id });
});
