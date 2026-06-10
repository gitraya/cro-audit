create table public.brand_voice_caches (
  url_key text primary key,
  voice jsonb not null,
  created_at timestamptz not null default now()
);

alter table public.brand_voice_caches enable row level security;

create policy "Authenticated users can read brand voice cache"
on public.brand_voice_caches for select
to authenticated
using (true);

create policy "Authenticated users can insert brand voice cache"
on public.brand_voice_caches for insert
to authenticated
with check (true);

create policy "Authenticated users can update brand voice cache"
on public.brand_voice_caches for update
to authenticated
using (true)
with check (true);
