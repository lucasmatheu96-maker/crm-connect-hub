// Fila offline (outbox) com IndexedDB nativo.
// Quando o app está sem internet, escritas (insert/update/delete) são salvas localmente
// e replicadas para o Supabase ao voltar online.

import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

const DB_NAME = "lovable-outbox";
const STORE = "outbox";
const VERSION = 1;

export type OutboxOp = "insert" | "update" | "delete";
export type OutboxTable = "clientes" | "produtos" | "orcamentos" | "pedidos" | "orcamento_itens" | "pedido_itens";

export interface OutboxItem {
  id?: number;
  table: OutboxTable;
  op: OutboxOp;
  payload: any;
  match?: { column: string; value: any }; // para update/delete
  createdAt: number;
  tries: number;
  lastError?: string;
}

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) {
        db.createObjectStore(STORE, { keyPath: "id", autoIncrement: true });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function tx<T>(mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest<T> | Promise<T>): Promise<T> {
  const db = await openDB();
  return new Promise<T>((resolve, reject) => {
    const t = db.transaction(STORE, mode);
    const store = t.objectStore(STORE);
    const r = fn(store);
    if (r instanceof IDBRequest) {
      r.onsuccess = () => resolve(r.result);
      r.onerror = () => reject(r.error);
    } else {
      Promise.resolve(r).then(resolve, reject);
    }
  });
}

export async function enqueue(item: Omit<OutboxItem, "id" | "createdAt" | "tries">): Promise<number> {
  const full: OutboxItem = { ...item, createdAt: Date.now(), tries: 0 };
  const id = await tx<IDBValidKey>("readwrite", (s) => s.add(full));
  notifyChange();
  return Number(id);
}

export async function listAll(): Promise<OutboxItem[]> {
  return tx<OutboxItem[]>("readonly", (s) => s.getAll() as IDBRequest<OutboxItem[]>);
}

export async function count(): Promise<number> {
  return tx<number>("readonly", (s) => s.count());
}

async function remove(id: number): Promise<void> {
  await tx<undefined>("readwrite", (s) => s.delete(id) as any);
  notifyChange();
}

async function update(item: OutboxItem): Promise<void> {
  await tx<IDBValidKey>("readwrite", (s) => s.put(item));
  notifyChange();
}

const listeners = new Set<() => void>();
export function subscribe(cb: () => void): () => void {
  listeners.add(cb);
  return () => listeners.delete(cb);
}
function notifyChange() {
  listeners.forEach((l) => l());
}

let syncing = false;

export async function flush(): Promise<{ ok: number; fail: number; remaining: number }> {
  if (syncing) return { ok: 0, fail: 0, remaining: await count() };
  if (!navigator.onLine) return { ok: 0, fail: 0, remaining: await count() };
  syncing = true;
  let ok = 0, fail = 0;
  try {
    const items = await listAll();
    items.sort((a, b) => a.createdAt - b.createdAt);
    for (const it of items) {
      try {
        let q: any = supabase.from(it.table);
        if (it.op === "insert") {
          const { error } = await q.insert(it.payload);
          if (error) throw error;
        } else if (it.op === "update") {
          if (!it.match) throw new Error("update sem match");
          const { error } = await q.update(it.payload).eq(it.match.column, it.match.value);
          if (error) throw error;
        } else if (it.op === "delete") {
          if (!it.match) throw new Error("delete sem match");
          const { error } = await q.delete().eq(it.match.column, it.match.value);
          if (error) throw error;
        }
        await remove(it.id!);
        ok++;
      } catch (e: any) {
        it.tries = (it.tries || 0) + 1;
        it.lastError = e?.message || String(e);
        if (it.tries >= 5) {
          await remove(it.id!);
          console.error("outbox: descartado após 5 tentativas", it);
        } else {
          await update(it);
        }
        fail++;
      }
    }
  } finally {
    syncing = false;
  }
  const remaining = await count();
  return { ok, fail, remaining };
}

let initialized = false;
export function initOutbox() {
  if (initialized) return;
  initialized = true;
  const trigger = async () => {
    if (!navigator.onLine) return;
    const c = await count();
    if (!c) return;
    const r = await flush();
    if (r.ok > 0) toast.success(`${r.ok} alteração(ões) sincronizada(s)`);
    if (r.fail > 0 && r.remaining > 0) {
      toast.warning(`${r.remaining} alteração(ões) pendente(s) — tentaremos de novo.`);
    }
  };
  window.addEventListener("online", trigger);
  // tentativa periódica leve
  setInterval(trigger, 30000);
  // primeira tentativa ao carregar
  setTimeout(trigger, 1500);
}
