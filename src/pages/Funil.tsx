import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { captureLocation } from "@/hooks/useGeolocation";
import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Pencil, Trash2, MapPin } from "lucide-react";
import { toast } from "sonner";
import { fmtMoney } from "@/lib/format";
import { cn } from "@/lib/utils";
import { SearchableSelect } from "@/components/SearchableSelect";

const STAGES = [
  { id: "lead", label: "Lead", color: "bg-secondary" },
  { id: "qualificado", label: "Qualificado", color: "bg-primary/15" },
  { id: "proposta", label: "Proposta", color: "bg-warning/20" },
  { id: "negociacao", label: "Negociação", color: "bg-accent/20" },
  { id: "ganho", label: "Ganho", color: "bg-success/20" },
  { id: "perdido", label: "Perdido", color: "bg-destructive/15" },
] as const;

type Stage = typeof STAGES[number]["id"];

export default function Funil() {
  const { user, role } = useAuth();
  const isAdmin = role === "admin";
  const [items, setItems] = useState<any[]>([]);
  const [clientes, setClientes] = useState<any[]>([]);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [form, setForm] = useState<any>({ estagio: "lead", probabilidade: 20, valor: 0 });
  const [busy, setBusy] = useState(false);
  const [dragId, setDragId] = useState<string | null>(null);

  useEffect(() => { load(); }, []);
  const load = async () => {
    const [{ data: ops }, { data: cls }] = await Promise.all([
      supabase.from("oportunidades").select("*, clientes(nome)").order("posicao"),
      supabase.from("clientes").select("id, nome, codigo_externo, empresa, cidade, estado").order("nome"),
    ]);
    setItems(ops || []); setClientes(cls || []);
  };

  const openNew = () => { setEditing(null); setForm({ estagio: "lead", probabilidade: 20, valor: 0 }); setOpen(true); };
  const openEdit = (it: any) => {
    setEditing(it);
    setForm({
      titulo: it.titulo,
      descricao: it.descricao,
      cliente_id: it.cliente_id,
      valor: it.valor,
      estagio: it.estagio,
      probabilidade: it.probabilidade,
      data_fechamento_prevista: it.data_fechamento_prevista,
    });
    setOpen(true);
  };

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.titulo) { toast.error("Informe um título"); return; }
    setBusy(true);
    const payload: any = {
      titulo: form.titulo,
      descricao: form.descricao || null,
      cliente_id: form.cliente_id || null,
      valor: Number(form.valor || 0),
      estagio: form.estagio,
      probabilidade: Number(form.probabilidade || 20),
      data_fechamento_prevista: form.data_fechamento_prevista || null,
    };
    let error: any = null;
    if (editing) {
      ({ error } = await supabase.from("oportunidades").update(payload).eq("id", editing.id));
    } else {
      const geo = await captureLocation(null, { reason: "cadastro_oportunidade" });
      ({ error } = await supabase.from("oportunidades").insert({ ...payload, owner_id: user!.id, ...geo }));
    }
    setBusy(false);
    if (error) toast.error(error.message);
    else { toast.success(editing ? "Oportunidade atualizada" : "Oportunidade criada"); setOpen(false); load(); }
  };

  const moveTo = async (id: string, stage: Stage) => {
    const item = items.find((i) => i.id === id);
    if (!item || item.estagio === stage) return;
    setItems(items.map((i) => i.id === id ? { ...i, estagio: stage } : i));
    const { error } = await supabase.from("oportunidades").update({ estagio: stage }).eq("id", id);
    if (error) { toast.error(error.message); load(); }
  };

  const remove = async (id: string) => {
    if (!confirm("Excluir oportunidade?")) return;
    await supabase.from("oportunidades").delete().eq("id", id);
    load();
  };

  return (
    <div>
      <PageHeader title="Funil de Vendas" description="Arraste cards entre as colunas para mover oportunidades" actions={<Button variant="brand" onClick={openNew}><Plus className="h-4 w-4" /> Nova oportunidade</Button>} />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-6">
        {STAGES.map((stage) => {
          const stageItems = items.filter((i) => i.estagio === stage.id);
          const total = stageItems.reduce((s, i) => s + Number(i.valor), 0);
          return (
            <div
              key={stage.id}
              className={cn("rounded-xl border bg-card/60 p-3 min-h-[400px]", "flex flex-col")}
              onDragOver={(e) => e.preventDefault()}
              onDrop={() => dragId && moveTo(dragId, stage.id)}
            >
              <div className={cn("rounded-lg px-3 py-2 mb-3", stage.color)}>
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold uppercase tracking-wider">{stage.label}</span>
                  <span className="text-xs font-semibold bg-background/60 rounded-full px-2 py-0.5">{stageItems.length}</span>
                </div>
                <div className="text-xs font-semibold mt-0.5">{fmtMoney(total)}</div>
              </div>

              <div className="space-y-2 flex-1">
                {stageItems.map((it) => (
                  <Card
                    key={it.id}
                    draggable
                    onDragStart={() => setDragId(it.id)}
                    onDragEnd={() => setDragId(null)}
                    className="p-3 shadow-soft cursor-grab active:cursor-grabbing hover:shadow-elevated transition-shadow"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="text-sm font-semibold leading-tight flex-1 min-w-0">{it.titulo}</div>
                      <div className="flex gap-0.5 shrink-0">
                        <button type="button" onClick={(e) => { e.stopPropagation(); openEdit(it); }} className="text-muted-foreground hover:text-primary p-0.5" title="Editar"><Pencil className="h-3.5 w-3.5" /></button>
                        <button type="button" onClick={(e) => { e.stopPropagation(); remove(it.id); }} className="text-muted-foreground hover:text-destructive p-0.5" title="Excluir"><Trash2 className="h-3.5 w-3.5" /></button>
                      </div>
                    </div>
                    {it.clientes?.nome && <div className="text-xs text-muted-foreground mt-1">{it.clientes.nome}</div>}
                    <div className="mt-2 flex items-center justify-between">
                      <span className="text-sm font-bold text-primary">{fmtMoney(it.valor)}</span>
                      <span className="text-[10px] text-muted-foreground">{it.probabilidade}%</span>
                    </div>
                    {isAdmin && it.geo_lat && (
                      <div className="mt-1 text-[10px] text-muted-foreground flex items-center gap-1">
                        <MapPin className="h-3 w-3" /> Localização registrada
                      </div>
                    )}
                  </Card>
                ))}
                {stageItems.length === 0 && <div className="text-xs text-muted-foreground text-center py-6 opacity-60">Vazio</div>}
              </div>
            </div>
          );
        })}
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>{editing ? "Editar oportunidade" : "Nova oportunidade"}</DialogTitle></DialogHeader>
          <form onSubmit={save} className="grid gap-4 sm:grid-cols-2">
            <div className="sm:col-span-2 space-y-2"><Label>Título *</Label><Input value={form.titulo || ""} onChange={(e) => setForm({ ...form, titulo: e.target.value })} required maxLength={200} /></div>
            <div className="sm:col-span-2 space-y-2">
              <Label>Cliente</Label>
              <SearchableSelect
                options={clientes.map((c) => ({
                  value: c.id,
                  label: c.nome,
                  hint: [c.codigo_externo && `#${c.codigo_externo}`, c.empresa, [c.cidade, c.estado].filter(Boolean).join("/")].filter(Boolean).join(" · "),
                }))}
                value={form.cliente_id}
                onChange={(v) => setForm({ ...form, cliente_id: v })}
                placeholder="Opcional — buscar cliente..."
              />
            </div>
            <div className="space-y-2"><Label>Valor (R$)</Label><Input type="number" step="0.01" min="0" value={form.valor} onChange={(e) => setForm({ ...form, valor: e.target.value })} /></div>
            <div className="space-y-2">
              <Label>Estágio</Label>
              <Select value={form.estagio} onValueChange={(v) => setForm({ ...form, estagio: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{STAGES.map((s) => <SelectItem key={s.id} value={s.id}>{s.label}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-2"><Label>Probabilidade (%)</Label><Input type="number" min="0" max="100" value={form.probabilidade} onChange={(e) => setForm({ ...form, probabilidade: e.target.value })} /></div>
            <div className="space-y-2"><Label>Fechamento previsto</Label><Input type="date" value={form.data_fechamento_prevista || ""} onChange={(e) => setForm({ ...form, data_fechamento_prevista: e.target.value })} /></div>
            <div className="sm:col-span-2 space-y-2"><Label>Descrição</Label><Textarea value={form.descricao || ""} onChange={(e) => setForm({ ...form, descricao: e.target.value })} maxLength={2000} rows={3} /></div>
            <DialogFooter className="sm:col-span-2">
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
              <Button type="submit" variant="brand" disabled={busy}>{busy ? "Salvando..." : (editing ? "Atualizar" : "Criar")}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
