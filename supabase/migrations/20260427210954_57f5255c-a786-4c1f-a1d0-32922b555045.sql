-- 1. Adicionar coluna source nas tabelas principais
ALTER TABLE public.clientes  ADD COLUMN IF NOT EXISTS source text NOT NULL DEFAULT 'app';
ALTER TABLE public.produtos  ADD COLUMN IF NOT EXISTS source text NOT NULL DEFAULT 'app';
ALTER TABLE public.orcamentos ADD COLUMN IF NOT EXISTS source text NOT NULL DEFAULT 'app';
ALTER TABLE public.pedidos    ADD COLUMN IF NOT EXISTS source text NOT NULL DEFAULT 'app';

-- 2. Índices únicos parciais para deduplicação por CPF/CNPJ e SKU
CREATE UNIQUE INDEX IF NOT EXISTS clientes_cpfcnpj_unique
  ON public.clientes (lower(cpf_cnpj)) WHERE cpf_cnpj IS NOT NULL AND cpf_cnpj <> '';
CREATE UNIQUE INDEX IF NOT EXISTS produtos_sku_unique
  ON public.produtos (lower(sku)) WHERE sku IS NOT NULL AND sku <> '';

-- 3. Atualizar RLS: registros vindos da planilha só admin pode editar/deletar
-- CLIENTES
DROP POLICY IF EXISTS clientes_update ON public.clientes;
DROP POLICY IF EXISTS clientes_delete ON public.clientes;
CREATE POLICY clientes_update ON public.clientes FOR UPDATE TO authenticated
  USING (
    has_role(auth.uid(), 'admin'::app_role)
    OR (auth.uid() = owner_id AND source <> 'sheet')
  );
CREATE POLICY clientes_delete ON public.clientes FOR DELETE TO authenticated
  USING (
    has_role(auth.uid(), 'admin'::app_role)
    OR (auth.uid() = owner_id AND source <> 'sheet')
  );

-- PRODUTOS
DROP POLICY IF EXISTS produtos_update ON public.produtos;
DROP POLICY IF EXISTS produtos_delete ON public.produtos;
CREATE POLICY produtos_update ON public.produtos FOR UPDATE TO authenticated
  USING (
    has_role(auth.uid(), 'admin'::app_role)
    OR (auth.uid() = owner_id AND source <> 'sheet')
  );
CREATE POLICY produtos_delete ON public.produtos FOR DELETE TO authenticated
  USING (
    has_role(auth.uid(), 'admin'::app_role)
    OR (auth.uid() = owner_id AND source <> 'sheet')
  );

-- ORCAMENTOS
DROP POLICY IF EXISTS orcamentos_update ON public.orcamentos;
DROP POLICY IF EXISTS orcamentos_delete ON public.orcamentos;
CREATE POLICY orcamentos_update ON public.orcamentos FOR UPDATE TO authenticated
  USING (
    has_role(auth.uid(), 'admin'::app_role)
    OR (auth.uid() = owner_id AND source <> 'sheet')
  );
CREATE POLICY orcamentos_delete ON public.orcamentos FOR DELETE TO authenticated
  USING (
    has_role(auth.uid(), 'admin'::app_role)
    OR (auth.uid() = owner_id AND source <> 'sheet')
  );

-- PEDIDOS
DROP POLICY IF EXISTS pedidos_update ON public.pedidos;
DROP POLICY IF EXISTS pedidos_delete ON public.pedidos;
CREATE POLICY pedidos_update ON public.pedidos FOR UPDATE TO authenticated
  USING (
    has_role(auth.uid(), 'admin'::app_role)
    OR (auth.uid() = owner_id AND source <> 'sheet')
  );
CREATE POLICY pedidos_delete ON public.pedidos FOR DELETE TO authenticated
  USING (
    has_role(auth.uid(), 'admin'::app_role)
    OR (auth.uid() = owner_id AND source <> 'sheet')
  );