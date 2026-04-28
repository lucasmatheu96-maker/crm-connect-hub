ALTER TABLE public.clientes
  ADD COLUMN IF NOT EXISTS codigo_externo text,
  ADD COLUMN IF NOT EXISTS razao_social text,
  ADD COLUMN IF NOT EXISTS nome_fantasia text,
  ADD COLUMN IF NOT EXISTS uf text,
  ADD COLUMN IF NOT EXISTS vendedor_responsavel text,
  ADD COLUMN IF NOT EXISTS status_financeiro text;

CREATE INDEX IF NOT EXISTS idx_clientes_codigo_externo ON public.clientes(codigo_externo);
CREATE INDEX IF NOT EXISTS idx_clientes_cpf_cnpj ON public.clientes(cpf_cnpj);

ALTER TABLE public.produtos
  ADD COLUMN IF NOT EXISTS codigo_externo text,
  ADD COLUMN IF NOT EXISTS unidade text,
  ADD COLUMN IF NOT EXISTS preco_sugerido numeric,
  ADD COLUMN IF NOT EXISTS disponivel numeric;

CREATE INDEX IF NOT EXISTS idx_produtos_codigo_externo ON public.produtos(codigo_externo);
CREATE INDEX IF NOT EXISTS idx_produtos_sku ON public.produtos(sku);

ALTER TABLE public.orcamentos
  ADD COLUMN IF NOT EXISTS codigo_externo text,
  ADD COLUMN IF NOT EXISTS data_documento date,
  ADD COLUMN IF NOT EXISTS prioridade text,
  ADD COLUMN IF NOT EXISTS nfe_seq text,
  ADD COLUMN IF NOT EXISTS data_situacao timestamptz,
  ADD COLUMN IF NOT EXISTS responsavel_documento text,
  ADD COLUMN IF NOT EXISTS empresa_cadastro text,
  ADD COLUMN IF NOT EXISTS finalidade text,
  ADD COLUMN IF NOT EXISTS status_externo text;

CREATE INDEX IF NOT EXISTS idx_orcamentos_codigo_externo ON public.orcamentos(codigo_externo);

ALTER TABLE public.pedidos
  ADD COLUMN IF NOT EXISTS codigo_externo text,
  ADD COLUMN IF NOT EXISTS data_documento date,
  ADD COLUMN IF NOT EXISTS prioridade text,
  ADD COLUMN IF NOT EXISTS nfe_seq text,
  ADD COLUMN IF NOT EXISTS data_situacao timestamptz,
  ADD COLUMN IF NOT EXISTS responsavel_documento text,
  ADD COLUMN IF NOT EXISTS empresa_cadastro text,
  ADD COLUMN IF NOT EXISTS finalidade text,
  ADD COLUMN IF NOT EXISTS status_externo text;

CREATE INDEX IF NOT EXISTS idx_pedidos_codigo_externo ON public.pedidos(codigo_externo);