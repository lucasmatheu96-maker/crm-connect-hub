// Componente reusável: editor de itens (orçamento/pedido) com seleção de produto
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Trash2 } from "lucide-react";
import { fmtMoney } from "@/lib/format";

export interface Item {
  produto_id?: string | null;
  descricao: string;
  quantidade: number;
  preco_unitario: number;
}

export function ItensEditor({
  itens, onChange,
}: { itens: Item[]; onChange: (i: Item[]) => void }) {
  const [produtos, setProdutos] = useState<any[]>([]);

  useEffect(() => {
    supabase.from("produtos").select("id, nome, preco").eq("ativo", true).then(({ data }) => setProdutos(data || []));
  }, []);

  const addItem = () => onChange([...itens, { descricao: "", quantidade: 1, preco_unitario: 0, produto_id: null }]);
  const update = (i: number, patch: Partial<Item>) => {
    const n = [...itens]; n[i] = { ...n[i], ...patch }; onChange(n);
  };
  const remove = (i: number) => onChange(itens.filter((_, idx) => idx !== i));
  const onProduto = (i: number, pid: string) => {
    const p = produtos.find((x) => x.id === pid);
    if (p) update(i, { produto_id: pid, descricao: p.nome, preco_unitario: Number(p.preco) });
  };

  const total = itens.reduce((s, it) => s + Number(it.quantidade) * Number(it.preco_unitario), 0);

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <Label>Itens</Label>
        <Button type="button" size="sm" variant="outline" onClick={addItem}><Plus className="h-3 w-3" /> Adicionar</Button>
      </div>

      {itens.length === 0 && <p className="text-xs text-muted-foreground">Nenhum item adicionado.</p>}

      <div className="space-y-2">
        {itens.map((it, i) => (
          <div key={i} className="grid grid-cols-12 gap-2 rounded-lg border p-2">
            <div className="col-span-12 sm:col-span-4">
              <Select value={it.produto_id || ""} onValueChange={(v) => onProduto(i, v)}>
                <SelectTrigger className="h-9 text-xs"><SelectValue placeholder="Selecione produto..." /></SelectTrigger>
                <SelectContent>
                  {produtos.map((p) => <SelectItem key={p.id} value={p.id}>{p.nome}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <Input className="col-span-6 sm:col-span-3 h-9 text-xs" placeholder="Descrição" value={it.descricao} onChange={(e) => update(i, { descricao: e.target.value })} />
            <Input className="col-span-3 sm:col-span-1 h-9 text-xs" type="number" min="0" step="0.01" value={it.quantidade} onChange={(e) => update(i, { quantidade: Number(e.target.value) })} />
            <Input className="col-span-3 sm:col-span-2 h-9 text-xs" type="number" min="0" step="0.01" value={it.preco_unitario} onChange={(e) => update(i, { preco_unitario: Number(e.target.value) })} />
            <div className="col-span-9 sm:col-span-1 text-right text-xs font-semibold self-center">{fmtMoney(it.quantidade * it.preco_unitario)}</div>
            <Button type="button" size="icon" variant="ghost" className="col-span-3 sm:col-span-1 h-9" onClick={() => remove(i)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
          </div>
        ))}
      </div>

      <div className="flex justify-end border-t pt-3">
        <div className="text-right">
          <div className="text-xs text-muted-foreground">Total</div>
          <div className="text-xl font-bold text-primary">{fmtMoney(total)}</div>
        </div>
      </div>
    </div>
  );
}
