// Wrapper offline-aware para escritas no Supabase.
// Se navigator.onLine === false, enfileira no outbox e devolve um "fake success"
// que mantém o fluxo do app funcionando (toast informa pendência).

import { supabase } from "@/integrations/supabase/client";
import { enqueue, OutboxTable } from "./outbox";
import { toast } from "sonner";

interface WriteResult {
  data: any;
  error: any;
  pending: boolean;
}

export async function offlineInsert(table: OutboxTable, payload: any): Promise<WriteResult> {
  if (!navigator.onLine) {
    await enqueue({ table, op: "insert", payload });
    toast.info("Sem internet — salvo localmente. Sincronizaremos quando voltar.");
    return { data: { ...payload, id: `pending-${Date.now()}` }, error: null, pending: true };
  }
  const q: any = supabase.from(table as any);
  const { data, error } = await q.insert(payload).select().maybeSingle();
  return { data, error, pending: false };
}

export async function offlineUpdate(table: OutboxTable, payload: any, match: { column: string; value: any }): Promise<WriteResult> {
  if (!navigator.onLine) {
    await enqueue({ table, op: "update", payload, match });
    toast.info("Sem internet — alteração salva localmente.");
    return { data: payload, error: null, pending: true };
  }
  const q: any = supabase.from(table as any);
  const { data, error } = await q.update(payload).eq(match.column, match.value).select().maybeSingle();
  return { data, error, pending: false };
}

export async function offlineDelete(table: OutboxTable, match: { column: string; value: any }): Promise<WriteResult> {
  if (!navigator.onLine) {
    await enqueue({ table, op: "delete", payload: {}, match });
    toast.info("Sem internet — exclusão registrada localmente.");
    return { data: null, error: null, pending: true };
  }
  const q: any = supabase.from(table as any);
  const { error } = await q.delete().eq(match.column, match.value);
  return { data: null, error, pending: false };
}
