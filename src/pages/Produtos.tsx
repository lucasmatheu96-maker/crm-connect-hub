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
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Plus, Package, Search, Pencil, Trash2, Eye } from "lucide-react";
import { toast } from "sonner";
import { fmtMoney } from "@/lib/format";
import { offlineInsert, offlineUpdate, offlineDelete } from "@/lib/offlineWrite";
import { DetailsDialog } from "@/components/DetailsDialog";

const schema = z.object({
  nome: z.string().trim().min(2).max(120),
  sku: z.string().trim().max(50).optional().or(z.literal("")),
  categoria: z.string().trim().max(80).optional().or(z.literal("")),
  descricao: z.string().trim().max(2000).optional().or(z.literal("")),
  preco: z.coerce.number().min(0),
  estoque: z.coerce.number().int(),
  ativo: z.boolean().default(true),
});

export default function Produtos() {
  const { user, role } = useAuth();
  const isAdmin = role === "admin";
  const [list, setList] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [search, setSearch] = useState("");
  const [form, setForm] = useState<any>({ ativo: true, preco: 0, estoque: 0 });
  const [busy, setBusy] = useState(false);
  const [viewing, setViewing] = useState<any>(null);

  useEffect(() => { load(); }, []);
  const load = async () => {
    setLoading(true);
    const { data } = await supabase.from("produtos").select("*").order("created_at", { ascending: false });
    setList(data || []); setLoading(false);
  };

  const openEdit = (p: any) => { setEditing(p); setForm(p); setOpen(true); };

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isAdmin) { toast.error("Apenas administradores podem editar produtos"); return; }
    const parsed = schema.safeParse(form);
    if (!parsed.success) { toast.error(parsed.error.errors[0].message); return; }
    setBusy(true);
    const payload: any = { ...parsed.data, owner_id: user!.id };
    Object.keys(payload).forEach((k) => payload[k] === "" && (payload[k] = null));
    const { error } = editing
      ? await offlineUpdate("produtos", payload, { column: "id", value: editing.id })
      : await offlineInsert("produtos", payload);
    setBusy(false);
    if (error) toast.error(error.message);
    else { toast.success("Atualizado"); setOpen(false); load(); }
  };

  const remove = async (id: string) => {
    if (!isAdmin) { toast.error("Apenas administradores podem excluir"); return; }
    if (!confirm("Excluir produto?")) return;
    const { error } = await offlineDelete("produtos", { column: "id", value: id });
    if (error) toast.error(error.message); else { toast.success("Excluído"); load(); }
  };

  const filtered = list.filter((p) => !search || p.nome.toLowerCase().includes(search.toLowerCase()) || (p.sku || "").toLowerCase().includes(search.toLowerCase()));

  return (
    <div>
      <PageHeader title="Produtos" description="Catálogo e estoque" />

      <Card className="p-4 shadow-elevated">
        <div className="mb-4 flex items-center gap-2">
          <Search className="h-4 w-4 text-muted-foreground" />
          <Input placeholder="Buscar por nome ou SKU..." value={search} onChange={(e) => setSearch(e.target.value)} className="max-w-md" />
        </div>

        {loading ? (
          <div className="py-8 text-center text-sm text-muted-foreground">Carregando...</div>
        ) : filtered.length === 0 ? (
          <EmptyState icon={Package} title="Sem produtos" description="A importação de planilha cadastra os produtos automaticamente." />
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {filtered.map((p) => (
              <Card key={p.id} className="p-4 hover:shadow-elevated transition-shadow min-w-0">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <div className="font-medium truncate" title={p.nome}>{p.nome}</div>
                    <div className="text-xs text-muted-foreground mt-0.5 truncate">
                      {p.sku || "—"}{p.categoria ? ` · ${p.categoria}` : ""}
                    </div>
                  </div>
                  {p.ativo
                    ? <Badge className="bg-success text-success-foreground hover:bg-success shrink-0">Ativo</Badge>
                    : <Badge variant="secondary" className="shrink-0">Inativo</Badge>}
                </div>
                <div className="mt-3 flex flex-wrap items-end justify-between gap-x-3 gap-y-2">
                  <div className="min-w-0">
                    <div className="text-[10px] uppercase text-muted-foreground tracking-wide">Preço sugerido</div>
                    <div className="text-base sm:text-lg font-semibold">{fmtMoney(p.preco)}</div>
                  </div>
                  <div className="text-center min-w-0">
                    <div className="text-[10px] uppercase text-muted-foreground tracking-wide">Unidade</div>
                    <div className="text-base sm:text-lg font-semibold">{p.unidade || "—"}</div>
                  </div>
                  <div className="text-right min-w-0">
                    <div className="text-[10px] uppercase text-muted-foreground tracking-wide">Estoque</div>
                    <div className={`text-base sm:text-lg font-semibold ${(p.disponivel ?? p.estoque) < 0 ? "text-destructive" : ""}`}>{p.disponivel ?? p.estoque}</div>
                  </div>
                </div>
                <div className="mt-3 flex justify-end gap-1 border-t pt-2">
                  <Button size="sm" variant="ghost" title="Ver detalhes" onClick={() => setViewing(p)}><Eye className="h-4 w-4" /></Button>
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
        <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{editing ? "Editar produto" : "Novo produto"}</DialogTitle></DialogHeader>
          <form onSubmit={save} className="grid gap-4 sm:grid-cols-2">
            <div className="sm:col-span-2 space-y-2"><Label>Nome *</Label><Input value={form.nome || ""} onChange={(e) => setForm({ ...form, nome: e.target.value })} required /></div>
            <div className="space-y-2"><Label>SKU</Label><Input value={form.sku || ""} onChange={(e) => setForm({ ...form, sku: e.target.value })} /></div>
            <div className="space-y-2"><Label>Categoria</Label><Input value={form.categoria || ""} onChange={(e) => setForm({ ...form, categoria: e.target.value })} /></div>
            <div className="space-y-2"><Label>Unidade de medida</Label><Input value={form.unidade || ""} disabled readOnly placeholder="(da planilha)" /></div>
            <div className="space-y-2"><Label>Preço sugerido (R$)</Label><Input type="number" step="0.01" min="0" value={form.preco} onChange={(e) => setForm({ ...form, preco: e.target.value })} /></div>
            <div className="space-y-2"><Label>Estoque (saldo)</Label><Input type="number" value={form.disponivel ?? form.estoque ?? 0} onChange={(e) => setForm({ ...form, disponivel: e.target.value, estoque: e.target.value })} /></div>
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
