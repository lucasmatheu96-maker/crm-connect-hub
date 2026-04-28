REVOKE EXECUTE ON FUNCTION public.find_user_by_name(text) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.unaccent_safe(text) FROM PUBLIC, anon, authenticated;