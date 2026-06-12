create or replace function public.match_principles_by_book(
  query_embedding vector(768),
  target_book text,
  match_count int
)
returns table (
  id uuid,
  book_title text,
  book_author text,
  principle text,
  explanation text,
  cro_application text,
  distance double precision,
  similarity double precision
)
language sql
stable
as $$
  select
    bp.id,
    bp.book_title,
    bp.book_author,
    bp.principle,
    bp.explanation,
    bp.cro_application,
    (bp.embedding <=> query_embedding) as distance,
    1 - (bp.embedding <=> query_embedding) as similarity
  from public.book_principles bp
  where bp.book_title = target_book
  order by distance asc, bp.principle asc
  limit greatest(match_count, 0);
$$;
