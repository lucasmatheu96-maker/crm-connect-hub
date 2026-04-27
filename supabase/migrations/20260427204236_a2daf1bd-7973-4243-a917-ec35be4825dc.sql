-- Tabela de emails autorizados
CREATE TABLE public.authorized_emails (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text NOT NULL UNIQUE,
  nome text,
  telefone text,
  role app_role NOT NULL DEFAULT 'vendedor',
  status text NOT NULL DEFAULT 'pendente' CHECK (status IN ('pendente','ativo','bloqueado')),
  notes text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  activated_at timestamptz,
  activated_user_id uuid
);

CREATE INDEX idx_auth_emails_email ON public.authorized_emails (lower(email));

ALTER TABLE public.authorized_emails ENABLE ROW LEVEL SECURITY;

CREATE POLICY "auth_emails_admin_all" ON public.authorized_emails
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'))
  WITH CHECK (has_role(auth.uid(), 'admin'));

CREATE TRIGGER update_authorized_emails_updated_at
BEFORE UPDATE ON public.authorized_emails
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Tabela de logs de acesso
CREATE TABLE public.access_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text,
  user_id uuid,
  action text NOT NULL CHECK (action IN ('login','login_blocked','logout','signup')),
  success boolean NOT NULL DEFAULT true,
  reason text,
  ip text,
  user_agent text,
  provider text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_access_logs_created ON public.access_logs (created_at DESC);
CREATE INDEX idx_access_logs_user ON public.access_logs (user_id);
CREATE INDEX idx_access_logs_email ON public.access_logs (lower(email));

ALTER TABLE public.access_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "access_logs_admin_select" ON public.access_logs
  FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'admin'));

-- Permite usuários autenticados inserirem seus próprios eventos de logout
CREATE POLICY "access_logs_insert_self" ON public.access_logs
  FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid() OR user_id IS NULL);

-- Substituir handle_new_user para validar lista de autorizados
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  user_count INT;
  authorized RECORD;
  user_email text;
BEGIN
  user_email := lower(NEW.email);

  -- Cria perfil sempre (necessário para FK)
  INSERT INTO public.profiles (user_id, nome, telefone)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data ->> 'full_name', NEW.raw_user_meta_data ->> 'name', NEW.raw_user_meta_data ->> 'nome', NEW.email),
    NEW.raw_user_meta_data ->> 'telefone'
  );

  SELECT COUNT(*) INTO user_count FROM auth.users;

  -- Bootstrap: primeiro usuário é admin automático
  IF user_count = 1 THEN
    INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'admin');
    -- Auto-autoriza esse admin
    INSERT INTO public.authorized_emails (email, nome, role, status, activated_at, activated_user_id)
    VALUES (user_email, COALESCE(NEW.raw_user_meta_data ->> 'full_name', NEW.email), 'admin', 'ativo', now(), NEW.id)
    ON CONFLICT (email) DO UPDATE SET status='ativo', activated_at=now(), activated_user_id=NEW.id;

    INSERT INTO public.access_logs (email, user_id, action, success, reason, provider)
    VALUES (user_email, NEW.id, 'signup', true, 'bootstrap admin', NEW.raw_app_meta_data ->> 'provider');
    RETURN NEW;
  END IF;

  -- Verifica se email está autorizado
  SELECT * INTO authorized FROM public.authorized_emails WHERE lower(email) = user_email LIMIT 1;

  IF authorized.id IS NOT NULL AND authorized.status <> 'bloqueado' THEN
    -- Atribui o papel definido
    INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, authorized.role)
      ON CONFLICT DO NOTHING;
    UPDATE public.authorized_emails
      SET status='ativo', activated_at=now(), activated_user_id=NEW.id
      WHERE id = authorized.id;
    INSERT INTO public.access_logs (email, user_id, action, success, provider)
    VALUES (user_email, NEW.id, 'signup', true, NEW.raw_app_meta_data ->> 'provider');
  ELSE
    -- Não autorizado: marca como bloqueado e registra tentativa
    INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'vendedor');
    INSERT INTO public.access_logs (email, user_id, action, success, reason, provider)
    VALUES (user_email, NEW.id, 'login_blocked', false,
      CASE WHEN authorized.id IS NULL THEN 'email não autorizado' ELSE 'email bloqueado' END,
      NEW.raw_app_meta_data ->> 'provider');
    -- Insere na lista como pendente para o admin avaliar
    IF authorized.id IS NULL THEN
      INSERT INTO public.authorized_emails (email, nome, role, status, notes, activated_user_id)
      VALUES (user_email,
              COALESCE(NEW.raw_user_meta_data ->> 'full_name', NEW.raw_user_meta_data ->> 'name', NEW.email),
              'vendedor', 'pendente',
              'Tentativa de acesso não autorizado - aguardando aprovação',
              NEW.id);
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

-- Garantir que o trigger esteja ativo
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Função utilitária para o app verificar se o usuário atual está autorizado
CREATE OR REPLACE FUNCTION public.is_current_user_authorized()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.authorized_emails ae
    JOIN auth.users u ON lower(u.email) = lower(ae.email)
    WHERE u.id = auth.uid() AND ae.status = 'ativo'
  );
$$;