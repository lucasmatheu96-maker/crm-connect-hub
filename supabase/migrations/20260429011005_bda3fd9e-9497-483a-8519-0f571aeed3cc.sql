
ALTER TABLE public.access_logs
  ADD COLUMN IF NOT EXISTS reason_context text,
  ADD COLUMN IF NOT EXISTS ref_table text,
  ADD COLUMN IF NOT EXISTS ref_id uuid,
  ADD COLUMN IF NOT EXISTS geo_lat double precision,
  ADD COLUMN IF NOT EXISTS geo_lng double precision,
  ADD COLUMN IF NOT EXISTS geo_endereco text;
