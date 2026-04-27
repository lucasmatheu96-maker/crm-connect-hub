// Sincroniza tabelas do CRM para uma planilha do Google Sheets
// deno-lint-ignore-file no-explicit-any
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};
import { createClient } from "npm:@supabase/supabase-js@2.45.0";

const GATEWAY_URL = "https://connector-gateway.lovable.dev/google_sheets/v4";

const SHEETS = ["Clientes", "Produtos", "Orcamentos", "Pedidos", "Oportunidades"] as const;

function formatDateTimeForSheet(value: string | null | undefined) {
  if (!value) return "";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;

  return new Intl.DateTimeFormat("pt-BR", {
    timeZone: "America/Sao_Paulo",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).format(date);
}

function joinAddressParts(...parts: Array<string | null | undefined>) {
  return parts.map((part) => part?.trim()).filter(Boolean).join(", ");
}

function resolveGeoAddress(geoAddress: string | null | undefined, structuredAddress: string) {
  if (structuredAddress) return structuredAddress;
  return geoAddress?.trim() || "";
}

async function callSheets(method: string, path: string, sheetsKey: string, lovKey: string, body?: any) {
  const r = await fetch(`${GATEWAY_URL}${path}`, {
    method,
    headers: {
      "Authorization": `Bearer ${lovKey}`,
      "X-Connection-Api-Key": sheetsKey,
      "Content-Type": "application/json",
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const json = await r.json();
  if (!r.ok) throw new Error(`Sheets ${path} [${r.status}]: ${JSON.stringify(json)}`);
  return json;
}

async function ensureTabs(spreadsheetId: string, sheetsKey: string, lovKey: string) {
  const meta: any = await callSheets("GET", `/spreadsheets/${spreadsheetId}`, sheetsKey, lovKey);
  const existing = new Set<string>((meta.sheets || []).map((s: any) => s.properties.title));
  const requests: any[] = [];
  for (const tab of SHEETS) {
    if (!existing.has(tab)) requests.push({ addSheet: { properties: { title: tab } } });
  }
  if (requests.length) {
    await callSheets("POST", `/spreadsheets/${spreadsheetId}:batchUpdate`, sheetsKey, lovKey, { requests });
  }
}

async function writeTab(spreadsheetId: string, tab: string, rows: any[][], sheetsKey: string, lovKey: string) {
  // limpa
  await callSheets("POST", `/spreadsheets/${spreadsheetId}/values/${tab}!A:Z:clear`, sheetsKey, lovKey, {});
  // escreve
  await callSheets(
    "PUT",
    `/spreadsheets/${spreadsheetId}/values/${tab}!A1?valueInputOption=USER_ENTERED`,
    sheetsKey, lovKey,
    { values: rows },
  );
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const lovKey = Deno.env.get("LOVABLE_API_KEY");
    const sheetsKey = Deno.env.get("GOOGLE_SHEETS_API_KEY");
    if (!lovKey || !sheetsKey) throw new Error("Credenciais do Google Sheets não configuradas");

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // Auth: precisa estar logado e ser admin
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return new Response(JSON.stringify({ error: "Não autenticado" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    const token = authHeader.replace("Bearer ", "");
    const { data: userData } = await supabase.auth.getUser(token);
    if (!userData.user) return new Response(JSON.stringify({ error: "Não autenticado" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    const { data: roleRow } = await supabase.from("user_roles").select("role").eq("user_id", userData.user.id).eq("role", "admin").maybeSingle();
    if (!roleRow) return new Response(JSON.stringify({ error: "Apenas administradores" }), { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    // Lê configuração
    const { data: cfg } = await supabase.from("app_settings").select("google_sheet_id").eq("id", 1).maybeSingle();
    const spreadsheetId = cfg?.google_sheet_id;
    if (!spreadsheetId) throw new Error("ID da planilha não configurado em Configurações");

    await ensureTabs(spreadsheetId, sheetsKey, lovKey);

    // Carrega dados (admin → todos via service role)
    const [clientesQ, produtosQ, orcamentosQ, pedidosQ, oportQ] = await Promise.all([
      supabase.from("clientes").select("*").order("created_at", { ascending: false }),
      supabase.from("produtos").select("*").order("created_at", { ascending: false }),
      supabase.from("orcamentos").select("*, clientes(nome, endereco, cidade, estado, cep, geo_endereco)").order("created_at", { ascending: false }),
      supabase.from("pedidos").select("*, clientes(nome, endereco, cidade, estado, cep, geo_endereco)").order("created_at", { ascending: false }),
      supabase.from("oportunidades").select("*, clientes(nome)").order("created_at", { ascending: false }),
    ]);

    const clientesRows = [
      ["ID","Nome","Empresa","CPF/CNPJ","Email","Telefone","Endereço","Cidade","Estado","CEP","Lat","Lng","Endereço GPS","Criado em"],
      ...(clientesQ.data || []).map((c: any) => {
        const structuredAddress = joinAddressParts(c.endereco, c.cidade, c.estado, c.cep ? `CEP ${c.cep}` : null, "Brasil");
        return [c.id, c.nome, c.empresa, c.cpf_cnpj, c.email, c.telefone, c.endereco, c.cidade, c.estado, c.cep, c.geo_lat, c.geo_lng, resolveGeoAddress(c.geo_endereco, structuredAddress), formatDateTimeForSheet(c.created_at)];
      }),
    ];
    const produtosRows = [
      ["ID","Nome","SKU","Categoria","Preço","Estoque","Ativo","Criado em"],
      ...(produtosQ.data || []).map((p: any) => [p.id, p.nome, p.sku, p.categoria, p.preco, p.estoque, p.ativo, formatDateTimeForSheet(p.created_at)]),
    ];
    const orcRows = [
      ["Número","Cliente","Status","Validade","Total","Lat","Lng","Endereço GPS","Criado em"],
      ...(orcamentosQ.data || []).map((o: any) => {
        const structuredAddress = joinAddressParts(o.clientes?.endereco, o.clientes?.cidade, o.clientes?.estado, o.clientes?.cep ? `CEP ${o.clientes.cep}` : null, "Brasil");
        return [o.numero, o.clientes?.nome, o.status, o.validade, o.total, o.geo_lat, o.geo_lng, resolveGeoAddress(o.geo_endereco || o.clientes?.geo_endereco, structuredAddress), formatDateTimeForSheet(o.created_at)];
      }),
    ];
    const pedRows = [
      ["Número","Cliente","Status","Total","Lat","Lng","Endereço GPS","Criado em"],
      ...(pedidosQ.data || []).map((p: any) => {
        const structuredAddress = joinAddressParts(p.clientes?.endereco, p.clientes?.cidade, p.clientes?.estado, p.clientes?.cep ? `CEP ${p.clientes.cep}` : null, "Brasil");
        return [p.numero, p.clientes?.nome, p.status, p.total, p.geo_lat, p.geo_lng, resolveGeoAddress(p.geo_endereco || p.clientes?.geo_endereco, structuredAddress), formatDateTimeForSheet(p.created_at)];
      }),
    ];
    const opRows = [
      ["Título","Cliente","Estágio","Valor","Probabilidade","Fechamento previsto","Criado em"],
      ...(oportQ.data || []).map((o: any) => [o.titulo, o.clientes?.nome, o.estagio, o.valor, o.probabilidade, o.data_fechamento_prevista, formatDateTimeForSheet(o.created_at)]),
    ];

    await writeTab(spreadsheetId, "Clientes", clientesRows, sheetsKey, lovKey);
    await writeTab(spreadsheetId, "Produtos", produtosRows, sheetsKey, lovKey);
    await writeTab(spreadsheetId, "Orcamentos", orcRows, sheetsKey, lovKey);
    await writeTab(spreadsheetId, "Pedidos", pedRows, sheetsKey, lovKey);
    await writeTab(spreadsheetId, "Oportunidades", opRows, sheetsKey, lovKey);

    return new Response(JSON.stringify({
      success: true,
      counts: {
        clientes: clientesQ.data?.length || 0,
        produtos: produtosQ.data?.length || 0,
        orcamentos: orcamentosQ.data?.length || 0,
        pedidos: pedidosQ.data?.length || 0,
        oportunidades: oportQ.data?.length || 0,
      },
    }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e: any) {
    console.error("sync-sheets error:", e);
    return new Response(JSON.stringify({ error: e?.message || "erro desconhecido" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
