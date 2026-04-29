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
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, FileText, Pencil, Trash2, MapPin, ArrowRight, Eye } from "lucide-react";
import { toast } from "sonner";
import { fmtMoney, fmtDate } from "@/lib/format";
import { ItensEditor, Item } from "@/components/ItensEditor";
import { openMapLocation } from "@/lib/maps";
import { offlineInsert, offlineUpdate, offlineDelete } from "@/lib/offlineWrite";
import { SearchableSelect } from "@/components/SearchableSelect";
import { DetailsDialog } from "@/components/DetailsDialog";

const STATUSES = ["rascunho","enviado","aprovado","rejeitado","expirado"] as const;
const statusColor: Record<string, string> = {
  rascunho: "bg-secondary text-secondary-foreground",
  enviado: "bg-primary text-primary-foreground",
  aprovado: "bg-success text-success-foreground",
  rejeitado: "bg-destructive text-destructive-foreground",
  expirado: "bg-muted text-muted-foreground",
};

export default function Orcamentos() {
  const { user, role } = useAuth();
  const isAdmin = role === "admin";
  const [list, setList] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [clientes, setClientes] = useState<any[]>([]);
  const [vendedores, setVendedores] = useState<any[]>([]);
  const [filtroVendedor, setFiltroVendedor] = useState<string>("todos");
  const [editing, setEditing] = useState<any>(null);
  const [form, setForm] = useState<any>({ status: "rascunho", desconto: 0 });
  const [itens, setItens] = useState<Item[]>([]);
  const [busy, setBusy] = useState(false);
  const [viewing, setViewing] = useState<any>(null);
  const [viewItens, setViewItens] = useState<any[]>([]);

  const openView = async (o: any) => {
    setViewing(o);
    const { data } = await supabase.from("orcamento_itens").select("*").eq("orcamento_id", o.id);
    setViewItens(data || []);
  };

  useEffect(() => { load(); }, []);

  const load = async () => {
    setLoading(true);
    const [{ data: orcs }, { data: cls }, { data: peds }, { data: profs }] = await Promise.all([
      supabase.from("orcamentos").select("*, clientes(nome)").order("created_at", { ascending: false }),
      supabase.from("clientes").select("id, nome, codigo_externo, empresa, endereco, cidade, estado, cep").order("nome"),
      supabase.from("pedidos").select("orcamento_id").not("orcamento_id", "is", null),
      supabase.from("profiles").select("user_id, nome").order("nome"),
    ]);
    const pedidoOrcIds = new Set((peds || []).map((p: any) => p.orcamento_id));
    const profMap = new Map((profs || []).map((p: any) => [p.user_id, p.nome]));
    const enriched = (orcs || []).map((o: any) => ({ ...o, _temPedido: pedidoOrcIds.has(o.id), _vendedorNome: profMap.get(o.owner_id) || "—" }));
    setList(enriched); setClientes(cls || []); setVendedores(profs || []); setLoading(false);
  };

  const listFiltrada = filtroVendedor === "todos" ? list : list.filter((o) => o.owner_id === filtroVendedor);

  const getClienteFallbackAddress = (clienteId?: string | null) => {
    const cliente = clientes.find((item) => item.id === clienteId);
    if (!cliente) return null;
    return [cliente.endereco, cliente.cidade, cliente.estado, cliente.cep, "Brasil"].filter(Boolean).join(", ") || null;
  };

  const openNew = () => { setEditing(null); setForm({ status: "rascunho", desconto_pct: 0 }); setItens([]); setOpen(true); };
  const openEdit = async (o: any) => {
    const { data } = await supabase.from("orcamento_itens").select("*").eq("orcamento_id", o.id);
    const itensCarregados = (data || []).map((i: any) => ({ produto_id: i.produto_id, descricao: i.descricao, quantidade: Number(i.quantidade), preco_unitario: Number(i.preco_unitario) }));
    const sub = itensCarregados.reduce((s, i) => s + i.quantidade * i.preco_unitario, 0);
    const pct = sub > 0 ? (Number(o.desconto || 0) / sub) * 100 : 0;
    setEditing(o); setForm({ ...o, desconto_pct: Number(pct.toFixed(2)) });
    setItens(itensCarregados);
    setOpen(true);
  };

  const subtotalAtual = itens.reduce((s, i) => s + Number(i.quantidade) * Number(i.preco_unitario), 0);
  const descontoPctNum = Number(form.desconto_pct || 0);
  const descontoValor = (subtotalAtual * descontoPctNum) / 100;
  const totalCalculado = Math.max(0, subtotalAtual - descontoValor);

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.cliente_id) { toast.error("Selecione um cliente"); return; }
    if (itens.length === 0) { toast.error("Adicione ao menos um item"); return; }
    setBusy(true);

    const payload: any = {
      cliente_id: form.cliente_id,
      status: form.status,
      validade: form.validade || null,
      desconto: Number(descontoValor.toFixed(2)),
      total: Number(totalCalculado.toFixed(2)),
      observacoes: form.observacoes || null,
      owner_id: user!.id,
    };

    let orcamentoId = editing?.id;
    if (editing) {
      const { error } = await offlineUpdate("orcamentos", payload, { column: "id", value: editing.id });
      if (error) { toast.error(error.message); setBusy(false); return; }
      // limpa itens existentes (online) ou enfileira delete por orcamento
      if (navigator.onLine) {
        await supabase.from("orcamento_itens").delete().eq("orcamento_id", editing.id);
      } else {
        await offlineDelete("orcamento_itens", { column: "orcamento_id", value: editing.id });
      }
    } else {
      const geo = await captureLocation(getClienteFallbackAddress(form.cliente_id), { reason: "cadastro_orcamento" });
      // gera UUID local para permitir vincular itens mesmo offline
      orcamentoId = (typeof crypto !== "undefined" && (crypto as any).randomUUID)
        ? (crypto as any).randomUUID()
        : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
      const { error } = await offlineInsert("orcamentos", { id: orcamentoId, ...payload, ...geo });
      if (error) { toast.error(error.message); setBusy(false); return; }
    }

    const itensRows = itens.map((i) => ({
      orcamento_id: orcamentoId,
      produto_id: i.produto_id || null,
      descricao: i.descricao || "Item",
      quantidade: i.quantidade,
      preco_unitario: i.preco_unitario,
      subtotal: i.quantidade * i.preco_unitario,
    }));
    for (const row of itensRows) {
      const { error: e2 } = await offlineInsert("orcamento_itens", row);
      if (e2) { toast.error(e2.message); setBusy(false); return; }
    }

    setBusy(false); setOpen(false); load();
    toast.success(editing ? "Orçamento atualizado" : "Orçamento criado");
  };

  const remove = async (id: string) => {
    if (!confirm("Excluir orçamento?")) return;
    const { error } = await offlineDelete("orcamentos", { column: "id", value: id });
    if (error) toast.error(error.message); else { toast.success("Excluído"); load(); }
  };

  const converterEmPedido = async (o: any) => {
    // Verificação dupla anti-duplicidade: checa no banco no momento do clique
    const { data: existente } = await supabase.from("pedidos").select("id, numero").eq("orcamento_id", o.id).maybeSingle();
    if (existente) {
      toast.error(`Este orçamento já foi convertido no pedido #${existente.numero}`);
      load();
      return;
    }
    if (!confirm(`Converter orçamento #${o.numero} em pedido?`)) return;
    const { data: itensData } = await supabase.from("orcamento_itens").select("*").eq("orcamento_id", o.id);
    const geo = await captureLocation(getClienteFallbackAddress(o.cliente_id), { reason: "conversao_pedido", refTable: "orcamentos", refId: o.id });
    const { data: ped, error } = await supabase.from("pedidos").insert({
      cliente_id: o.cliente_id, orcamento_id: o.id, owner_id: user!.id,
      desconto: o.desconto, total: o.total, observacoes: o.observacoes,
      ...geo,
    }).select("id").single();
    if (error) { toast.error(error.message); return; }
    if (itensData?.length) {
      await supabase.from("pedido_itens").insert(itensData.map((i: any) => ({
        pedido_id: ped.id, produto_id: i.produto_id, descricao: i.descricao,
        quantidade: i.quantidade, preco_unitario: i.preco_unitario, subtotal: i.subtotal,
      })));
    }
    await supabase.from("orcamentos").update({ status: "aprovado" }).eq("id", o.id);
    toast.success("Pedido criado a partir do orçamento");
    load();
  };

  const handleOpenMap = async (lat: number, lng: number) => {
    const { opened } = await openMapLocation(lat, lng);
    if (!opened) toast.info("Não foi possível abrir o mapa aqui. Copiamos o link para você colar no navegador.");
  };

  return (
    <div>
      <PageHeader title="Orçamentos" description="Propostas comerciais e cotações" actions={<Button variant="brand" onClick={openNew}><Plus className="h-4 w-4" /> Novo orçamento</Button>} />

      <Card className="p-4 shadow-elevated">
        <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div className="text-sm text-muted-foreground">{listFiltrada.length} orçamento(s)</div>
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
          : listFiltrada.length === 0 ? <EmptyState icon={FileText} title="Nenhum orçamento" description="Crie propostas comerciais com itens e valores." action={<Button variant="brand" onClick={openNew}><Plus className="h-4 w-4" /> Novo orçamento</Button>} />
          : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {listFiltrada.map((o) => (
              <Card key={o.id} className="p-4 hover:shadow-elevated transition-shadow min-w-0">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <div className="font-mono text-xs text-muted-foreground">#{o.numero}</div>
                    <div className="font-medium truncate" title={o.clientes?.nome || "—"}>{o.clientes?.nome || "—"}</div>
                    <div className="text-xs text-muted-foreground truncate" title={`Vend.: ${o._vendedorNome}`}>Vend.: {o._vendedorNome}</div>
                  </div>
                  <Badge className={`${statusColor[o.status]} shrink-0`}>{o.status}</Badge>
                </div>
                <div className="mt-3 flex items-end justify-between gap-2">
                  <div>
                    <div className="text-[10px] uppercase text-muted-foreground tracking-wide">Total</div>
                    <div className="text-lg font-semibold">{fmtMoney(o.total)}</div>
                  </div>
                  <div className="text-right text-xs text-muted-foreground">
                    {o.validade && <div>Val.: {fmtDate(o.validade)}</div>}
                    <div>{fmtDate(o.created_at)}</div>
                  </div>
                </div>
                <div className="mt-3 flex items-center justify-between border-t pt-2">
                  {isAdmin ? (
                    o.geo_lat && o.geo_lng ? (
                      <button type="button" onClick={() => handleOpenMap(o.geo_lat, o.geo_lng)}
                        className="inline-flex items-center gap-1 text-xs text-primary hover:underline">
                        <MapPin className="h-3 w-3" /> Mapa
                      </button>
                    ) : <span className="text-xs text-muted-foreground">Sem GPS</span>
                  ) : <span />}
                  <div className="flex gap-0.5">
                    <Button size="sm" variant="ghost" title="Ver detalhes" onClick={() => openView(o)}><Eye className="h-4 w-4" /></Button>
                    {o._temPedido ? (
                      <Badge variant="secondary" className="text-[10px]" title="Pedido já gerado para este orçamento">Pedido gerado</Badge>
                    ) : (
                      <Button size="sm" variant="ghost" title="Converter em pedido" onClick={() => converterEmPedido(o)}><ArrowRight className="h-4 w-4 text-success" /></Button>
                    )}
                    <Button size="sm" variant="ghost" onClick={() => openEdit(o)}><Pencil className="h-4 w-4" /></Button>
                    <Button size="sm" variant="ghost" onClick={() => remove(o.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        )}
      </Card>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{editing ? `Orçamento #${editing.numero}` : "Novo orçamento"}</DialogTitle></DialogHeader>
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
                  placeholder="Buscar cliente por nome, código ou cidade..."
                />
              </div>
              <div className="space-y-2">
                <Label>Status</Label>
                <Select value={form.status} onValueChange={(v) => setForm({ ...form, status: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{STATUSES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-2"><Label>Validade</Label><Input type="date" value={form.validade || ""} onChange={(e) => setForm({ ...form, validade: e.target.value })} /></div>
              <div className="space-y-2"><Label>Desconto (%)</Label><Input type="number" step="0.01" min="0" max="100" value={form.desconto_pct ?? 0} onChange={(e) => setForm({ ...form, desconto_pct: e.target.value })} /></div>
            </div>

            <ItensEditor itens={itens} onChange={setItens} />

            <div className="rounded-lg border bg-muted/30 p-3 grid grid-cols-3 gap-2 text-xs">
              <div><div className="text-muted-foreground">Subtotal</div><div className="font-semibold">{fmtMoney(subtotalAtual)}</div></div>
              <div><div className="text-muted-foreground">Desconto ({descontoPctNum}%)</div><div className="font-semibold text-destructive">- {fmtMoney(descontoValor)}</div></div>
              <div><div className="text-muted-foreground">Total final</div><div className="font-bold text-primary text-base">{fmtMoney(totalCalculado)}</div></div>
            </div>

            

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
        title={viewing ? `Orçamento #${viewing.numero}` : "Orçamento"}
        rows={viewing ? [
          { label: "Cliente", value: viewing.clientes?.nome },
          { label: "Vendedor", value: viewing._vendedorNome },
          { label: "Status", value: viewing.status },
          { label: "Validade", value: viewing.validade ? fmtDate(viewing.validade) : "—" },
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
