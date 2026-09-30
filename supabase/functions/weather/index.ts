// Погода Алматы: Open-Meteo → таблица weather_cache. Раз в час вызывает pg_cron; приложение читает кэш.
import { admin, isServiceCall, json } from '../_shared/supabase.ts';

const URL_ =
  'https://api.open-meteo.com/v1/forecast?latitude=43.2389&longitude=76.8897' +
  '&daily=weather_code,temperature_2m_max&hourly=temperature_2m,weather_code&timezone=Asia%2FAlmaty&forecast_days=8';

Deno.serve(async (req) => {
  if (!isServiceCall(req)) return json({ error: 'forbidden' }, 403);
  const res = await fetch(URL_);
  if (!res.ok) return json({ error: `open-meteo ${res.status}` }, 502);
  const payload = await res.json();
  const { error } = await admin().from('weather_cache').upsert({ city: 'almaty', payload, updated_at: new Date().toISOString() });
  if (error) return json({ error: error.message }, 500);
  return json({ ok: true, days: payload.daily?.time?.length ?? 0 });
});
