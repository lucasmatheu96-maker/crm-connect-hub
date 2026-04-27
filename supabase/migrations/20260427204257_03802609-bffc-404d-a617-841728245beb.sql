REVOKE EXECUTE ON FUNCTION public.is_current_user_authorized() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_current_user_authorized() TO authenticated;