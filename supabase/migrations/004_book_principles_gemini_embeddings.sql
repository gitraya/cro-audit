create extension if not exists vector with schema extensions;

create table if not exists public.book_principles (
  id uuid primary key default gen_random_uuid(),
  book_title text,
  book_author text,
  principle text,
  explanation text,
  cro_application text,
  embedding vector(768),
  created_at timestamptz default now()
);

drop index if exists public.book_principles_embedding_idx;
drop index if exists public.book_principles_embedding_hnsw_idx;
drop index if exists public.book_principles_natural_key_idx;

alter table public.book_principles
  add column if not exists book_author text,
  add column if not exists principle text,
  add column if not exists explanation text,
  add column if not exists cro_application text;

update public.book_principles
set
  principle = coalesce(principle, principle_name),
  explanation = coalesce(explanation, content),
  cro_application = coalesce(cro_application, '')
where
  (principle is null and principle_name is not null)
  or (explanation is null and content is not null)
  or cro_application is null;

truncate table public.book_principles;

alter table public.book_principles
  drop column if exists principle_name,
  drop column if exists content,
  alter column book_title set not null,
  alter column book_author set not null,
  alter column principle set not null,
  alter column explanation set not null,
  alter column cro_application set not null,
  alter column embedding type vector(768) using null,
  alter column embedding set not null,
  alter column created_at set default now();

create unique index book_principles_natural_key_idx
  on public.book_principles (book_title, principle);

create index book_principles_book_title_idx
  on public.book_principles (book_title);

create index book_principles_embedding_hnsw_idx
  on public.book_principles
  using hnsw (embedding vector_cosine_ops);
