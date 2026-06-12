-- Granular progress for the async audit pipeline.
-- Nullable; `status` (queued -> completed/failed) still tracks terminal state,
-- while `stage` reports which pipeline step is currently running.
-- Stages: scraping | analyzing_performance | extracting_brand | auditing | generating | done
alter table public.audits
  add column if not exists stage text;
