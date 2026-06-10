create extension if not exists vector with schema extensions;

create type public.audit_status as enum (
  'queued',
  'running',
  'completed',
  'failed'
);

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  full_name text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.audits (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  url text not null,
  status public.audit_status not null default 'queued',
  brand_tokens jsonb,
  pagespeed_data jsonb,
  findings jsonb,
  generated_html text,
  error_message text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.book_principles (
  id uuid primary key default gen_random_uuid(),
  book_title text not null,
  principle_name text not null,
  content text not null,
  embedding vector(1536),
  created_at timestamptz not null default now()
);

create index audits_user_created_at_idx
  on public.audits (user_id, created_at desc);

create index book_principles_book_title_idx
  on public.book_principles (book_title);

create index book_principles_embedding_idx
  on public.book_principles
  using ivfflat (embedding vector_cosine_ops)
  with (lists = 100);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger profiles_set_updated_at
before update on public.profiles
for each row execute function public.set_updated_at();

create trigger audits_set_updated_at
before update on public.audits
for each row execute function public.set_updated_at();

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, email, full_name)
  values (
    new.id,
    coalesce(new.email, ''),
    nullif(new.raw_user_meta_data ->> 'full_name', '')
  );
  return new;
end;
$$;

create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();

alter table public.profiles enable row level security;
alter table public.audits enable row level security;
alter table public.book_principles enable row level security;

create policy "Users can read their own profile"
on public.profiles for select
to authenticated
using (auth.uid() = id);

create policy "Users can update their own profile"
on public.profiles for update
to authenticated
using (auth.uid() = id)
with check (auth.uid() = id);

create policy "Users can read their own audits"
on public.audits for select
to authenticated
using (auth.uid() = user_id);

create policy "Users can create their own audits"
on public.audits for insert
to authenticated
with check (auth.uid() = user_id);

create policy "Users can update their own audits"
on public.audits for update
to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

create policy "Users can delete their own audits"
on public.audits for delete
to authenticated
using (auth.uid() = user_id);

create policy "Authenticated users can read book principles"
on public.book_principles for select
to authenticated
using (true);
