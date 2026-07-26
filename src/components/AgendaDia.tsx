import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Skeleton } from "@/components/ui/skeleton";
import { CalendarCheck, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";

interface Tarefa {
  id: string;
  titulo: string;
  descricao: string | null;
  data: string;
  hora: string | null;
  concluido: boolean;
}

const hojeISO = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

export const AgendaDia = () => {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [data, setData] = useState(hojeISO());
  const [itens, setItens] = useState<Tarefa[]>([]);
  const [titulo, setTitulo] = useState("");
  const [hora, setHora] = useState("");
  const [descricao, setDescricao] = useState("");

  useEffect(() => { load(); /* eslint-disable-next-line */ }, [data]);

  const load = async () => {
    setLoading(true);
    const { data: rows, error } = await supabase
      .from("agenda")
      .select("id, titulo, descricao, data, hora, concluido")
      .eq("data", data)
      .order("hora", { ascending: true, nullsFirst: false })
      .order("created_at", { ascending: true });
    if (error) toast.error("Erro ao carregar agenda");
    setItens((rows as Tarefa[]) || []);
    setLoading(false);
  };

  const adicionar = async () => {
    if (!titulo.trim()) { toast.error("Informe o compromisso"); return; }
    setSaving(true);
    const { error } = await supabase.from("agenda").insert({
      titulo: titulo.trim(),
      descricao: descricao.trim() || null,
      hora: hora || null,
      data,
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

  const feitos = itens.filter((i) => i.concluido).length;

  return (
    <Card className="mt-6 p-4 sm:p-6 shadow-elevated overflow-hidden">
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <h3 className="font-semibold flex items-center gap-2">
            <CalendarCheck className="h-4 w-4 text-primary" />Agenda do dia
          </h3>
          <p className="text-xs text-muted-foreground">
            {itens.length === 0 ? "Nenhum compromisso" : `${feitos} de ${itens.length} concluído(s)`}
          </p>
        </div>
        <Input
          type="date"
          value={data}
          onChange={(e) => setData(e.target.value || hojeISO())}
          className="sm:w-44"
        />
      </div>

      <div className="grid gap-2 sm:grid-cols-[1fr_auto_auto] mb-4">
        <Input
          placeholder="Novo compromisso (ex.: Visita cliente X)"
          value={titulo}
          onChange={(e) => setTitulo(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && adicionar()}
          className="min-w-0"
        />
        <Input type="time" value={hora} onChange={(e) => setHora(e.target.value)} className="sm:w-32" />
        <Button onClick={adicionar} disabled={saving} className="shrink-0">
          <Plus className="h-4 w-4" /> Adicionar
        </Button>
      </div>
      <Input
        placeholder="Observações (opcional)"
        value={descricao}
        onChange={(e) => setDescricao(e.target.value)}
        className="mb-4"
      />

      {loading ? (
        <Skeleton className="h-32 w-full" />
      ) : itens.length === 0 ? (
        <p className="text-sm text-muted-foreground py-6 text-center">
          Adicione os afazeres do dia para acompanhar sua rotina.
        </p>
      ) : (
        <div className="overflow-hidden rounded-lg border">
          <table className="w-full text-sm table-fixed">
            <thead className="bg-muted/50">
              <tr className="text-left text-xs text-muted-foreground">
                <th className="w-10 p-2"></th>
                <th className="w-16 p-2">Hora</th>
                <th className="p-2">Compromisso</th>
                <th className="w-10 p-2"></th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {itens.map((t) => (
                <tr key={t.id} className={t.concluido ? "opacity-60" : ""}>
                  <td className="p-2 align-top">
                    <Checkbox checked={t.concluido} onCheckedChange={() => alternar(t)} />
                  </td>
                  <td className="p-2 align-top text-xs text-muted-foreground whitespace-nowrap">
                    {t.hora ? t.hora.slice(0, 5) : "—"}
                  </td>
                  <td className="p-2 min-w-0">
                    <div className={`truncate font-medium ${t.concluido ? "line-through" : ""}`} title={t.titulo}>
                      {t.titulo}
                    </div>
                    {t.descricao && (
                      <div className="truncate text-xs text-muted-foreground" title={t.descricao}>
                        {t.descricao}
                      </div>
                    )}
                  </td>
                  <td className="p-2 align-top">
                    <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => remover(t.id)}>
                      <Trash2 className="h-3.5 w-3.5 text-destructive" />
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  );
};
