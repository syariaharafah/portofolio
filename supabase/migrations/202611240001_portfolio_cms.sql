begin;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at = timezone('utc', now());
  return new;
end;
$$;

create table if not exists public.site_settings (
  id text primary key default 'main',
  site_title text not null default '',
  meta_description text not null default '',
  brand_mark text not null default '',
  brand_name text not null default '',
  brand_tagline text not null default '',
  email text not null default '',
  profile_image_url text not null default '',
  profile_image_alt text not null default '',
  campus_name text not null default '',
  campus_logo_url text not null default '',
  campus_logo_alt text not null default '',
  profile_document_url text not null default '',
  primary_color text not null default '#123b72',
  accent_color text not null default '#357fbd',
  sakura_enabled boolean not null default true,
  sakura_density integer not null default 42 check (sakura_density between 0 and 80),
  sakura_speed numeric(4,2) not null default 1 check (sakura_speed between 0.25 and 3),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.site_texts (
  key text primary key,
  group_key text not null default 'Lainnya',
  label text not null default '',
  value text not null default '',
  input_type text not null default 'text' check (input_type in ('text', 'textarea')),
  sort_order integer not null default 0,
  is_public boolean not null default true,
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.page_sections (
  section_key text primary key,
  anchor text not null unique,
  menu_label text not null default '',
  eyebrow text not null default '',
  title text not null default '',
  description text not null default '',
  sort_order integer not null default 0,
  is_visible boolean not null default true,
  show_in_nav boolean not null default true,
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.profile_facts (
  id text primary key,
  label text not null default '',
  value text not null default '',
  value_type text not null default 'text' check (value_type in ('text', 'email')),
  sort_order integer not null default 0,
  is_published boolean not null default false,
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.education (
  id text primary key,
  period text not null default '',
  level text not null default '',
  institution text not null default '',
  description text not null default '',
  is_current boolean not null default false,
  sort_order integer not null default 0,
  is_published boolean not null default false,
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.portfolio_items (
  id text primary key,
  section_type text not null check (section_type in ('achievement', 'seminar', 'teaching', 'organization')),
  date_label text not null default '',
  title text not null default '',
  description text not null default '',
  sort_order integer not null default 0,
  is_featured boolean not null default false,
  is_published boolean not null default false,
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.portfolio_media (
  id text primary key,
  item_id text not null references public.portfolio_items(id) on delete cascade,
  original_url text not null,
  thumbnail_url text not null,
  original_path text,
  thumbnail_path text,
  alt_text text not null default '',
  sort_order integer not null default 0,
  is_wide boolean not null default false,
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.custom_sections (
  id text primary key,
  title text not null default '',
  description text not null default '',
  sort_order integer not null default 0,
  is_visible boolean not null default false,
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.custom_entries (
  id text primary key,
  custom_section_id text not null references public.custom_sections(id) on delete cascade,
  badge text not null default '',
  icon text not null default '✦',
  title text not null default '',
  description text not null default '',
  sort_order integer not null default 0,
  is_published boolean not null default false,
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.admin_users (
  user_id uuid primary key references auth.users(id) on delete cascade,
  email text not null unique,
  created_at timestamptz not null default timezone('utc', now())
);

create index if not exists profile_facts_public_order_idx on public.profile_facts (is_published, sort_order);
create index if not exists education_public_order_idx on public.education (is_published, sort_order);
create index if not exists portfolio_items_type_public_order_idx on public.portfolio_items (section_type, is_published, sort_order);
create index if not exists portfolio_media_item_order_idx on public.portfolio_media (item_id, sort_order);
create index if not exists custom_sections_visible_order_idx on public.custom_sections (is_visible, sort_order);
create index if not exists custom_entries_section_public_order_idx on public.custom_entries (custom_section_id, is_published, sort_order);

do $$
declare table_name text;
begin
  foreach table_name in array array['site_settings','site_texts','page_sections','profile_facts','education','portfolio_items','portfolio_media','custom_sections','custom_entries']
  loop
    execute format('drop trigger if exists set_%I_updated_at on public.%I', table_name, table_name);
    execute format('create trigger set_%I_updated_at before update on public.%I for each row execute function public.set_updated_at()', table_name, table_name);
  end loop;
end;
$$;

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists(
    select 1
    from public.admin_users
    where user_id = auth.uid()
      and lower(email) = 'cantiksyariah348@gmail.com'
  );
$$;

revoke all on function public.is_admin() from public;
grant execute on function public.is_admin() to authenticated;

create or replace function public.handle_owner_account()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if lower(coalesce(new.email, '')) = 'cantiksyariah348@gmail.com' then
    insert into public.admin_users (user_id, email)
    values (new.id, lower(new.email))
    on conflict (user_id) do update set email = excluded.email;
  end if;
  return new;
end;
$$;

create or replace function public.restrict_portfolio_signup()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if lower(coalesce(new.email, '')) <> 'cantiksyariah348@gmail.com' then
    raise exception 'Pendaftaran publik tidak tersedia untuk portofolio ini.';
  end if;
  return new;
end;
$$;

drop trigger if exists restrict_portfolio_auth_signup on auth.users;
create trigger restrict_portfolio_auth_signup
before insert on auth.users
for each row execute function public.restrict_portfolio_signup();

drop trigger if exists add_owner_as_admin on auth.users;
create trigger add_owner_as_admin
after insert or update of email on auth.users
for each row execute function public.handle_owner_account();

insert into public.admin_users (user_id, email)
select id, lower(email) from auth.users where lower(email) = 'cantiksyariah348@gmail.com'
on conflict (user_id) do update set email = excluded.email;

alter table public.site_settings enable row level security;
alter table public.site_texts enable row level security;
alter table public.page_sections enable row level security;
alter table public.profile_facts enable row level security;
alter table public.education enable row level security;
alter table public.portfolio_items enable row level security;
alter table public.portfolio_media enable row level security;
alter table public.custom_sections enable row level security;
alter table public.custom_entries enable row level security;
alter table public.admin_users enable row level security;

create policy "Public reads site settings" on public.site_settings for select to anon, authenticated using (true);
create policy "Public reads public text" on public.site_texts for select to anon, authenticated using (is_public);
create policy "Public reads visible sections" on public.page_sections for select to anon, authenticated using (is_visible);
create policy "Public reads published profile facts" on public.profile_facts for select to anon, authenticated using (is_published);
create policy "Public reads published education" on public.education for select to anon, authenticated using (is_published);
create policy "Public reads published portfolio items" on public.portfolio_items for select to anon, authenticated using (is_published);
create policy "Public reads media of published items" on public.portfolio_media for select to anon, authenticated using (exists(select 1 from public.portfolio_items where id = portfolio_media.item_id and is_published));
create policy "Public reads visible custom sections" on public.custom_sections for select to anon, authenticated using (is_visible);
create policy "Public reads published custom entries" on public.custom_entries for select to anon, authenticated using (is_published and exists(select 1 from public.custom_sections where id = custom_entries.custom_section_id and is_visible));
create policy "Admin can see own membership" on public.admin_users for select to authenticated using (user_id = auth.uid());

create policy "Admin manages site settings" on public.site_settings for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "Admin manages site text" on public.site_texts for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "Admin manages page sections" on public.page_sections for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "Admin manages profile facts" on public.profile_facts for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "Admin manages education" on public.education for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "Admin manages portfolio items" on public.portfolio_items for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "Admin manages portfolio media" on public.portfolio_media for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "Admin manages custom sections" on public.custom_sections for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "Admin manages custom entries" on public.custom_entries for all to authenticated using (public.is_admin()) with check (public.is_admin());

grant usage on schema public to anon, authenticated;
grant select on public.site_settings, public.site_texts, public.page_sections, public.profile_facts, public.education, public.portfolio_items, public.portfolio_media, public.custom_sections, public.custom_entries to anon;
grant select, insert, update, delete on public.site_settings, public.site_texts, public.page_sections, public.profile_facts, public.education, public.portfolio_items, public.portfolio_media, public.custom_sections, public.custom_entries to authenticated;
grant select on public.admin_users to authenticated;

create or replace function public.get_public_portfolio()
returns jsonb
language sql
stable
security invoker
set search_path = public, pg_temp
as $$
  select jsonb_build_object(
    'content_version', greatest(
      coalesce((select max(updated_at) from public.site_settings), 'epoch'::timestamptz),
      coalesce((select max(updated_at) from public.site_texts), 'epoch'::timestamptz),
      coalesce((select max(updated_at) from public.page_sections), 'epoch'::timestamptz),
      coalesce((select max(updated_at) from public.profile_facts), 'epoch'::timestamptz),
      coalesce((select max(updated_at) from public.education), 'epoch'::timestamptz),
      coalesce((select max(updated_at) from public.portfolio_items), 'epoch'::timestamptz),
      coalesce((select max(updated_at) from public.portfolio_media), 'epoch'::timestamptz),
      coalesce((select max(updated_at) from public.custom_sections), 'epoch'::timestamptz),
      coalesce((select max(updated_at) from public.custom_entries), 'epoch'::timestamptz)
    )::text,
    'settings', coalesce((select to_jsonb(s) - 'updated_at' from public.site_settings s where id = 'main'), '{}'::jsonb),
    'texts', coalesce((select jsonb_object_agg(t.key, t.value) from public.site_texts t where t.is_public), '{}'::jsonb),
    'sections', coalesce((select jsonb_agg(to_jsonb(s) - 'updated_at' order by s.sort_order) from public.page_sections s where s.is_visible), '[]'::jsonb),
    'profile_facts', coalesce((select jsonb_agg(to_jsonb(f) - 'updated_at' order by f.sort_order) from public.profile_facts f where f.is_published), '[]'::jsonb),
    'education', coalesce((select jsonb_agg(to_jsonb(e) - 'updated_at' order by e.sort_order) from public.education e where e.is_published), '[]'::jsonb),
    'portfolio_items', coalesce((select jsonb_agg(
      (to_jsonb(i) - 'updated_at') || jsonb_build_object('media', coalesce((
        select jsonb_agg(to_jsonb(m) - 'updated_at' order by m.sort_order)
        from public.portfolio_media m where m.item_id = i.id
      ), '[]'::jsonb)) order by i.section_type, i.sort_order
    ) from public.portfolio_items i where i.is_published), '[]'::jsonb),
    'custom_sections', coalesce((select jsonb_agg(
      (to_jsonb(c) - 'updated_at') || jsonb_build_object('entries', coalesce((
        select jsonb_agg(to_jsonb(e) - 'updated_at' order by e.sort_order)
        from public.custom_entries e where e.custom_section_id = c.id and e.is_published
      ), '[]'::jsonb)) order by c.sort_order
    ) from public.custom_sections c where c.is_visible), '[]'::jsonb)
  );
$$;

revoke all on function public.get_public_portfolio() from public;
grant execute on function public.get_public_portfolio() to anon, authenticated;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('portfolio-media', 'portfolio-media', true, 15728640, array['image/jpeg','image/png','image/webp','application/pdf','application/msword','application/vnd.openxmlformats-officedocument.wordprocessingml.document'])
on conflict (id) do update set public = excluded.public, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

create policy "Public reads portfolio storage" on storage.objects for select to public using (bucket_id = 'portfolio-media');
create policy "Admin uploads portfolio storage" on storage.objects for insert to authenticated with check (bucket_id = 'portfolio-media' and public.is_admin());
create policy "Admin updates portfolio storage" on storage.objects for update to authenticated using (bucket_id = 'portfolio-media' and public.is_admin()) with check (bucket_id = 'portfolio-media' and public.is_admin());
create policy "Admin deletes portfolio storage" on storage.objects for delete to authenticated using (bucket_id = 'portfolio-media' and public.is_admin());

commit;
