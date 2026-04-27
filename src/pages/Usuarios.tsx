import { useEffect, useState } from "react";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/PageHeader";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter,
} from "@/components/ui/dialog";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import {
  UserPlus, Trash2, ShieldCheck, ShieldOff, Pencil, RefreshCw, Activity,
  CheckCircle2, XCircle, Clock, Ban, Mail,
} from "lucide-react";
import { fmtDateTime } from "@/lib/format";

type Status = "pendente" | "ativo" | "bloqueado";
type Role = "admin" | "vendedor";

interface AuthorizedEmail {
  id: string;
  email: string;
  nome: string | null;
  telefone: string | null;
  role: Role;
  status: Status;
  notes: string | null;
  created_at: string;
  activated_at: string | null;
  activated_user_id: string | null;
}

interface AccessLog {
  id: string;
  email: string | null;
  user_id: string | null;
  action: "login" | "login_blocked" | "logout" | "signup";
  success: boolean;
  reason: string | null;
  ip: string | null;
  user_agent: string | null;
  provider: string | null;
  created_at: string;
}

const emailSchema = z.object({
  email: z.string().trim().email("E-mail inválido").max(255),
  nome: z.string().trim().max(100).optional().or(z.literal("")),
  telefone: z.string().trim().max(30).optional().or(z.literal("")),
  role: z.enum(["admin", "vendedor"]),
  notes: z.string().max(500).optional().or(z.literal("")),
});

const statusBadge: Record<Status, { label: string; className: string; Icon: any }> = {
  ativo: { label: "Ativo", className: "bg-success/10 text-success border-success/30", Icon: CheckCircle2 },
  pendente: { label: "Pendente", className: "bg-warning/10 text-warning border-warning/30", Icon: Clock },
  bloqueado: { label: "Bloqueado", className: "bg-destructive/10 text-destructive border-destructive/30", Icon: Ban },
};

