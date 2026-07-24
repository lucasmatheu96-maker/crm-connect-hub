-- Restrict app_settings SELECT to admins only
DROP POLICY IF EXISTS settings_select ON public.app_settings;
CREATE POLICY settings_select_admin ON public.app_settings
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::public.app_role));

-- Provide a minimal SECURITY DEFINER accessor so non-admin clients can
-- know only whether auto-sync is enabled (used by useAutoSync), without
-- exposing sensitive configuration like the Google Sheet ID.
CREATE OR REPLACE FUNCTION public.get_sync_status()
RETURNS TABLE(sync_enabled boolean, has_sheet boolean)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(sync_enabled, false),
         COALESCE(google_sheet_id, '') <> ''
  FROM public.app_settings
  WHERE id = 1
$$;

REVOKE ALL ON FUNCTION public.get_sync_status() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_sync_status() TO authenticated, service_role;