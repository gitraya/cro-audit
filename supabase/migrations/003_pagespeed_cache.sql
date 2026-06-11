create table public.pagespeed_caches (
  url_key text primary key,
  signals jsonb not null,
  created_at timestamptz not null default now()
);

alter table public.pagespeed_caches enable row level security;

create policy "Authenticated users can read pagespeed cache"
on public.pagespeed_caches for select
to authenticated
using (true);

create policy "Authenticated users can insert pagespeed cache"
on public.pagespeed_caches for insert
to authenticated
with check (true);
