import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/PageHeader";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { Sheet, RefreshCw, ExternalLink } from "lucide-react";
import { ImportadorPlanilhas } from "@/components/ImportadorPlanilhas";

export default function Configuracoes() {
  const [sheetId, setSheetId] = useState("");
  const [syncEnabled, setSyncEnabled] = useState(false);
  const [busy, setBusy] = useState(false);
  const [syncing, setSyncing] = useState(false);

  useEffect(() => {
    supabase.from("app_settings").select("*").eq("id", 1).maybeSingle().then(({ data }) => {
      if (data) { setSheetId(data.google_sheet_id || ""); setSyncEnabled(data.sync_enabled); }
    });
  }, []);

  const save = async () => {
    setBusy(true);
    const id = extractId(sheetId);
    const { error } = await supabase.from("app_settings").update({
      google_sheet_id: id || null, sync_enabled: syncEnabled,
    }).eq("id", 1);
    setBusy(false);
    if (error) toast.error(error.message);
    else toast.success("Configurações salvas");
  };

  const sync = async () => {
    setSyncing(true);
    const { data, error } = await supabase.functions.invoke("sync-sheets");
    setSyncing(false);
    if (error || data?.error) {
      toast.error(data?.error || error?.message || "Erro ao sincronizar");
      return;
    }
    const importedTxt = data.imported
      ? Object.entries(data.imported).filter(([,v]) => (v as number) > 0).map(([k,v]) => `+${v} ${k}`).join(" • ")
      : "";
    const totalsTxt = Object.entries(data.counts).map(([k,v]) => `${v} ${k}`).join(" • ");
    toast.success(`Sincronizado${importedTxt ? ` (importados: ${importedTxt})` : ""} • Totais: ${totalsTxt}`);
  };

  const extractId = (s: string) => {
    const m = s.match(/\/d\/([a-zA-Z0-9-_]+)/);
    return m ? m[1] : s.trim();
  };

  return (
    <div>
      <PageHeader title="Configurações" description="Integração e sincronização (apenas administradores)" />

      <Card className="p-6 shadow-elevated max-w-2xl">
        <div className="flex items-center gap-3 mb-4">
          <div className="rounded-lg bg-brand-gradient p-2.5"><Sheet className="h-5 w-5 text-primary-foreground" /></div>
          <div>
            <h3 className="font-semibold">Google Sheets</h3>
            <p className="text-xs text-muted-foreground">Espelhe todos os dados do CRM em uma planilha do Google Sheets.</p>
          </div>
        </div>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label>ID ou URL da planilha</Label>
            <Input
              placeholder="https://docs.google.com/spreadsheets/d/SEU_ID/edit"
              value={sheetId}
              onChange={(e) => setSheetId(e.target.value)}
            />
            <p className="text-[11px] text-muted-foreground">
              Crie uma planilha no Google Sheets e <strong>compartilhe-a com permissão de Editor</strong> para a conta Google que você usou ao conectar — ou para qualquer um com o link. Cole o link aqui.
            </p>
          </div>

          <div className="rounded-lg border border-dashed bg-muted/40 p-3 text-xs text-muted-foreground space-y-1">
            <p className="font-medium text-foreground">Como funciona a sincronização (bidirecional):</p>
            <p>1. <strong>Importa</strong> primeiro novos dados da planilha para o app:</p>
            <p className="pl-3">• <strong>Clientes</strong>: identificados pelo <strong>CPF/CNPJ</strong></p>
            <p className="pl-3">• <strong>Produtos</strong>: identificados pelo <strong>SKU</strong></p>
            <p className="pl-3">• <strong>Orçamentos/Pedidos</strong>: vinculados pelo <strong>CPF/CNPJ Cliente</strong> (ou Nome)</p>
            <p>2. Depois <strong>exporta</strong> tudo do app para a planilha (com coluna "Fonte").</p>
            <p>3. Registros vindos da planilha (Fonte = <em>sheet</em>) <strong>só podem ser editados/excluídos por administradores</strong>.</p>
          </div>

          <div className="flex items-center justify-between rounded-lg border p-3">
            <div>
              <Label className="font-medium">Sincronização habilitada</Label>
              <p className="text-xs text-muted-foreground">Permite sincronizar manualmente quando ligado.</p>
            </div>
            <Switch checked={syncEnabled} onCheckedChange={setSyncEnabled} />
          </div>

          <div className="flex flex-wrap gap-2">
            <Button onClick={save} disabled={busy} variant="brand">{busy ? "Salvando..." : "Salvar configurações"}</Button>
            <Button onClick={sync} disabled={syncing || !syncEnabled || !sheetId} variant="outline">
              <RefreshCw className={`h-4 w-4 ${syncing ? "animate-spin" : ""}`} /> {syncing ? "Sincronizando..." : "Sincronizar agora"}
            </Button>
            {sheetId && (
              <Button variant="ghost" asChild>
                <a href={`https://docs.google.com/spreadsheets/d/${extractId(sheetId)}/edit`} target="_blank" rel="noreferrer">
                  Abrir planilha <ExternalLink className="h-3 w-3" />
                </a>
              </Button>
            )}
          </div>
        </div>
      </Card>
    </div>
  );
}
