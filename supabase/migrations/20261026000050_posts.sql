-- Воспоминания как посты (26 октября, решение владельца): фото, подпись, карточка события (необязательно),
-- отмеченные друзья, комментарии и лайки. Пост — это строка memories (note = подпись), фото — memory_photos.
-- Кто видит пост — как раньше: can_see_memories (друзья — по умолчанию, все — по желанию, миграция 49).

-- Постов про одно событие может быть несколько.
alter table public.memories drop constraint if exists memories_user_id_event_id_key;
-- Новым людям друзья видят посты сразу (как в Instagram); кто уже выключил — у того остаётся выключено.
alter table public.profiles alter column memories_visible set default true;

create or replace function public.memory_owner(m uuid) returns uuid
language sql stable security definer set search_path = public as $$ select user_id from public.memories where id = m $$;

-- Отмеченные друзья.
create table if not exists public.memory_tags (
  memory_id uuid not null references public.memories(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  primary key (memory_id, user_id)
);
alter table public.memory_tags enable row level security;
drop policy if exists memory_tags_read on public.memory_tags;
create policy memory_tags_read on public.memory_tags for select to authenticated
  using (user_id = auth.uid() or public.can_see_memories(public.memory_owner(memory_id)));
drop policy if exists memory_tags_write on public.memory_tags;
create policy memory_tags_write on public.memory_tags for insert to authenticated
  with check (public.memory_owner(memory_id) = auth.uid() and public.is_friend(auth.uid(), user_id));
drop policy if exists memory_tags_delete on public.memory_tags;
create policy memory_tags_delete on public.memory_tags for delete to authenticated
  using (public.memory_owner(memory_id) = auth.uid() or user_id = auth.uid());

-- Комментарии.
create table if not exists public.memory_comments (
  id uuid primary key default gen_random_uuid(),
  memory_id uuid not null references public.memories(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade default auth.uid(),
  body text not null check (length(body) between 1 and 500),
  created_at timestamptz not null default now()
);
create index if not exists memory_comments_memory on public.memory_comments(memory_id, created_at);
alter table public.memory_comments enable row level security;
drop policy if exists memory_comments_read on public.memory_comments;
create policy memory_comments_read on public.memory_comments for select to authenticated
  using (public.can_see_memories(public.memory_owner(memory_id)) and not public.is_blocked(auth.uid(), user_id));
drop policy if exists memory_comments_write on public.memory_comments;
create policy memory_comments_write on public.memory_comments for insert to authenticated
  with check (user_id = auth.uid() and public.can_see_memories(public.memory_owner(memory_id)));
drop policy if exists memory_comments_delete on public.memory_comments;
create policy memory_comments_delete on public.memory_comments for delete to authenticated
  using (user_id = auth.uid() or public.memory_owner(memory_id) = auth.uid());

-- Лайки.
create table if not exists public.memory_likes (
  memory_id uuid not null references public.memories(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade default auth.uid(),
  created_at timestamptz not null default now(),
  primary key (memory_id, user_id)
);
alter table public.memory_likes enable row level security;
drop policy if exists memory_likes_read on public.memory_likes;
create policy memory_likes_read on public.memory_likes for select to authenticated
  using (public.can_see_memories(public.memory_owner(memory_id)));
drop policy if exists memory_likes_write on public.memory_likes;
create policy memory_likes_write on public.memory_likes for insert to authenticated
  with check (user_id = auth.uid() and public.can_see_memories(public.memory_owner(memory_id)));
drop policy if exists memory_likes_delete on public.memory_likes;
create policy memory_likes_delete on public.memory_likes for delete to authenticated using (user_id = auth.uid());
