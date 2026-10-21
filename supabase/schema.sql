-- ============================================================================
-- Arqueiros — banco de dados das contas online (Supabase)
-- Como usar: no painel do Supabase, abra "SQL Editor" → "New query",
-- cole TODO este arquivo e clique em "Run". Pode rodar de novo sem problema.
-- ============================================================================

-- Um perfil por jogador
create table if not exists public.profiles (
  user_id    uuid primary key references auth.users (id) on delete cascade,
  username   text not null,
  data       jsonb not null,
  level      integer not null default 1,
  kills      integer not null default 0,
  wins       integer not null default 0,
  updated_at timestamptz not null default now()
);

-- Nome de jogador único (sem diferenciar maiúsculas) e com formato válido
create unique index if not exists profiles_username_key on public.profiles (lower(username));
alter table public.profiles drop constraint if exists username_format;
alter table public.profiles add constraint username_format check (username ~ '^[[:alnum:]_]{3,16}$');

-- Limite de tamanho do perfil (um perfil normal tem poucos KB)
alter table public.profiles drop constraint if exists profile_size;
alter table public.profiles add constraint profile_size check (pg_column_size(data) < 100000);

-- Segurança: cada jogador só lê e altera o PRÓPRIO perfil (Row Level Security)
alter table public.profiles enable row level security;

drop policy if exists "ler o próprio perfil" on public.profiles;
create policy "ler o próprio perfil" on public.profiles
  for select to authenticated using ((select auth.uid()) = user_id);

drop policy if exists "criar o próprio perfil" on public.profiles;
create policy "criar o próprio perfil" on public.profiles
  for insert to authenticated with check ((select auth.uid()) = user_id);

drop policy if exists "atualizar o próprio perfil" on public.profiles;
create policy "atualizar o próprio perfil" on public.profiles
  for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

drop policy if exists "apagar o próprio perfil" on public.profiles;
create policy "apagar o próprio perfil" on public.profiles
  for delete to authenticated using ((select auth.uid()) = user_id);

-- Verifica se um nome de jogador já está em uso (sem expor os perfis)
create or replace function public.username_taken(name text)
returns boolean
language sql
security definer
set search_path = ''
stable
as $$
  select exists (select 1 from public.profiles where lower(username) = lower(name));
$$;

revoke all on function public.username_taken(text) from public;
grant execute on function public.username_taken(text) to anon, authenticated;

-- "Excluir conta" dentro do jogo (LGPD): apaga o usuário logado e o perfil dele
create or replace function public.delete_my_account()
returns void
language sql
security definer
set search_path = ''
as $$
  delete from auth.users where id = auth.uid();
$$;

revoke all on function public.delete_my_account() from public, anon;
grant execute on function public.delete_my_account() to authenticated;
