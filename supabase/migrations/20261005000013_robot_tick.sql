-- Расписание робота решает Supabase, а не GitHub (V6 §10.3): раз в 5 минут — robot-tick.
select cron.unschedule(jobname) from cron.job where jobname = 'robot-tick';
select cron.schedule('robot-tick', '*/5 * * * *', $$select public.call_function('robot-tick')$$);
