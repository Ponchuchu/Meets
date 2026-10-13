-- Только изолированная база. Проверки выполняются с ролью реального пользователя.
begin;
insert into auth.users(id,created_at) values('10000000-0000-4000-8000-000000000001',now()-interval '7 days'),('10000000-0000-4000-8000-000000000002',now()-interval '7 days'),('10000000-0000-4000-8000-000000000003',now()-interval '7 days');
insert into public.profiles(id,name) select id,'Тестер' from auth.users where id::text like '10000000%';
insert into public.friendships(a,b) values('10000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000002');
insert into public.events(id,title,category,starts_at,ends_at,is_long,status,is_free,created_by) values('20000000-0000-4000-8000-000000000001','Многодневный маркет','art',now()+interval '1 day',now()+interval '3 days',true,'published',true,'10000000-0000-4000-8000-000000000001');
insert into public.staff(user_id,role) values('10000000-0000-4000-8000-000000000001','admin');
set local role authenticated;
select set_config('request.jwt.claim.sub','10000000-0000-4000-8000-000000000001',true);
do $$
declare day_now date:=(now() at time zone 'Asia/Almaty')::date; c uuid; m uuid; again uuid; meeting uuid; start_new timestamptz; before_end timestamptz;
begin
 perform public.record_daily_steps(day_now,10000); perform public.record_daily_steps(day_now,10000); perform public.record_daily_steps(day_now,1000);
 if (select steps from public.daily_steps where user_id=auth.uid())<>10000 or (select sum(points) from public.points_ledger where user_id=auth.uid() and kind='steps')<>60 then raise exception 'FAIL steps duplicate/regression'; end if;
 begin perform public.record_daily_steps(day_now+1,10000); raise exception 'FAIL future steps'; exception when others then if sqlerrm like 'FAIL%' then raise; end if; end;
 begin perform public.record_daily_steps(day_now,-1); raise exception 'FAIL negative steps'; exception when others then if sqlerrm like 'FAIL%' then raise; end if; end;
 begin update public.profiles set map_frame='violet' where id=auth.uid(); raise exception 'FAIL locked frame'; exception when others then if sqlerrm like 'FAIL%' then raise; end if; end;
 update public.events set address='Абая 44' where id='20000000-0000-4000-8000-000000000001';
 perform public.repair_event_point('20000000-0000-4000-8000-000000000001',43.25,76.94);
 if (select needs_pin from public.events_live where id='20000000-0000-4000-8000-000000000001') or (select lat from public.events_live where id='20000000-0000-4000-8000-000000000001')<>43.25 then raise exception 'FAIL repaired point'; end if;
 perform public.choose_event_visit('20000000-0000-4000-8000-000000000001',now()+interval '2 days');
 if (select count(*) from public.attendance where event_id='20000000-0000-4000-8000-000000000001' and visit_at is not null)<>1 then raise exception 'FAIL visit date'; end if;
 begin perform public.choose_event_visit('20000000-0000-4000-8000-000000000001',now()+interval '4 days'); raise exception 'FAIL outside event'; exception when others then if sqlerrm like 'FAIL%' then raise; end if; end;
 c:=public.create_friend_group('Двое',array['10000000-0000-4000-8000-000000000002'::uuid]);
 if (select count(*) from public.chat_members where chat_id=c)<>2 then raise exception 'FAIL one friend group'; end if;
 m:=public.send_chat_message(c,'retry-key','Привет'); again:=public.send_chat_message(c,'retry-key','Привет');
 if m<>again or (select count(*) from public.messages where chat_id=c and client_key='retry-key')<>1 then raise exception 'FAIL duplicate message'; end if;
 for n in 1..350 loop perform public.send_chat_message(c,'bulk-'||n,'Сообщение '||n); end loop;
 if (select count(*) from public.messages where chat_id=c)<>351 then raise exception 'FAIL bulk messages'; end if;
 if (select count(*) from public.my_chat_summaries() where chat_id=c)<>1 then raise exception 'FAIL chat summaries'; end if;
 meeting:=public.create_friend_meetup(jsonb_build_object('request_key','reschedule-test','title','Ужин','category','food','starts_at',now()+interval '1 day','address','Абая 44','lat',43.25,'lon',76.94,'invited',jsonb_build_array('10000000-0000-4000-8000-000000000002')));
 start_new:=now()+interval '2 days';
 perform public.reschedule_meetup(meeting,start_new);
 if (select starts_at from public.events where id=meeting)<>start_new or (select ends_at-starts_at from public.events where id=meeting)<>interval '3 hours' then raise exception 'FAIL reschedule'; end if;
 if (select count(*) from public.messages where event_id=meeting and kind='system')<>1 then raise exception 'FAIL reschedule notice'; end if;
end $$;
select set_config('request.jwt.claim.sub','10000000-0000-4000-8000-000000000003',true);
do $$
declare event uuid:=(select id from public.events where title='Ужин');
begin
 begin perform public.repair_event_point('20000000-0000-4000-8000-000000000001',43.25,76.94); raise exception 'FAIL stranger repair'; exception when others then if sqlerrm like 'FAIL%' then raise; end if; end;
 if (select count(*) from public.daily_steps)<>0 then raise exception 'FAIL steps leak'; end if;
 if (select count(*) from public.my_chat_summaries())<>0 then raise exception 'FAIL summaries leak'; end if;
 begin perform public.reschedule_meetup(coalesce(event,'20000000-0000-4000-8000-000000000001'),now()+interval '1 day'); raise exception 'FAIL reschedule stranger'; exception when others then if sqlerrm like 'FAIL%' then raise; end if; end;
 begin perform public.send_chat_message('30000000-0000-4000-8000-000000000001','stranger','test'); raise exception 'FAIL stranger message'; exception when others then if sqlerrm like 'FAIL%' then raise; end if; end;
end $$;
rollback;
