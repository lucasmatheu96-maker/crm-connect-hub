import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { captureLocation } from "@/hooks/useGeolocation";
import { PageHeader } from "@/components/PageHeader";
import { EmptyState } from "@/components/EmptyState";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ShoppingCart, Pencil, Trash2, MapPin, Undo2, Eye } from "lucide-react";
import { toast } from "sonner";
import { fmtMoney, fmtDate } from "@/lib/format";
import { ItensEditor, Item } from "@/components/ItensEditor";
import { offlineUpdate, offlineDelete } from "@/lib/offlineWrite";
import { SearchableSelect } from "@/components/SearchableSelect";
import { DetailsDialog } from "@/components/DetailsDialog";

const STATUSES = ["novo","confirmado","em_separacao","faturado","enviado","entregue","cancelado"] as const;
const statusColor: Record<string, string> = {
  novo: "bg-secondary text-secondary-foreground",
  confirmado: "bg-primary text-primary-foreground",
  em_separacao: "bg-warning text-warning-foreground",
  faturado: "bg-primary text-primary-foreground",
  enviado: "bg-primary-glow text-primary-foreground",
  entregue: "bg-success text-success-foreground",
  cancelado: "bg-destructive text-destructive-foreground",
};

export default function Pedidos() {
  const { role } = useAuth();
  const isAdmin = role === "admin";
  const [list, setList] = useState<any[]>([]);
  const [clientes, setClientes] = useState<any[]>([]);
  const [vendedores, setVendedores] = useState<any[]>([]);
  const [filtroVendedor, setFiltroVendedor] = useState<string>("todos");
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [form, setForm] = useState<any>({ status: "novo", desconto: 0 });
  const [itens, setItens] = useState<Item[]>([]);
  const [busy, setBusy] = useState(false);
  const [viewing, setViewing] = useState<any>(null);
  const [viewItens, setViewItens] = useState<any[]>([]);

  const openView = async (p: any) => {
    setViewing(p);
    const { data } = await supabase.from("pedido_itens").select("*").eq("pedido_id", p.id);
    setViewItens(data || []);
  };

  useEffect(() => { load(); }, []);
  const load = async () => {
    setLoading(true);
    const [{ data: peds }, { data: cls }, { data: profs }] = await Promise.all([
      supabase.from("pedidos").select("*, clientes(nome)").order("created_at", { ascending: false }),
      supabase.from("clientes").select("id, nome, codigo_externo, empresa, cidade, estado").order("nome"),
      supabase.from("profiles").select("user_id, nome").order("nome"),
    ]);
    const profMap = new Map((profs || []).map((p: any) => [p.user_id, p.nome]));
    const enriched = (peds || []).map((p: any) => ({ ...p, _vendedorNome: profMap.get(p.owner_id) || "—" }));
    setList(enriched); setClientes(cls || []); setVendedores(profs || []); setLoading(false);
  };

  const listFiltrada = filtroVendedor === "todos" ? list : list.filter((p) => p.owner_id === filtroVendedor);

  const openEdit = async (p: any) => {
    if (!isAdmin) return;
    setEditing(p); setForm(p);
    const { data } = await supabase.from("pedido_itens").select("*").eq("pedido_id", p.id);
    setItens((data || []).map((i: any) => ({ produto_id: i.produto_id, descricao: i.descricao, quantidade: Number(i.quantidade), preco_unitario: Number(i.preco_unitario) })));
    setOpen(true);
  };

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isAdmin || !editing) return;
    if (!form.cliente_id) { toast.error("Selecione um cliente"); return; }
    if (itens.length === 0) { toast.error("Adicione ao menos um item"); return; }
    setBusy(true);
    const subtotal = itens.reduce((s, i) => s + i.quantidade * i.preco_unitario, 0);
    const total = Math.max(0, subtotal - Number(form.desconto || 0));
    const payload: any = {
      cliente_id: form.cliente_id, status: form.status,
      desconto: Number(form.desconto || 0), total,
      observacoes: form.observacoes || null,
    };
    const { error } = await offlineUpdate("pedidos", payload, { column: "id", value: editing.id });
    if (error) { toast.error(error.message); setBusy(false); return; }
    if (navigator.onLine) {
      await supabase.from("pedido_itens").delete().eq("pedido_id", editing.id);
    } else {
      await offlineDelete("pedido_itens", { column: "pedido_id", value: editing.id });
    }
    for (const i of itens) {
      await supabase.from("pedido_itens").insert({
        pedido_id: editing.id, produto_id: i.produto_id || null,
        descricao: i.descricao || "Item", quantidade: i.quantidade,
        preco_unitario: i.preco_unitario, subtotal: i.quantidade * i.preco_unitario,
      });
    }
    setBusy(false); setOpen(false); load();
    toast.success("Pedido atualizado");
  };

  const remove = async (id: string) => {
    if (!isAdmin) { toast.error("Apenas administradores podem excluir"); return; }
    if (!confirm("Excluir pedido?")) return;
    const { error } = await offlineDelete("pedidos", { column: "id", value: id });
    if (error) toast.error(error.message); else { toast.success("Excluído"); load(); }
  };

  const revertToOrcamento = async (p: any) => {
    if (!confirm(`Reverter pedido #${p.numero} para orçamento?`)) return;
    // Cria orçamento espelho
    const { data: orc, error: errOrc } = await supabase.from("orcamentos").insert({
      cliente_id: p.cliente_id,
      owner_id: p.owner_id,
      status: "rascunho",
      desconto: p.desconto || 0,
      total: p.total || 0,
      observacoes: p.observacoes || null,
    }).select("id, numero").single();
    if (errOrc || !orc) { toast.error(errOrc?.message || "Falha ao criar orçamento"); return; }

    // Copia itens
    const { data: itensPed } = await supabase.from("pedido_itens").select("*").eq("pedido_id", p.id);
    if (itensPed && itensPed.length > 0) {
      const novos = itensPed.map((i: any) => ({
        orcamento_id: orc.id,
        produto_id: i.produto_id,
        descricao: i.descricao,
        quantidade: i.quantidade,
        preco_unitario: i.preco_unitario,
        subtotal: i.subtotal,
      }));
      await supabase.from("orcamento_itens").insert(novos);
    }

    // Remove pedido original
    const { error: errDel } = await supabase.from("pedidos").delete().eq("id", p.id);
    if (errDel) { toast.error("Orçamento criado, mas falhou ao remover pedido: " + errDel.message); return; }

    toast.success(`Pedido revertido para orçamento #${orc.numero}`);
    load();
  };

  return (
    <div>
      <PageHeader title="Pedidos" description="Acompanhamento de vendas e entregas" />

      <Card className="p-4 shadow-elevated">
        <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div className="text-sm text-muted-foreground">{listFiltrada.length} pedido(s)</div>
          <div className="flex items-center gap-2">
            <Label className="text-xs whitespace-nowrap">Vendedor:</Label>
            <Select value={filtroVendedor} onValueChange={setFiltroVendedor}>
              <SelectTrigger className="h-9 w-full sm:w-56"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos</SelectItem>
                {vendedores.map((v) => <SelectItem key={v.user_id} value={v.user_id}>{v.nome}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </div>
        {loading ? <div className="py-8 text-center text-sm text-muted-foreground">Carregando...</div>
          : listFiltrada.length === 0 ? <EmptyState icon={ShoppingCart} title="Nenhum pedido" description="Pedidos são gerados a partir de orçamentos aprovados." />
          : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {listFiltrada.map((p) => (
              <Card key={p.id} className="p-4 hover:shadow-elevated transition-shadow min-w-0 overflow-hidden">
                <div className="flex items-start justify-between gap-2 min-w-0">
                  <div className="min-w-0 flex-1">
                    <div className="font-mono text-xs text-muted-foreground">#{p.numero}</div>
                    <div className="font-medium truncate" title={p.clientes?.nome || "—"}>{p.clientes?.nome || "—"}</div>
                    <div className="text-xs text-muted-foreground truncate" title={`Vend.: ${p._vendedorNome}`}>Vend.: {p._vendedorNome}</div>
                  </div>
                  <Badge className={`${statusColor[p.status]} shrink-0`}>{p.status.replace("_"," ")}</Badge>
                </div>
                <div className="mt-3 flex items-end justify-between gap-2 min-w-0">
                  <div className="min-w-0">
                    <div className="text-[10px] uppercase text-muted-foreground tracking-wide">Total</div>
                    <div className="text-lg font-semibold truncate">{fmtMoney(p.total)}</div>
                  </div>
                  <div className="text-right text-xs text-muted-foreground shrink-0 inline-flex items-center gap-1">
                    <span>{fmtDate(p.created_at)}</span>
                    {isAdmin && p.geo_lat && p.geo_lng && (
                      <a href={`https://www.google.com/maps?q=${p.geo_lat},${p.geo_lng}`} target="_blank" rel="noreferrer" className="inline-flex" title="Ver no mapa">
                        <MapPin className="h-3 w-3 text-primary" />
                      </a>
                    )}
                  </div>
                </div>
                <div className="mt-3 flex justify-end gap-1 border-t pt-2 min-w-0">
                  <Button size="sm" variant="ghost" title="Ver detalhes" onClick={() => openView(p)}><Eye className="h-4 w-4" /></Button>
                  <Button size="sm" variant="ghost" onClick={() => revertToOrcamento(p)} title="Reverter para orçamento">
                    <Undo2 className="h-4 w-4" />
                  </Button>
                  {isAdmin && (
                    <>
                      <Button size="sm" variant="ghost" onClick={() => openEdit(p)}><Pencil className="h-4 w-4" /></Button>
                      <Button size="sm" variant="ghost" onClick={() => remove(p.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                    </>
                  )}
                </div>
              </Card>
            ))}
          </div>
        )}
      </Card>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{editing ? `Pedido #${editing.numero}` : "Pedido"}</DialogTitle></DialogHeader>
          <form onSubmit={save} className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-3">
              <div className="space-y-2 sm:col-span-2">
                <Label>Cliente *</Label>
                <SearchableSelect
                  options={clientes.map((c) => ({
                    value: c.id,
                    label: c.nome,
                    hint: [c.codigo_externo && `#${c.codigo_externo}`, c.empresa, [c.cidade, c.estado].filter(Boolean).join("/")].filter(Boolean).join(" · "),
                  }))}
                  value={form.cliente_id}
                  onChange={(v) => setForm({ ...form, cliente_id: v })}
                  placeholder="Buscar cliente..."
                />
              </div>
              <div className="space-y-2">
                <Label>Status</Label>
                <Select value={form.status} onValueChange={(v) => setForm({ ...form, status: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{STATUSES.map((s) => <SelectItem key={s} value={s}>{s.replace("_"," ")}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-2"><Label>Desconto (R$)</Label><Input type="number" step="0.01" min="0" value={form.desconto || 0} onChange={(e) => setForm({ ...form, desconto: e.target.value })} /></div>
            </div>

            <ItensEditor itens={itens} onChange={setItens} />

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
              <Button type="submit" variant="brand" disabled={busy}>{busy ? "Salvando..." : "Salvar"}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <DetailsDialog
        open={!!viewing}
        onOpenChange={(v) => { if (!v) { setViewing(null); setViewItens([]); } }}
        title={viewing ? `Pedido #${viewing.numero}` : "Pedido"}
        rows={viewing ? [
          { label: "Cliente", value: viewing.clientes?.nome },
          { label: "Vendedor", value: viewing._vendedorNome },
          { label: "Status", value: String(viewing.status || "").replace("_"," ") },
          { label: "Desconto", value: fmtMoney(viewing.desconto || 0) },
          { label: "Total", value: fmtMoney(viewing.total || 0) },
          { label: "Criado em", value: fmtDate(viewing.created_at) },
          { label: "Observações", value: viewing.observacoes },
        ] : []}
        extra={viewItens.length > 0 && (
          <div>
            <div className="text-[10px] uppercase tracking-wide text-muted-foreground mb-2">Itens</div>
            <div className="space-y-1">
              {viewItens.map((i: any) => (
                <div key={i.id} className="flex items-center justify-between text-sm border-b py-1">
                  <span className="truncate">{i.descricao}</span>
                  <span className="text-muted-foreground shrink-0 ml-2">{i.quantidade} × {fmtMoney(i.preco_unitario)} = <strong>{fmtMoney(i.subtotal)}</strong></span>
                </div>
              ))}
            </div>
          </div>
        )}
      />
    </div>
  );
}
