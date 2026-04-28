INSERT INTO public.authorized_emails (email, nome, role, status, activated_at, activated_user_id)
VALUES ('lucas.matheu96@gmail.com', 'Lucas Matheu', 'admin', 'ativo', now(), '6ff96878-e7b3-4c16-b17a-4fb5f10ee87f')
ON CONFLICT (email) DO UPDATE SET status='ativo', role='admin', activated_at=now(), activated_user_id=EXCLUDED.activated_user_id;

-- Garante que admins nunca sejam bloqueados pela checagem de autorização
CREATE OR REPLACE FUNCTION public.is_current_user_authorized()
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT
    public.has_role(auth.uid(), 'admin'::app_role)
    OR EXISTS (
      SELECT 1 FROM public.authorized_emails ae
      JOIN auth.users u ON lower(u.email) = lower(ae.email)
      WHERE u.id = auth.uid() AND ae.status = 'ativo'
    );
$function$;