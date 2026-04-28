import { useEffect, useState } from "react";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { captureLocation } from "@/hooks/useGeolocation";
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
import { Plus, Users, MapPin, Search, Pencil, Trash2, ExternalLink } from "lucide-react";
import { toast } from "sonner";
import { fmtDate } from "@/lib/format";
import { openMapLocation } from "@/lib/maps";
import { offlineInsert, offlineUpdate, offlineDelete } from "@/lib/offlineWrite";

const schema = z.object({
  nome: z.string().trim().min(2, "Nome obrigatório").max(120),
  empresa: z.string().trim().max(120).optional().or(z.literal("")),
  cpf_cnpj: z.string().trim().max(20).optional().or(z.literal("")),
  email: z.string().trim().email("E-mail inválido").max(255).optional().or(z.literal("")),
  telefone: z.string().trim().max(30).optional().or(z.literal("")),
  endereco: z.string().trim().max(255).optional().or(z.literal("")),
  cidade: z.string().trim().max(80).optional().or(z.literal("")),
  estado: z.string().trim().max(2).optional().or(z.literal("")),
  cep: z.string().trim().max(10).optional().or(z.literal("")),
  observacoes: z.string().trim().max(2000).optional().or(z.literal("")),
});

type Cliente = {
  id: string; nome: string; empresa: string | null; email: string | null;
  telefone: string | null; cidade: string | null; estado: string | null;
  geo_lat: number | null; geo_lng: number | null; geo_endereco: string | null;
  created_at: string;
};

