import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Upload, FileSpreadsheet } from "lucide-react";
import { toast } from "sonner";

type Kind = "clientes" | "produtos" | "documentos";
const LABELS: Record<Kind, string> = {
  clientes: "Clientes",
  produtos: "Produtos",
  documentos: "Orçamentos & Pedidos",
};

export function ImportadorPlanilhas() {
  const [busy, setBusy] = useState<Kind | null>(null);
  const [results, setResults] = useState<Record<string, any>>({});

  const handleUpload = async (kind: Kind, file: File) => {
    setBusy(kind);
    try {
      const form = new FormData();
      form.append("file", file);
      form.append("kind", kind);
      const { data: session } = await supabase.auth.getSession();
      const token = session.session?.access_token;
      const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/import-spreadsheet`;
      const resp = await fetch(url, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: form,
      });
      const json = await resp.json();
      if (!resp.ok) {
        toast.error(json.error || "Erro ao importar");
      } else {
        setResults((p) => ({ ...p, [kind]: json }));
        toast.success(
          `${LABELS[kind]}: ${json.inserted} novo(s), ${json.updated} atualizado(s), ${json.ignored} ignorado(s)`
        );
      }
    } catch (e: any) {
      toast.error(e.message || "Falha no upload");
    } finally {
      setBusy(null);
    }
  };

  return (
    <Card className="p-6 shadow-elevated max-w-2xl">
      <div className="flex items-center gap-3 mb-4">
        <div className="rounded-lg bg-brand-gradient p-2.5">
          <FileSpreadsheet className="h-5 w-5 text-primary-foreground" />
        </div>
        <div>
          <h3 className="font-semibold">Importação de planilhas (.xlsx / .xls)</h3>
          <p className="text-xs text-muted-foreground">
            Envie suas planilhas — o sistema atualiza registros existentes (chave: Código / CNPJ / SKU) e cria novos.
          </p>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        {(["clientes", "produtos", "documentos"] as Kind[]).map((k) => (
          <div key={k} className="space-y-2 rounded-lg border p-3">
            <Label className="text-sm font-medium">{LABELS[k]}</Label>
            <input
              type="file"
              accept=".xlsx,.xls,.csv"
              id={`file-${k}`}
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) handleUpload(k, f);
                e.target.value = "";
              }}
            />
            <Button
              variant="outline"
              className="w-full"
              disabled={busy !== null}
              onClick={() => document.getElementById(`file-${k}`)?.click()}
            >
              <Upload className="h-4 w-4" />
              {busy === k ? "Importando..." : "Selecionar arquivo"}
            </Button>
            {results[k] && (
              <div className="text-[11px] text-muted-foreground space-y-0.5">
                <div>✓ {results[k].inserted} novo(s)</div>
                <div>↻ {results[k].updated} atualizado(s)</div>
                <div>– {results[k].ignored} ignorado(s)</div>
                {results[k].errors?.length > 0 && (
                  <details className="mt-1">
                    <summary className="cursor-pointer text-destructive">
                      {results[k].errors.length} erro(s)
                    </summary>
                    <ul className="mt-1 max-h-32 overflow-y-auto pl-3">
                      {results[k].errors.map((e: string, i: number) => (
                        <li key={i} className="text-[10px]">{e}</li>
                      ))}
                    </ul>
                  </details>
                )}
              </div>
            )}
          </div>
        ))}
      </div>

      <div className="mt-4 rounded-lg border border-dashed bg-muted/40 p-3 text-xs text-muted-foreground space-y-1">
        <p className="font-medium text-foreground">Regras da importação:</p>
        <p>• <strong>Clientes</strong>: chave por Código ou CNPJ. Vendedor da planilha vira o "dono" (se já cadastrado no sistema).</p>
        <p>• <strong>Produtos</strong>: chave por Código. Importa Descrição, Unid., Disponível e Vlr. Consumidor (vira "Preço sugerido").</p>
        <p>• <strong>Orçamentos & Pedidos</strong>: classifica automaticamente por "Situação"; ignora OS Entregue e finalidades diferentes de Venda. Cria cliente mínimo se não existir.</p>
      </div>
    </Card>
  );
}
