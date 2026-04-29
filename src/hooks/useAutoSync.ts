import { useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { subscribe as subscribeOutbox, count as outboxCount } from "@/lib/outbox";

const TABLES = ["clientes", "produtos", "orcamentos", "pedidos", "orcamento_itens", "pedido_itens", "oportunidades"] as const;
const DEBOUNCE_MS = 8000; // agrupa rajadas em 8s
const MIN_INTERVAL_MS = 30 * 1000; // mínimo 30s entre syncs
const RETRY_OFFLINE_MS = 60 * 1000;

let lastSyncAt = 0;
let inFlight = false;

async function trigger(reason: string) {
  if (!navigator.onLine) return;
  if (inFlight) return;
  if (Date.now() - lastSyncAt < MIN_INTERVAL_MS) return;
  // só sincroniza se habilitado
  const { data: cfg } = await supabase.from("app_settings").select("sync_enabled, google_sheet_id").eq("id", 1).maybeSingle();
  if (!cfg?.sync_enabled || !cfg?.google_sheet_id) return;
  inFlight = true;
  try {
    await supabase.functions.invoke("sync-sheets");
    lastSyncAt = Date.now();
    console.info(`[autosync] sincronizado (${reason})`);
  } catch (e) {
    console.warn("[autosync] falha:", e);
  } finally {
    inFlight = false;
  }
}

/**
 * Sincronização automática com Google Sheets:
 * - Após qualquer alteração local em tabelas-chave (insert/update/delete via Postgres realtime).
 * - Sempre que houver alterações pendentes no outbox que acabaram de ser enviadas (online).
 * - Periodicamente, como rede de segurança.
 */
export function useAutoSync() {
  const { user, role } = useAuth();
  const debounceRef = useRef<number | null>(null);

  const schedule = (reason: string) => {
    if (debounceRef.current) window.clearTimeout(debounceRef.current);
    debounceRef.current = window.setTimeout(() => trigger(reason), DEBOUNCE_MS);
  };

  // Realtime: escuta mudanças nas tabelas e dispara sync
  useEffect(() => {
    if (!user?.id) return;
    const channel = supabase.channel("autosync-watcher");
    for (const t of TABLES) {
      channel.on("postgres_changes" as any, { event: "*", schema: "public", table: t }, () => {
        schedule(`change:${t}`);
      });
    }
    channel.subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [user?.id]);

  // Outbox: quando ele esvazia (online), sincroniza
  useEffect(() => {
    if (!user?.id) return;
    let prev = -1;
    const unsub = subscribeOutbox(async () => {
      const c = await outboxCount();
      if (prev > 0 && c === 0 && navigator.onLine) {
        schedule("outbox flushed");
      }
      prev = c;
    });
    // estado inicial
    outboxCount().then((c) => { prev = c; });
    return () => unsub();
  }, [user?.id]);

  // Voltar online → tenta sincronizar (caso outbox tenha ficado pendente)
  useEffect(() => {
    if (!user?.id) return;
    const onOnline = () => schedule("online");
    window.addEventListener("online", onOnline);
    // verificação periódica leve, caso haja pendências sem realtime
    const id = window.setInterval(async () => {
      if (!navigator.onLine) return;
      const c = await outboxCount();
      if (c > 0) trigger("periodic with pending");
    }, RETRY_OFFLINE_MS);
    return () => {
      window.removeEventListener("online", onOnline);
      window.clearInterval(id);
    };
  }, [user?.id, role]);
}
