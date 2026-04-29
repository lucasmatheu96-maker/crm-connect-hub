ALTER TABLE public.orcamentos
  ADD COLUMN IF NOT EXISTS forma_pagamento text,
  ADD COLUMN IF NOT EXISTS prazo_entrega text,
  ADD COLUMN IF NOT EXISTS frete text;

ALTER TABLE public.pedidos
  ADD COLUMN IF NOT EXISTS forma_pagamento text,
  ADD COLUMN IF NOT EXISTS prazo_entrega text,
  ADD COLUMN IF NOT EXISTS frete text;