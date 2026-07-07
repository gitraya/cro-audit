-- Stream in-progress audit updates to the browser via Supabase Realtime so the
-- audit detail page no longer has to poll on a timer.
--
-- The worker updates the `audits` row as each pipeline stage completes (stage,
-- status, findings, generated_html, …). Adding the table to the
-- `supabase_realtime` publication makes Postgres push those UPDATEs to any
-- client subscribed to that row.
alter publication supabase_realtime add table public.audits;

-- REPLICA IDENTITY FULL includes every column (not just the primary key) in the
-- change payload. Realtime evaluates the table's RLS SELECT policy against that
-- payload before delivering an event; since the policy checks `user_id` — which
-- is not the primary key — the full row must be present for authorization to
-- pass. Without this, RLS-protected UPDATE events are silently dropped.
alter table public.audits replica identity full;
