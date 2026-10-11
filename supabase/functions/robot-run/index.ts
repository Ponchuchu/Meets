// «Искать сейчас» и «Стоп» в панели разработчика (V6 §10.2). Только staff.
// POST { action: 'start', topics?: string[], days?: number, limit?: number, model?: string } → { run_id }
// POST { action: 'stop', run_id }  → { ok }
// POST { action: 'check' }          → { ok, error? } — токен GitHub на месте и видит воркфлоу (ничего не запускает)
// Из robot-tick (CRON_SECRET): { action: 'start', task: 'search' | 'covers', scheduled: true }
import { checkToken, dispatch } from '../_shared/github.ts';
import { admin, isServiceCall, json, preflight, userFrom } from '../_shared/supabase.ts';

Deno.serve(async (req) => {
  const pre = preflight(req);
  if (pre) return pre;
  const db = admin();
  const service = isServiceCall(req);
  const me = service ? null : await userFrom(req, db);
  if (!service) {
    if (!me) return json({ error: 'auth' }, 401);
    const { data: staff } = await db.from('staff').select('user_id').eq('user_id', me).maybeSingle();
    if (!staff) return json({ error: 'forbidden' }, 403);
  }
  const body = await req.json().catch(() => ({})) as { action?: string; run_id?: string; task?: string; topics?: string[]; days?: number; limit?: number; model?: string; sources?: string; scheduled?: boolean };

  if (body.action === 'check') {
    const err = await checkToken();
    return json(err ? { ok: false, error: err } : { ok: true });
  }

  if (body.action === 'stop' && body.run_id) {
    if(!/^[0-9a-f-]{36}$/i.test(body.run_id))return json({error:'invalid run id'},400);
    const {error}=await db.from('robot_runs').update({ cancel: true }).eq('id', body.run_id);
    if(error)return json({error:error.message},500);
    await db.from('robot_log').insert({ run_id: body.run_id, level: 'warn', text: 'Стоп принят. Текущий запрос завершится; новые карточки не сохраняются' });
    return json({ ok: true });
  }

  if(body.action !== 'start') return json({error:'unknown action'},400);
  if(body.sources != null && !['sites','ai','all'].includes(body.sources)) return json({error:'invalid search parameters'},400);
  if(body.days != null && (!Number.isInteger(body.days)||body.days<1||body.days>30) || body.limit != null && (!Number.isInteger(body.limit)||body.limit<1||body.limit>100) || body.model != null && !/^(gemini|kimi|moonshot)-[a-zA-Z0-9.-]+$/.test(body.model) || body.topics != null && (!Array.isArray(body.topics)||body.topics.some(t=>!['music','standup','cinema','art','food','sport'].includes(t))))return json({error:'invalid search parameters'},400);
  const task = body.task === 'covers' ? 'covers' : 'search';
  const params = { task, topics: body.topics ?? [], days: body.days ?? 7, limit: body.limit ?? 40, model: body.model ?? 'gemini-2.5-flash', sources: body.sources ?? 'sites', scheduled: !!body.scheduled };
  const { data: run, error } = await db.from('robot_runs').insert({ params, status: 'queued', started_by: me }).select('id').single();
  if (error || !run) return json({ error: error?.message ?? 'insert' }, 500);
  await db.from('robot_log').insert({ run_id: run.id, text: `${body.scheduled ? 'по расписанию' : 'вручную'} · ${task === 'search' ? 'поиск событий' : 'обложки ИИ'} · жду GitHub Actions` });
  const err = await dispatch(task === 'search' ? 'search.yml' : 'covers.yml', {
    run_id: run.id, ...(task === 'search' ? { topics: params.topics.join(','), days: String(params.days), limit: String(params.limit), model: params.model, sources: params.sources } : {}),
  });
  if (err) {
    await db.from('robot_runs').update({ status: 'failed', finished_at: new Date().toISOString() }).eq('id', run.id);
    await db.from('robot_log').insert({ run_id: run.id, level: 'error', text: err });
    return json({ run_id: run.id, error: err }, 502);
  }
  return json({ run_id: run.id });
});
