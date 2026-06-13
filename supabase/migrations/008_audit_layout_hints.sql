-- Deterministic page-composition signals (light/dark orientation + alignment)
-- fed to the homepage generation stage. LAYOUT signals, kept separate from
-- brand_tokens. Shape:
--   { background_color, text_color, is_dark_theme, hero_alignment }
alter table public.audits
  add column if not exists layout_hints jsonb;
