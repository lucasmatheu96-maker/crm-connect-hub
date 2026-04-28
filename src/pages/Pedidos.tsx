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
import { Plus, ShoppingCart, Pencil, Trash2, MapPin } from "lucide-react";
import { toast } from "sonner";
import { fmtMoney, fmtDate } from "@/lib/format";
import { ItensEditor, Item } from "@/components/ItensEditor";
import { offlineInsert, offlineUpdate, offlineDelete } from "@/lib/offlineWrite";

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
  const { user } = useAuth();
  const [list, setList] = useState<any[]>([]);
  const [clientes, setClientes] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [form, setForm] = useState<any>({ status: "novo", desconto: 0 });
  const [itens, setItens] = useState<Item[]>([]);
  const [busy, setBusy] = useState(false);

  useEffect(() => { load(); }, []);
  const load = async () => {
    setLoading(true);
    const [{ data: peds }, { data: cls }] = await Promise.all([
      supabase.from("pedidos").select("*, clientes(nome)").order("created_at", { ascending: false }),
      supabase.from("clientes").select("id, nome").order("nome"),
    ]);
    setList(peds || []); setClientes(cls || []); setLoading(false);
  };

  const openNew = () => { setEditing(null); setForm({ status: "novo", desconto: 0 }); setItens([]); setOpen(true); };
  const openEdit = async (p: any) => {
    setEditing(p); setForm(p);
    const { data } = await supabase.from("pedido_itens").select("*").eq("pedido_id", p.id);
    setItens((data || []).map((i: any) => ({ produto_id: i.produto_id, descricao: i.descricao, quantidade: Number(i.quantidade), preco_unitario: Number(i.preco_unitario) })));
    setOpen(true);
  };

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.cliente_id) { toast.error("Selecione um cliente"); return; }
    if (itens.length === 0) { toast.error("Adicione ao menos um item"); return; }
    setBusy(true);
    const subtotal = itens.reduce((s, i) => s + i.quantidade * i.preco_unitario, 0);
    const total = Math.max(0, subtotal - Number(form.desconto || 0));
    const payload: any = {
      cliente_id: form.cliente_id, status: form.status,
      desconto: Number(form.desconto || 0), total,
      observacoes: form.observacoes || null, owner_id: user!.id,
    };
    let pedidoId = editing?.id;
    if (editing) {
      const { error } = await supabase.from("pedidos").update(payload).eq("id", editing.id);
      if (error) { toast.error(error.message); setBusy(false); return; }
      await supabase.from("pedido_itens").delete().eq("pedido_id", editing.id);
    } else {
      toast.info("Capturando localização...");
      const geo = await captureLocation();
      const { data, error } = await supabase.from("pedidos").insert({ ...payload, ...geo }).select("id").single();
      if (error) { toast.error(error.message); setBusy(false); return; }
      pedidoId = data.id;
    }
    await supabase.from("pedido_itens").insert(itens.map((i) => ({
      pedido_id: pedidoId, produto_id: i.produto_id || null,
      descricao: i.descricao || "Item", quantidade: i.quantidade,
      preco_unitario: i.preco_unitario, subtotal: i.quantidade * i.preco_unitario,
    })));
    setBusy(false); setOpen(false); load();
    toast.success(editing ? "Pedido atualizado" : "Pedido criado");
  };

  const remove = async (id: string) => {
    if (!confirm("Excluir pedido?")) return;
    const { error } = await supabase.from("pedidos").delete().eq("id", id);
    if (error) toast.error(error.message); else { toast.success("Excluído"); load(); }
  };

  return (
    <div>
      <PageHeader title="Pedidos" description="Acompanhamento de vendas e entregas" actions={<Button variant="brand" onClick={openNew}><Plus className="h-4 w-4" /> Novo pedido</Button>} />

      <Card className="p-4 shadow-elevated">
        {loading ? <div className="py-8 text-center text-sm text-muted-foreground">Carregando...</div>
          : list.length === 0 ? <EmptyState icon={ShoppingCart} title="Nenhum pedido" description="Crie pedidos diretamente ou converta a partir de orçamentos." action={<Button variant="brand" onClick={openNew}><Plus className="h-4 w-4" /> Novo pedido</Button>} />
          : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>#</TableHead>
                  <TableHead>Cliente</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Total</TableHead>
                  <TableHead>Loc.</TableHead>
                  <TableHead>Criado</TableHead>
                  <TableHead className="w-24"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {list.map((p) => (
                  <TableRow key={p.id}>
                    <TableCell className="font-mono text-xs">#{p.numero}</TableCell>
                    <TableCell className="font-medium">{p.clientes?.nome}</TableCell>
                    <TableCell><Badge className={statusColor[p.status]}>{p.status.replace("_", " ")}</Badge></TableCell>
                    <TableCell className="text-right font-semibold">{fmtMoney(p.total)}</TableCell>
                    <TableCell>{p.geo_lat ? <a href={`https://www.google.com/maps?q=${p.geo_lat},${p.geo_lng}`} target="_blank" rel="noreferrer"><MapPin className="h-4 w-4 text-primary" /></a> : <span className="text-xs text-muted-foreground">—</span>}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">{fmtDate(p.created_at)}</TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        <Button size="icon" variant="ghost" onClick={() => openEdit(p)}><Pencil className="h-4 w-4" /></Button>
                        <Button size="icon" variant="ghost" onClick={() => remove(p.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </Card>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{editing ? `Pedido #${editing.numero}` : "Novo pedido"}</DialogTitle></DialogHeader>
          <form onSubmit={save} className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-3">
              <div className="space-y-2 sm:col-span-2">
                <Label>Cliente *</Label>
                <Select value={form.cliente_id || ""} onValueChange={(v) => setForm({ ...form, cliente_id: v })}>
                  <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
                  <SelectContent>{clientes.map((c) => <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>)}</SelectContent>
                </Select>
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

            {!editing && <div className="flex items-start gap-2 rounded-lg bg-accent-soft p-3 text-xs text-accent"><MapPin className="h-4 w-4 shrink-0 mt-0.5" /><span>Localização atual será capturada ao salvar.</span></div>}

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
              <Button type="submit" variant="brand" disabled={busy}>{busy ? "Salvando..." : "Salvar"}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
