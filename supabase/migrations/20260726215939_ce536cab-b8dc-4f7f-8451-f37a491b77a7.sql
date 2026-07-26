CREATE TABLE public.agenda (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL DEFAULT auth.uid(),
  titulo text NOT NULL,
  descricao text,
  data date NOT NULL DEFAULT (now() AT TIME ZONE 'America/Sao_Paulo')::date,
  hora time,
  concluido boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.agenda TO authenticated;
GRANT ALL ON public.agenda TO service_role;

ALTER TABLE public.agenda ENABLE ROW LEVEL SECURITY;

CREATE POLICY "agenda_select_own_or_admin" ON public.agenda
  FOR SELECT TO authenticated
  USING (owner_id = auth.uid() OR public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "agenda_insert_own" ON public.agenda
  FOR INSERT TO authenticated
  WITH CHECK (owner_id = auth.uid());

CREATE POLICY "agenda_update_own_or_admin" ON public.agenda
  FOR UPDATE TO authenticated
  USING (owner_id = auth.uid() OR public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (owner_id = auth.uid() OR public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "agenda_delete_own_or_admin" ON public.agenda
  FOR DELETE TO authenticated
  USING (owner_id = auth.uid() OR public.has_role(auth.uid(), 'admin'::app_role));

CREATE INDEX idx_agenda_owner_data ON public.agenda (owner_id, data);

CREATE TRIGGER update_agenda_updated_at
  BEFORE UPDATE ON public.agenda
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();