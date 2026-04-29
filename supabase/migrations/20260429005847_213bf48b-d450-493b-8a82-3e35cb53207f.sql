
-- Toggle for periodic location tracking per authorized user
ALTER TABLE public.authorized_emails
  ADD COLUMN IF NOT EXISTS track_location boolean NOT NULL DEFAULT false;

-- Table for storing periodic location pings
CREATE TABLE IF NOT EXISTS public.location_pings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  geo_lat double precision,
  geo_lng double precision,
  geo_endereco text,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_location_pings_user_created
  ON public.location_pings (user_id, created_at DESC);

ALTER TABLE public.location_pings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "pings_insert_self"
  ON public.location_pings FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "pings_select_own_or_admin"
  ON public.location_pings FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id OR has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "pings_admin_all"
  ON public.location_pings FOR ALL
  TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
