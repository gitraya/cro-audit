-- Store the annotated list of CRO changes applied to the replicated homepage.
-- Shape: AppliedChange[] = { change, finding_principle, source_book }[]
alter table public.audits
  add column if not exists applied_changes jsonb;
