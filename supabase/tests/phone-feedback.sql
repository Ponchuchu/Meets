-- Изолированная тестовая база. Тест не изменяет production; все данные откатываются.
begin;
insert into auth.users(id,created_at) values
 ('00000000-0000-4000-8000-000000000001',now()-interval '7 days'),
 ('00000000-0000-4000-8000-000000000002',now()-interval '7 days'),
 ('00000000-0000-4000-8000-000000000003',now()-interval '7 days'),
 ('00000000-0000-4000-8000-000000000004',now()-interval '7 days');
insert into public.profiles(id,name) select id,'Тест' from auth.users where id::text like '00000000%';
insert into public.friendships(a,b) values
 ('00000000-0000-4000-8000-000000000001','00000000-0000-4000-8000-000000000002'),
 ('00000000-0000-4000-8000-000000000001','00000000-0000-4000-8000-000000000003');
set local role authenticated;
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000001',true);
do $$
declare payload jsonb; a uuid; b uuid; chat uuid;
begin
 payload=jsonb_build_object('request_key','test-request','title','Ужин','category','food','starts_at',now()+interval '1 day','address','Есенова 160','lat',43.25,'lon',76.94,'invited',jsonb_build_array('00000000-0000-4000-8000-000000000002','00000000-0000-4000-8000-000000000003'));
 a=public.create_friend_meetup(payload); b=public.create_friend_meetup(payload);
 if a<>b or (select count(*) from public.invites where event_id=a)<>2 or (select count(*) from public.messages where event_id=a)<>2 then raise exception 'FAIL duplicate submit';end if;
 if (select count(*) from public.meetup_locations where event_id=a)<>1 then raise exception 'FAIL owner address';end if;
 if (select address from public.events where id=a)='Есенова 160' then raise exception 'FAIL precise address leaked';end if;
 begin perform public.create_friend_meetup((payload-'lat')||jsonb_build_object('request_key','bad-null'));raise exception 'FAIL null coordinate allowed';exception when others then if sqlerrm like 'FAIL%' then raise;end if;end;
 begin perform public.create_friend_meetup(payload||jsonb_build_object('request_key','bad-friend','invited',jsonb_build_array('00000000-0000-4000-8000-000000000004')));raise exception 'FAIL stranger invite';exception when others then if sqlerrm like 'FAIL%' then raise;end if;end;
 chat=public.create_friend_group('Выходные',array['00000000-0000-4000-8000-000000000002'::uuid,'00000000-0000-4000-8000-000000000003'::uuid]);
 if (select count(*) from public.chat_members where chat_id=chat)<>3 then raise exception 'FAIL group members';end if;
 insert into public.messages(chat_id,author_id,kind,body,event_id) values(chat,auth.uid(),'invite','Ужин',a);
 update public.attendance set status='arrived' where event_id=a and user_id=auth.uid();
 update public.attendance set status='going' where event_id=a and user_id=auth.uid();
 update public.attendance set status='arrived' where event_id=a and user_id=auth.uid();
 if (select count(*) from public.points_ledger where kind='arrival' and ref=a::text)<>1 or (select progress from public.user_badges where badge_id='first' and user_id=auth.uid())<>1 then raise exception 'FAIL repeated XP';end if;
end $$;
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000002',true);
do $$begin
 if (select count(*) from public.meetup_locations)<>0 then raise exception 'FAIL unaccepted address leaked';end if;
 update public.invites set answer='yes' where to_id=auth.uid();
 update public.invites set answer='no' where to_id=auth.uid();
 update public.invites set answer='yes' where to_id=auth.uid();
 if (select count(*) from public.meetup_locations)<>1 then raise exception 'FAIL accepted address missing';end if;
end $$;
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000001',true);
do $$begin
 if (select count(*) from public.points_ledger where kind='invitation')<>1 or (select progress from public.user_badges where badge_id='call-friend' and user_id=auth.uid())<>1 then raise exception 'FAIL repeated invitation XP';end if;
end $$;
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000004',true);
do $$begin
 if (select count(*) from public.meetup_locations)<>0 then raise exception 'FAIL stranger address leaked';end if;
 begin perform public.reset_user_taste('00000000-0000-4000-8000-000000000001');raise exception 'FAIL stranger taste reset';exception when others then if sqlerrm like 'FAIL%' then raise;end if;end;
end $$;
rollback;