export default function Clientes() {
  const { user } = useAuth();
  const [list, setList] = useState<Cliente[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [search, setSearch] = useState("");
  const [busy, setBusy] = useState(false);

  const [form, setForm] = useState<any>({});

  useEffect(() => { load(); }, []);

  const load = async () => {
    setLoading(true);
    const { data } = await supabase.from("clientes").select("*").order("created_at", { ascending: false });
    setList(data || []);
    setLoading(false);
  };

  const openNew = () => { setEditing(null); setForm({}); setOpen(true); };
  const openEdit = (c: any) => { setEditing(c); setForm(c); setOpen(true); };

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    const parsed = schema.safeParse(form);
    if (!parsed.success) { toast.error(parsed.error.errors[0].message); return; }
    setBusy(true);
    const payload: any = { ...parsed.data, owner_id: user!.id };
    Object.keys(payload).forEach((k) => payload[k] === "" && (payload[k] = null));

    if (editing) {
      const { error } = await offlineUpdate("clientes", payload, { column: "id", value: editing.id });
      if (error) { toast.error(error.message); setBusy(false); return; }
      toast.success("Cliente atualizado");
    } else {
      const fallback = [form.endereco, form.cidade, form.estado, form.cep, "Brasil"]
        .filter(Boolean).join(", ");
      let geo = { geo_lat: null, geo_lng: null, geo_endereco: null } as Awaited<ReturnType<typeof captureLocation>>;
      try {
        geo = await Promise.race([
          captureLocation(fallback),
          new Promise<typeof geo>((resolve) => setTimeout(() => resolve(geo), 12000)),
        ]);
      } catch { /* segue sem geo */ }
      const { error, pending } = await offlineInsert("clientes", { ...payload, ...geo });
      if (error) { toast.error(error.message); setBusy(false); return; }
      if (pending) { /* já houve toast */ }
      else if (geo.geo_lat) toast.success("Cliente cadastrado com sucesso ✓ Localização capturada.");
      else toast.success("Cliente cadastrado com sucesso ✓");
    }
    setBusy(false); setOpen(false); load();
  };

  const remove = async (id: string) => {
    if (!confirm("Excluir este cliente?")) return;
    const { error } = await supabase.from("clientes").delete().eq("id", id);
    if (error) toast.error(error.message); else { toast.success("Excluído"); load(); }
  };

  const filtered = list.filter((c) => {
    const q = search.toLowerCase();
    return !q || c.nome.toLowerCase().includes(q) || (c.empresa || "").toLowerCase().includes(q) || (c.email || "").toLowerCase().includes(q);
  });

  const handleOpenMap = async (lat: number, lng: number) => {
    const { opened } = await openMapLocation(lat, lng);
    if (!opened) {
      toast.info("Não foi possível abrir o mapa aqui. Copiamos o link para você colar no navegador.");
    }
  };

  return (
    <div>
      <PageHeader
        title="Clientes"
        description="Gestão completa da sua carteira"
        actions={
          <Button variant="brand" onClick={openNew}><Plus className="h-4 w-4" /> Novo cliente</Button>
        }
      />

      <Card className="p-4 shadow-elevated">
        <div className="mb-4 flex items-center gap-2">
          <Search className="h-4 w-4 text-muted-foreground" />
          <Input placeholder="Buscar por nome, empresa ou email..." value={search} onChange={(e) => setSearch(e.target.value)} className="max-w-md" />
        </div>

        {loading ? (
          <div className="py-8 text-center text-sm text-muted-foreground">Carregando...</div>
        ) : filtered.length === 0 ? (
          <EmptyState icon={Users} title="Nenhum cliente ainda" description="Cadastre seu primeiro cliente para começar." action={<Button variant="brand" onClick={openNew}><Plus className="h-4 w-4" /> Novo cliente</Button>} />
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nome</TableHead>
                  <TableHead>Empresa</TableHead>
                  <TableHead>Contato</TableHead>
                  <TableHead>Localização</TableHead>
                  <TableHead>Cadastro</TableHead>
                  <TableHead className="w-24"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((c) => (
                  <TableRow key={c.id}>
                    <TableCell className="font-medium">{c.nome}</TableCell>
                    <TableCell className="text-muted-foreground">{c.empresa || "—"}</TableCell>
                    <TableCell className="text-sm">
                      <div>{c.email || "—"}</div>
                      <div className="text-muted-foreground">{c.telefone || ""}</div>
                    </TableCell>
                    <TableCell>
                      {c.geo_lat && c.geo_lng ? (
                        <button
                          type="button"
                          onClick={() => handleOpenMap(c.geo_lat!, c.geo_lng!)}
                          className="inline-flex items-center gap-1 text-left text-xs text-primary hover:underline"
                        >
                          <MapPin className="h-3 w-3" />
                          {c.geo_endereco ? (c.geo_endereco.length > 40 ? c.geo_endereco.slice(0,40)+"..." : c.geo_endereco) : "Ver no mapa"}
                          <ExternalLink className="h-3 w-3" />
                        </button>
                      ) : <span className="text-xs text-muted-foreground">Sem GPS</span>}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">{fmtDate(c.created_at)}</TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        <Button size="icon" variant="ghost" onClick={() => openEdit(c)}><Pencil className="h-4 w-4" /></Button>
                        <Button size="icon" variant="ghost" onClick={() => remove(c.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
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
        <DialogContent className="max-w-2xl">
          <DialogHeader><DialogTitle>{editing ? "Editar cliente" : "Novo cliente"}</DialogTitle></DialogHeader>
          <form onSubmit={save} className="grid gap-4 sm:grid-cols-2">
            <Field label="Nome *" value={form.nome} onChange={(v) => setForm({ ...form, nome: v })} />
            <Field label="Empresa" value={form.empresa} onChange={(v) => setForm({ ...form, empresa: v })} />
            <Field label="CPF / CNPJ" value={form.cpf_cnpj} onChange={(v) => setForm({ ...form, cpf_cnpj: v })} />
            <Field label="E-mail" type="email" value={form.email} onChange={(v) => setForm({ ...form, email: v })} />
            <Field label="Telefone" value={form.telefone} onChange={(v) => setForm({ ...form, telefone: v })} />
            <Field label="CEP" value={form.cep} onChange={(v) => setForm({ ...form, cep: v })} />
            <div className="sm:col-span-2"><Field label="Endereço" value={form.endereco} onChange={(v) => setForm({ ...form, endereco: v })} /></div>
            <Field label="Cidade" value={form.cidade} onChange={(v) => setForm({ ...form, cidade: v })} />
            <Field label="Estado (UF)" value={form.estado} onChange={(v) => setForm({ ...form, estado: v.toUpperCase().slice(0,2) })} />
            <div className="sm:col-span-2 space-y-2">
              <Label>Observações</Label>
              <Textarea value={form.observacoes || ""} onChange={(e) => setForm({ ...form, observacoes: e.target.value })} maxLength={2000} rows={3} />
            </div>
            {!editing && (
              <div className="sm:col-span-2 flex items-start gap-2 rounded-lg bg-accent-soft p-3 text-xs text-accent">
                <MapPin className="h-4 w-4 shrink-0 mt-0.5" />
                <span>Ao salvar, capturaremos sua localização via GPS. Se o GPS for negado (ex: desktop), usaremos o endereço informado acima para localizar no mapa.</span>
              </div>
            )}
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

function Field({ label, value, onChange, type = "text" }: any) {
  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      <Input type={type} value={value || ""} onChange={(e) => onChange(e.target.value)} />
    </div>
  );
}
