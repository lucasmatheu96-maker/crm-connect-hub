
-- Revoga execução pública das funções SECURITY DEFINER
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.has_role(UUID, app_role) FROM PUBLIC, anon;
-- has_role precisa ser executável por usuários autenticados (usado nas RLS policies)
GRANT EXECUTE ON FUNCTION public.has_role(UUID, app_role) TO authenticated;
REVOKE EXECUTE ON FUNCTION public.update_updated_at_column() FROM PUBLIC, anon, authenticated;
