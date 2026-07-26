import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { CalendarCheck, ChevronLeft, ChevronRight, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";

interface Tarefa {
  id: string;
  titulo: string;
  descricao: string | null;
  data: string;
  hora: string | null;
  concluido: boolean;
}

const iso = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

const DIAS = ["D", "S", "T", "Q", "Q", "S", "S"];

export const AgendaDia = () => {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [ref, setRef] = useState(() => {
    const d = new Date();
    return new Date(d.getFullYear(), d.getMonth(), 1);
  });
  const [itens, setItens] = useState<Tarefa[]>([]);
  const [diaSel, setDiaSel] = useState<string | null>(null);
  const [titulo, setTitulo] = useState("");
  const [hora, setHora] = useState("");
  const [descricao, setDescricao] = useState("");

  const inicio = useMemo(() => iso(new Date(ref.getFullYear(), ref.getMonth(), 1)), [ref]);
  const fim = useMemo(() => iso(new Date(ref.getFullYear(), ref.getMonth() + 1, 0)), [ref]);

  useEffect(() => { load(); /* eslint-disable-next-line */ }, [inicio, fim]);

  const load = async () => {
    setLoading(true);
    const { data: rows, error } = await supabase
      .from("agenda")
      .select("id, titulo, descricao, data, hora, concluido")
      .gte("data", inicio)
      .lte("data", fim)
      .order("hora", { ascending: true, nullsFirst: false })
      .order("created_at", { ascending: true });
    if (error) toast.error("Erro ao carregar agenda");
    setItens((rows as Tarefa[]) || []);
    setLoading(false);
  };

  const porDia = useMemo(() => {
    const m: Record<string, Tarefa[]> = {};
    itens.forEach((t) => { (m[t.data] ||= []).push(t); });
    return m;
  }, [itens]);

  const celulas = useMemo(() => {
    const primeiro = new Date(ref.getFullYear(), ref.getMonth(), 1);
    const totalDias = new Date(ref.getFullYear(), ref.getMonth() + 1, 0).getDate();
    const vazios = primeiro.getDay();
    const arr: (string | null)[] = Array(vazios).fill(null);
    for (let d = 1; d <= totalDias; d++) arr.push(iso(new Date(ref.getFullYear(), ref.getMonth(), d)));
    while (arr.length % 7 !== 0) arr.push(null);
    return arr;
  }, [ref]);

  const adicionar = async () => {
    if (!diaSel) return;
    if (!titulo.trim()) { toast.error("Informe o compromisso"); return; }
    setSaving(true);
    const { error } = await supabase.from("agenda").insert({
      titulo: titulo.trim(),
      descricao: descricao.trim() || null,
      hora: hora || null,
      data: diaSel,
    });
    setSaving(false);
    if (error) { toast.error("Não foi possível salvar"); return; }
    setTitulo(""); setHora(""); setDescricao("");
    load();
  };

  const alternar = async (t: Tarefa) => {
    setItens((prev) => prev.map((i) => (i.id === t.id ? { ...i, concluido: !i.concluido } : i)));
    const { error } = await supabase.from("agenda").update({ concluido: !t.concluido }).eq("id", t.id);
    if (error) { toast.error("Erro ao atualizar"); load(); }
  };

  const remover = async (id: string) => {
    setItens((prev) => prev.filter((i) => i.id !== id));
    const { error } = await supabase.from("agenda").delete().eq("id", id);
    if (error) { toast.error("Erro ao excluir"); load(); }
  };

  const hoje = iso(new Date());
  const mesLabel = ref.toLocaleDateString("pt-BR", { month: "long", year: "numeric" });
  const doDia = diaSel ? porDia[diaSel] || [] : [];

  return (
    <Card className="mt-6 p-4 sm:p-6 shadow-elevated overflow-hidden">
      <div className="mb-4 flex items-center justify-between gap-2">
        <div className="min-w-0">
          <h3 className="font-semibold flex items-center gap-2">
            <CalendarCheck className="h-4 w-4 text-primary" />Agenda
          </h3>
          <p className="text-xs text-muted-foreground capitalize">{mesLabel}</p>
        </div>
        <div className="flex gap-1 shrink-0">
          <Button size="icon" variant="outline" className="h-8 w-8"
            onClick={() => setRef(new Date(ref.getFullYear(), ref.getMonth() - 1, 1))}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button size="icon" variant="outline" className="h-8 w-8"
            onClick={() => setRef(new Date(ref.getFullYear(), ref.getMonth() + 1, 1))}>
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {loading ? (
        <Skeleton className="h-64 w-full" />
      ) : (
        <div className="grid grid-cols-7 gap-1">
          {DIAS.map((d, i) => (
            <div key={i} className="pb-1 text-center text-[11px] font-medium text-muted-foreground">{d}</div>
          ))}
          {celulas.map((c, i) => {
            if (!c) return <div key={i} />;
            const tarefas = porDia[c] || [];
            const pend = tarefas.filter((t) => !t.concluido).length;
            return (
              <button
                key={i}
                type="button"
                onClick={() => setDiaSel(c)}
                className={`aspect-square rounded-lg border p-1 text-left transition-colors hover:bg-accent/50 ${
                  c === hoje ? "border-primary bg-primary/5" : "border-border"
                }`}
              >
                <div className={`text-xs font-medium ${c === hoje ? "text-primary" : ""}`}>
                  {Number(c.slice(8, 10))}
                </div>
                {tarefas.length > 0 && (
                  <div className="mt-0.5 flex flex-wrap gap-0.5">
                    {tarefas.slice(0, 3).map((t) => (
                      <span key={t.id} className={`h-1.5 w-1.5 rounded-full ${t.concluido ? "bg-muted-foreground/40" : "bg-primary"}`} />
                    ))}
                    {pend > 3 && <span className="text-[9px] text-muted-foreground leading-none">+</span>}
                  </div>
                )}
              </button>
            );
          })}
        </div>
      )}

      <Dialog open={!!diaSel} onOpenChange={(o) => { if (!o) { setDiaSel(null); setTitulo(""); setHora(""); setDescricao(""); } }}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-base">
              {diaSel ? new Date(`${diaSel}T12:00:00`).toLocaleDateString("pt-BR", { weekday: "long", day: "2-digit", month: "long" }) : ""}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-2">
            <div className="grid gap-2 sm:grid-cols-[1fr_auto]">
              <Input placeholder="Título do compromisso" value={titulo} onChange={(e) => setTitulo(e.target.value)} className="min-w-0" />
              <Input type="time" value={hora} onChange={(e) => setHora(e.target.value)} className="sm:w-32" />
            </div>
            <Textarea placeholder="Observações (opcional)" value={descricao} onChange={(e) => setDescricao(e.target.value)} rows={2} />
            <Button onClick={adicionar} disabled={saving} className="w-full">
              <Plus className="h-4 w-4" /> Adicionar
            </Button>
          </div>

          <div className="mt-2 space-y-2">
            {doDia.length === 0 ? (
              <p className="py-4 text-center text-sm text-muted-foreground">Nenhum compromisso neste dia.</p>
            ) : (
              doDia.map((t) => (
                <div key={t.id} className={`flex items-start gap-2 rounded-lg border p-2 ${t.concluido ? "opacity-60" : ""}`}>
                  <Checkbox checked={t.concluido} onCheckedChange={() => alternar(t)} className="mt-0.5" />
                  <div className="min-w-0 flex-1">
                    <div className={`truncate text-sm font-medium ${t.concluido ? "line-through" : ""}`} title={t.titulo}>
                      {t.hora ? `${t.hora.slice(0, 5)} · ` : ""}{t.titulo}
                    </div>
                    {t.descricao && (
                      <div className="text-xs text-muted-foreground break-words">{t.descricao}</div>
                    )}
                  </div>
                  <Button size="icon" variant="ghost" className="h-7 w-7 shrink-0" onClick={() => remover(t.id)}>
                    <Trash2 className="h-3.5 w-3.5 text-destructive" />
                  </Button>
                </div>
              ))
            )}
          </div>
        </DialogContent>
      </Dialog>
    </Card>
  );
};
