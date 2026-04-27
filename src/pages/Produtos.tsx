import { useEffect, useState } from "react";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { PageHeader } from "@/components/PageHeader";
import { EmptyState } from "@/components/EmptyState";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Plus, Package, Search, Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { fmtMoney } from "@/lib/format";

const schema = z.object({
  nome: z.string().trim().min(2).max(120),
  sku: z.string().trim().max(50).optional().or(z.literal("")),
  categoria: z.string().trim().max(80).optional().or(z.literal("")),
  descricao: z.string().trim().max(2000).optional().or(z.literal("")),
  preco: z.coerce.number().min(0),
  estoque: z.coerce.number().int().min(0),
  ativo: z.boolean().default(true),
});

export default function Produtos() {
  const { user } = useAuth();
  const [list, setList] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [search, setSearch] = useState("");
  const [form, setForm] = useState<any>({ ativo: true, preco: 0, estoque: 0 });
  const [busy, setBusy] = useState(false);

  useEffect(() => { load(); }, []);
  const load = async () => {
    setLoading(true);
    const { data } = await supabase.from("produtos").select("*").order("created_at", { ascending: false });
    setList(data || []); setLoading(false);
  };

  const openNew = () => { setEditing(null); setForm({ ativo: true, preco: 0, estoque: 0 }); setOpen(true); };
  const openEdit = (p: any) => { setEditing(p); setForm(p); setOpen(true); };

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    const parsed = schema.safeParse(form);
    if (!parsed.success) { toast.error(parsed.error.errors[0].message); return; }
    setBusy(true);
    const payload: any = { ...parsed.data, owner_id: user!.id };
    Object.keys(payload).forEach((k) => payload[k] === "" && (payload[k] = null));
    const op = editing
      ? supabase.from("produtos").update(payload).eq("id", editing.id)
      : supabase.from("produtos").insert(payload);
    const { error } = await op;
    setBusy(false);
    if (error) toast.error(error.message);
    else { toast.success(editing ? "Atualizado" : "Cadastrado"); setOpen(false); load(); }
  };

  const remove = async (id: string) => {
    if (!confirm("Excluir produto?")) return;
    const { error } = await supabase.from("produtos").delete().eq("id", id);
    if (error) toast.error(error.message); else { toast.success("Excluído"); load(); }
  };

  const filtered = list.filter((p) => !search || p.nome.toLowerCase().includes(search.toLowerCase()) || (p.sku || "").toLowerCase().includes(search.toLowerCase()));

  return (
    <div>
      <PageHeader title="Produtos" description="Catálogo e estoque" actions={<Button variant="brand" onClick={openNew}><Plus className="h-4 w-4" /> Novo produto</Button>} />

      <Card className="p-4 shadow-elevated">
        <div className="mb-4 flex items-center gap-2">
          <Search className="h-4 w-4 text-muted-foreground" />
          <Input placeholder="Buscar por nome ou SKU..." value={search} onChange={(e) => setSearch(e.target.value)} className="max-w-md" />
        </div>

        {loading ? (
          <div className="py-8 text-center text-sm text-muted-foreground">Carregando...</div>
        ) : filtered.length === 0 ? (
          <EmptyState icon={Package} title="Sem produtos" description="Cadastre produtos para usar em orçamentos e pedidos." action={<Button variant="brand" onClick={openNew}><Plus className="h-4 w-4" /> Novo produto</Button>} />
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nome</TableHead>
                  <TableHead>SKU</TableHead>
                  <TableHead>Categoria</TableHead>
                  <TableHead className="text-right">Preço</TableHead>
                  <TableHead className="text-right">Estoque</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="w-24"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((p) => (
                  <TableRow key={p.id}>
                    <TableCell className="font-medium">{p.nome}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">{p.sku || "—"}</TableCell>
                    <TableCell className="text-xs">{p.categoria || "—"}</TableCell>
                    <TableCell className="text-right font-semibold">{fmtMoney(p.preco)}</TableCell>
                    <TableCell className="text-right">{p.estoque}</TableCell>
                    <TableCell>{p.ativo ? <Badge className="bg-success text-success-foreground hover:bg-success">Ativo</Badge> : <Badge variant="secondary">Inativo</Badge>}</TableCell>
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
        <DialogContent className="max-w-xl">
          <DialogHeader><DialogTitle>{editing ? "Editar produto" : "Novo produto"}</DialogTitle></DialogHeader>
          <form onSubmit={save} className="grid gap-4 sm:grid-cols-2">
            <div className="sm:col-span-2 space-y-2"><Label>Nome *</Label><Input value={form.nome || ""} onChange={(e) => setForm({ ...form, nome: e.target.value })} required /></div>
            <div className="space-y-2"><Label>SKU</Label><Input value={form.sku || ""} onChange={(e) => setForm({ ...form, sku: e.target.value })} /></div>
            <div className="space-y-2"><Label>Categoria</Label><Input value={form.categoria || ""} onChange={(e) => setForm({ ...form, categoria: e.target.value })} /></div>
            <div className="space-y-2"><Label>Preço (R$)</Label><Input type="number" step="0.01" min="0" value={form.preco} onChange={(e) => setForm({ ...form, preco: e.target.value })} /></div>
            <div className="space-y-2"><Label>Estoque</Label><Input type="number" min="0" value={form.estoque} onChange={(e) => setForm({ ...form, estoque: e.target.value })} /></div>
            <div className="sm:col-span-2 space-y-2"><Label>Descrição</Label><Textarea value={form.descricao || ""} onChange={(e) => setForm({ ...form, descricao: e.target.value })} rows={3} /></div>
            <div className="flex items-center gap-2"><Switch checked={form.ativo} onCheckedChange={(v) => setForm({ ...form, ativo: v })} /><Label>Ativo</Label></div>
            <DialogFooter className="sm:col-span-2">
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
              <Button type="submit" variant="brand" disabled={busy}>{busy ? "Salvando..." : "Salvar"}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
