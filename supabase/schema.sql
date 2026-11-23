create extension if not exists pgcrypto;

create table if not exists public.cms_profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  role text not null default 'editor' check (role in ('editor','admin')),
  created_at timestamptz not null default now()
);

create table if not exists public.cms_submissions (
  id uuid primary key default gen_random_uuid(),
  created_by uuid not null references auth.users(id),
  html text not null,
  summary text not null default 'Website update',
  status text not null default 'pending' check (status in ('pending','approved','published','rejected')),
  created_at timestamptz not null default now(),
  reviewed_at timestamptz,
  reviewed_by uuid references auth.users(id),
  published_commit text
);

create or replace function public.cms_is_admin()
returns boolean language sql stable security definer set search_path=public
as $$ select exists(select 1 from public.cms_profiles where id=auth.uid() and role='admin') $$;

alter table public.cms_profiles enable row level security;
alter table public.cms_submissions enable row level security;

drop policy if exists "Users read own profile" on public.cms_profiles;
create policy "Users read own profile" on public.cms_profiles for select to authenticated using (id=auth.uid() or public.cms_is_admin());

drop policy if exists "Admins manage profiles" on public.cms_profiles;
create policy "Admins manage profiles" on public.cms_profiles for all to authenticated using (public.cms_is_admin()) with check (public.cms_is_admin());

drop policy if exists "Editors read own submissions and admins read all" on public.cms_submissions;
create policy "Editors read own submissions and admins read all" on public.cms_submissions for select to authenticated using (created_by=auth.uid() or public.cms_is_admin());

drop policy if exists "Editors submit drafts" on public.cms_submissions;
create policy "Editors submit drafts" on public.cms_submissions for insert to authenticated with check (created_by=auth.uid() and status='pending');

drop policy if exists "Admins review submissions" on public.cms_submissions;
create policy "Admins review submissions" on public.cms_submissions for update to authenticated using (public.cms_is_admin()) with check (public.cms_is_admin());

-- After creating your first account, promote it to admin in the SQL editor:
-- update public.cms_profiles set role='admin' where id=(select id from auth.users where email='YOUR_LOGIN_EMAIL');

create or replace function public.cms_new_user_profile()
returns trigger language plpgsql security definer set search_path=public
as $$ begin insert into public.cms_profiles(id,role) values(new.id,'editor') on conflict(id) do nothing; return new; end $$;

drop trigger if exists cms_auth_user_created on auth.users;
create trigger cms_auth_user_created after insert on auth.users for each row execute procedure public.cms_new_user_profile();