export default function Usuarios() {
  const [emails, setEmails] = useState<AuthorizedEmail[]>([]);
  const [logs, setLogs] = useState<AccessLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [openForm, setOpenForm] = useState(false);
  const [editing, setEditing] = useState<AuthorizedEmail | null>(null);

  const [email, setEmail] = useState("");
  const [nome, setNome] = useState("");
  const [telefone, setTelefone] = useState("");
  const [role, setRole] = useState<Role>("vendedor");
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);

  const load = async () => {
    setLoading(true);
    const [{ data: e }, { data: l }] = await Promise.all([
      supabase.from("authorized_emails").select("*").order("created_at", { ascending: false }),
      supabase.from("access_logs").select("*").order("created_at", { ascending: false }).limit(200),
    ]);
    setEmails((e as AuthorizedEmail[]) || []);
    setLogs((l as AccessLog[]) || []);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const resetForm = () => {
    setEditing(null); setEmail(""); setNome(""); setTelefone(""); setRole("vendedor"); setNotes("");
  };

  const openEdit = (a: AuthorizedEmail) => {
    setEditing(a);
    setEmail(a.email); setNome(a.nome || ""); setTelefone(a.telefone || "");
    setRole(a.role); setNotes(a.notes || "");
    setOpenForm(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    const parsed = emailSchema.safeParse({ email, nome, telefone, role, notes });
    if (!parsed.success) { toast.error(parsed.error.errors[0].message); return; }
    setBusy(true);
    const payload = {
      email: parsed.data.email.toLowerCase(),
      nome: parsed.data.nome || null,
      telefone: parsed.data.telefone || null,
      role: parsed.data.role,
      notes: parsed.data.notes || null,
    };
    let error;
    if (editing) {
      ({ error } = await supabase.from("authorized_emails").update(payload).eq("id", editing.id));
    } else {
      ({ error } = await supabase.from("authorized_emails").insert({ ...payload, status: "pendente" }));
    }
    setBusy(false);
    if (error) {
      toast.error(error.message.includes("duplicate") ? "Este e-mail já está cadastrado" : error.message);
      return;
    }
    toast.success(editing ? "Usuário atualizado" : "E-mail autorizado adicionado");
    setOpenForm(false); resetForm(); load();
  };

  const setStatus = async (id: string, status: Status) => {
    const { error } = await supabase.from("authorized_emails").update({ status }).eq("id", id);
    if (error) { toast.error(error.message); return; }
    toast.success(`Status alterado para ${status}`);
    load();
  };

  const remove = async (id: string) => {
    const { error } = await supabase.from("authorized_emails").delete().eq("id", id);
    if (error) { toast.error(error.message); return; }
    toast.success("Removido");
    load();
  };

  const stats = {
    total: emails.length,
    ativos: emails.filter((e) => e.status === "ativo").length,
    pendentes: emails.filter((e) => e.status === "pendente").length,
    bloqueados: emails.filter((e) => e.status === "bloqueado").length,
  };

  return (
    <div>
      <PageHeader
        title="Usuários do sistema"
        description="Pré-aprovação de acessos via Google e auditoria de logins"
        actions={
          <div className="flex gap-2">
            <Button variant="outline" onClick={load} disabled={loading}>
              <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} /> Atualizar
            </Button>
            <Dialog open={openForm} onOpenChange={(v) => { setOpenForm(v); if (!v) resetForm(); }}>
              <DialogTrigger asChild>
                <Button variant="brand"><UserPlus className="h-4 w-4" /> Autorizar e-mail</Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>{editing ? "Editar usuário autorizado" : "Autorizar novo e-mail"}</DialogTitle>
                </DialogHeader>
                <form onSubmit={handleSave} className="space-y-4">
                  <div className="space-y-2">
                    <Label>E-mail Google *</Label>
                    <Input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} disabled={!!editing} placeholder="vendedor@empresa.com" />
                    <p className="text-[11px] text-muted-foreground">Deve ser exatamente o mesmo e-mail da conta Google que o vendedor usará.</p>
                  </div>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="space-y-2">
                      <Label>Nome</Label>
                      <Input value={nome} onChange={(e) => setNome(e.target.value)} maxLength={100} />
                    </div>
                    <div className="space-y-2">
                      <Label>Telefone</Label>
                      <Input value={telefone} onChange={(e) => setTelefone(e.target.value)} maxLength={30} />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label>Papel *</Label>
                    <Select value={role} onValueChange={(v) => setRole(v as Role)}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="vendedor">Vendedor</SelectItem>
                        <SelectItem value="admin">Administrador</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Observações</Label>
                    <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} maxLength={500} rows={2} />
                  </div>
                  <DialogFooter>
                    <Button type="button" variant="ghost" onClick={() => setOpenForm(false)}>Cancelar</Button>
                    <Button type="submit" variant="brand" disabled={busy}>{busy ? "Salvando..." : "Salvar"}</Button>
                  </DialogFooter>
                </form>
              </DialogContent>
            </Dialog>
          </div>
        }
      />

      {/* Stats */}
      <div className="mb-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Total" value={stats.total} Icon={Mail} tone="muted" />
        <StatCard label="Ativos" value={stats.ativos} Icon={CheckCircle2} tone="success" />
        <StatCard label="Pendentes" value={stats.pendentes} Icon={Clock} tone="warning" />
        <StatCard label="Bloqueados" value={stats.bloqueados} Icon={Ban} tone="destructive" />
      </div>

      <Tabs defaultValue="usuarios">
        <TabsList>
          <TabsTrigger value="usuarios"><ShieldCheck className="h-4 w-4 mr-1" /> Usuários autorizados</TabsTrigger>
          <TabsTrigger value="logs"><Activity className="h-4 w-4 mr-1" /> Logs de acesso</TabsTrigger>
        </TabsList>

        <TabsContent value="usuarios" className="mt-4">
          <Card className="overflow-hidden shadow-elevated">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>E-mail / Nome</TableHead>
                  <TableHead>Papel</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Cadastrado</TableHead>
                  <TableHead>Primeiro acesso</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {emails.length === 0 && !loading && (
                  <TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                    Nenhum e-mail autorizado ainda. Adicione um para liberar o acesso.
                  </TableCell></TableRow>
                )}
                {emails.map((a) => {
                  const sb = statusBadge[a.status];
                  return (
                    <TableRow key={a.id}>
                      <TableCell>
                        <div className="font-medium">{a.email}</div>
                        {a.nome && <div className="text-xs text-muted-foreground">{a.nome}</div>}
                        {a.notes && <div className="text-xs text-muted-foreground italic mt-1">{a.notes}</div>}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className="uppercase text-[10px]">{a.role}</Badge>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className={sb.className}>
                          <sb.Icon className="h-3 w-3 mr-1" /> {sb.label}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">{fmtDateTime(a.created_at)}</TableCell>
                      <TableCell className="text-xs text-muted-foreground">{a.activated_at ? fmtDateTime(a.activated_at) : "—"}</TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1">
                          {a.status !== "ativo" && (
                            <Button size="icon" variant="ghost" title="Ativar" onClick={() => setStatus(a.id, "ativo")}>
                              <ShieldCheck className="h-4 w-4 text-success" />
                            </Button>
                          )}
                          {a.status !== "bloqueado" && (
                            <Button size="icon" variant="ghost" title="Bloquear" onClick={() => setStatus(a.id, "bloqueado")}>
                              <ShieldOff className="h-4 w-4 text-destructive" />
                            </Button>
                          )}
                          <Button size="icon" variant="ghost" title="Editar" onClick={() => openEdit(a)}>
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button size="icon" variant="ghost" title="Remover">
                                <Trash2 className="h-4 w-4 text-destructive" />
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>Remover {a.email}?</AlertDialogTitle>
                                <AlertDialogDescription>
                                  O usuário perderá a autorização de acesso. Se ele já estiver logado, ainda terá sessão até deslogar, mas não conseguirá entrar novamente.
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                <AlertDialogAction onClick={() => remove(a.id)}>Remover</AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </Card>
        </TabsContent>

        <TabsContent value="logs" className="mt-4">
          <Card className="overflow-hidden shadow-elevated">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Data/Hora</TableHead>
                  <TableHead>E-mail</TableHead>
                  <TableHead>Ação</TableHead>
                  <TableHead>Resultado</TableHead>
                  <TableHead>Provedor</TableHead>
                  <TableHead>IP</TableHead>
                  <TableHead>Dispositivo</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {logs.length === 0 && !loading && (
                  <TableRow><TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                    Nenhum registro ainda.
                  </TableCell></TableRow>
                )}
                {logs.map((l) => (
                  <TableRow key={l.id}>
                    <TableCell className="text-xs whitespace-nowrap">{fmtDateTime(l.created_at)}</TableCell>
                    <TableCell className="text-xs">{l.email || "—"}</TableCell>
                    <TableCell><Badge variant="outline" className="uppercase text-[10px]">{l.action}</Badge></TableCell>
                    <TableCell>
                      {l.success ? (
                        <span className="inline-flex items-center gap-1 text-xs text-success"><CheckCircle2 className="h-3 w-3" /> OK</span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-xs text-destructive" title={l.reason || ""}>
                          <XCircle className="h-3 w-3" /> {l.reason || "Falha"}
                        </span>
                      )}
                    </TableCell>
                    <TableCell className="text-xs">{l.provider || "—"}</TableCell>
                    <TableCell className="text-xs font-mono">{l.ip || "—"}</TableCell>
                    <TableCell className="text-xs text-muted-foreground max-w-[280px] truncate" title={l.user_agent || ""}>
                      {parseUA(l.user_agent)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

function StatCard({ label, value, Icon, tone }: { label: string; value: number; Icon: any; tone: "success" | "warning" | "destructive" | "muted" }) {
  const tones = {
    success: "bg-success/10 text-success",
    warning: "bg-warning/10 text-warning",
    destructive: "bg-destructive/10 text-destructive",
    muted: "bg-muted text-muted-foreground",
  };
  return (
    <Card className="p-4 flex items-center gap-3 shadow-soft">
      <div className={`rounded-lg p-2 ${tones[tone]}`}><Icon className="h-5 w-5" /></div>
      <div>
        <div className="text-xs text-muted-foreground">{label}</div>
        <div className="text-2xl font-bold">{value}</div>
      </div>
    </Card>
  );
}

function parseUA(ua: string | null): string {
  if (!ua) return "—";
  // Simples: extrai SO + navegador
  let os = "";
  if (/Windows/.test(ua)) os = "Windows";
  else if (/Android/.test(ua)) os = "Android";
  else if (/iPhone|iPad/.test(ua)) os = "iOS";
  else if (/Mac OS X/.test(ua)) os = "macOS";
  else if (/Linux/.test(ua)) os = "Linux";
  let br = "";
  if (/Edg\//.test(ua)) br = "Edge";
  else if (/Chrome\//.test(ua)) br = "Chrome";
  else if (/Firefox\//.test(ua)) br = "Firefox";
  else if (/Safari\//.test(ua)) br = "Safari";
  return [os, br].filter(Boolean).join(" • ") || ua.slice(0, 40);
}
