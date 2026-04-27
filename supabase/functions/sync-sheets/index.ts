// Sincroniza tabelas do CRM <-> planilha do Google Sheets (bidirecional)
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
    day: "2-digit", month: "2-digit", year: "numeric",
    hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false,
  }).format(date);
}

function joinAddressParts(...parts: Array<string | null | undefined>) {
  return parts.map((p) => p?.toString().trim()).filter(Boolean).join(", ");
}
function resolveGeoAddress(geoAddress: string | null | undefined, structured: string) {
  if (structured) return structured;
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

async function readTab(spreadsheetId: string, tab: string, sheetsKey: string, lovKey: string): Promise<any[][]> {
  try {
    const res: any = await callSheets("GET", `/spreadsheets/${spreadsheetId}/values/${tab}!A1:Z10000`, sheetsKey, lovKey);
    return res.values || [];
  } catch {
    return [];
  }
}

async function writeTab(spreadsheetId: string, tab: string, rows: any[][], sheetsKey: string, lovKey: string) {
  await callSheets("POST", `/spreadsheets/${spreadsheetId}/values/${tab}!A:Z:clear`, sheetsKey, lovKey, {});
  await callSheets(
    "PUT",
    `/spreadsheets/${spreadsheetId}/values/${tab}!A1?valueInputOption=USER_ENTERED`,
    sheetsKey, lovKey,
    { values: rows },
  );
}

function rowsToObjects(rows: any[][]): Record<string, string>[] {
  if (!rows.length) return [];
  const headers = rows[0].map((h) => String(h || "").trim());
  return rows.slice(1).map((r) => {
    const obj: Record<string, string> = {};
    headers.forEach((h, i) => { obj[h] = r[i] != null ? String(r[i]).trim() : ""; });
    return obj;
  }).filter((o) => Object.values(o).some((v) => v !== ""));
}

const norm = (s: string) => (s || "").toLowerCase().trim();
const onlyDigits = (s: string) => (s || "").replace(/\D/g, "");
const toNum = (s: string) => {
  if (!s) return 0;
  const n = parseFloat(String(s).replace(/\./g, "").replace(",", "."));
  return Number.isNaN(n) ? 0 : n;
};
const toInt = (s: string) => {
  const n = parseInt(String(s || "0").replace(/\D/g, ""), 10);
  return Number.isNaN(n) ? 0 : n;
};
const toBool = (s: string) => ["true", "1", "sim", "yes", "x"].includes(norm(s));

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

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return new Response(JSON.stringify({ error: "Não autenticado" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    const token = authHeader.replace("Bearer ", "");
    const { data: userData } = await supabase.auth.getUser(token);
    if (!userData.user) return new Response(JSON.stringify({ error: "Não autenticado" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    const { data: roleRow } = await supabase.from("user_roles").select("role").eq("user_id", userData.user.id).eq("role", "admin").maybeSingle();
    if (!roleRow) return new Response(JSON.stringify({ error: "Apenas administradores" }), { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    const adminUserId = userData.user.id;

    const { data: cfg } = await supabase.from("app_settings").select("google_sheet_id").eq("id", 1).maybeSingle();
    const spreadsheetId = cfg?.google_sheet_id;
    if (!spreadsheetId) throw new Error("ID da planilha não configurado em Configurações");

    await ensureTabs(spreadsheetId, sheetsKey, lovKey);

    const imported = { clientes: 0, produtos: 0, orcamentos: 0, pedidos: 0 };

    // ============ FASE 1: IMPORTAR DA PLANILHA ============

    // CLIENTES — chave: CPF/CNPJ
    {
      const rows = await readTab(spreadsheetId, "Clientes", sheetsKey, lovKey);
      const objs = rowsToObjects(rows);
      const { data: existing } = await supabase.from("clientes").select("id, cpf_cnpj");
      const byCpf = new Map<string, string>();
      (existing || []).forEach((c: any) => { if (c.cpf_cnpj) byCpf.set(onlyDigits(c.cpf_cnpj), c.id); });

      for (const o of objs) {
        const cpf = onlyDigits(o["CPF/CNPJ"] || "");
        if (!cpf) continue; // sem chave -> ignora
        const payload = {
          owner_id: adminUserId,
          source: "sheet",
          nome: o["Nome"] || "(sem nome)",
          empresa: o["Empresa"] || null,
          cpf_cnpj: o["CPF/CNPJ"] || null,
          email: o["Email"] || null,
          telefone: o["Telefone"] || null,
          endereco: o["Endereço"] || null,
          cidade: o["Cidade"] || null,
          estado: o["Estado"] || null,
          cep: o["CEP"] || null,
          geo_lat: o["Lat"] ? toNum(o["Lat"]) : null,
          geo_lng: o["Lng"] ? toNum(o["Lng"]) : null,
          geo_endereco: o["Endereço GPS"] || null,
        };
        const existingId = byCpf.get(cpf);
        if (existingId) {
          // Só atualiza se já está marcado como source=sheet (preserva edições do app)
          await supabase.from("clientes").update(payload).eq("id", existingId).eq("source", "sheet");
        } else {
          const { error } = await supabase.from("clientes").insert(payload);
          if (!error) imported.clientes++;
        }
      }
    }

    // PRODUTOS — chave: SKU
    {
      const rows = await readTab(spreadsheetId, "Produtos", sheetsKey, lovKey);
      const objs = rowsToObjects(rows);
      const { data: existing } = await supabase.from("produtos").select("id, sku");
      const bySku = new Map<string, string>();
      (existing || []).forEach((p: any) => { if (p.sku) bySku.set(norm(p.sku), p.id); });

      for (const o of objs) {
        const sku = norm(o["SKU"] || "");
        if (!sku) continue;
        const payload = {
          owner_id: adminUserId,
          source: "sheet",
          nome: o["Nome"] || "(sem nome)",
          sku: o["SKU"] || null,
          categoria: o["Categoria"] || null,
          preco: toNum(o["Preço"] || "0"),
          estoque: toInt(o["Estoque"] || "0"),
          ativo: o["Ativo"] === "" ? true : toBool(o["Ativo"]),
        };
        const existingId = bySku.get(sku);
        if (existingId) {
          await supabase.from("produtos").update(payload).eq("id", existingId).eq("source", "sheet");
        } else {
          const { error } = await supabase.from("produtos").insert(payload);
          if (!error) imported.produtos++;
        }
      }
    }

    // ORCAMENTOS / PEDIDOS — chave: Número (e cliente por CPF/CNPJ na coluna)
    // Para orçamentos/pedidos importados da planilha, exigimos CPF/CNPJ do cliente para vincular
    const importDocs = async (
      tab: "Orcamentos" | "Pedidos",
      table: "orcamentos" | "pedidos",
    ) => {
      const rows = await readTab(spreadsheetId, tab, sheetsKey, lovKey);
      const objs = rowsToObjects(rows);
      const { data: existing } = await supabase.from(table).select("id, numero");
      const byNumero = new Map<number, string>();
      (existing || []).forEach((d: any) => byNumero.set(Number(d.numero), d.id));

      const { data: cli } = await supabase.from("clientes").select("id, cpf_cnpj, nome");
      const cliByCpf = new Map<string, string>();
      const cliByNome = new Map<string, string>();
      (cli || []).forEach((c: any) => {
        if (c.cpf_cnpj) cliByCpf.set(onlyDigits(c.cpf_cnpj), c.id);
        if (c.nome) cliByNome.set(norm(c.nome), c.id);
      });

      for (const o of objs) {
        const numero = toInt(o["Número"] || "0");
        const cpfCol = onlyDigits(o["CPF/CNPJ Cliente"] || "");
        const clienteId = (cpfCol && cliByCpf.get(cpfCol)) || cliByNome.get(norm(o["Cliente"] || ""));
        if (!clienteId) continue; // sem cliente → ignora

        const base: any = {
          owner_id: adminUserId,
          source: "sheet",
          cliente_id: clienteId,
          status: o["Status"] || (table === "orcamentos" ? "rascunho" : "novo"),
          total: toNum(o["Total"] || "0"),
          geo_lat: o["Lat"] ? toNum(o["Lat"]) : null,
          geo_lng: o["Lng"] ? toNum(o["Lng"]) : null,
          geo_endereco: o["Endereço GPS"] || null,
        };
        if (table === "orcamentos" && o["Validade"]) base.validade = o["Validade"];

        if (numero && byNumero.has(numero)) {
          await supabase.from(table).update(base).eq("id", byNumero.get(numero)!).eq("source", "sheet");
        } else {
          const insertPayload = numero ? { ...base, numero } : base;
          const { error } = await supabase.from(table).insert(insertPayload);
          if (!error) imported[table]++;
        }
      }
    };
    await importDocs("Orcamentos", "orcamentos");
    await importDocs("Pedidos", "pedidos");

    // ============ FASE 2: EXPORTAR DO APP PARA A PLANILHA ============

    const [clientesQ, produtosQ, orcamentosQ, pedidosQ, oportQ] = await Promise.all([
      supabase.from("clientes").select("*").order("created_at", { ascending: false }),
      supabase.from("produtos").select("*").order("created_at", { ascending: false }),
      supabase.from("orcamentos").select("*, clientes(nome, cpf_cnpj, endereco, cidade, estado, cep, geo_endereco)").order("created_at", { ascending: false }),
      supabase.from("pedidos").select("*, clientes(nome, cpf_cnpj, endereco, cidade, estado, cep, geo_endereco)").order("created_at", { ascending: false }),
      supabase.from("oportunidades").select("*, clientes(nome)").order("created_at", { ascending: false }),
    ]);

    const clientesRows = [
      ["ID","Nome","Empresa","CPF/CNPJ","Email","Telefone","Endereço","Cidade","Estado","CEP","Lat","Lng","Endereço GPS","Fonte","Criado em"],
      ...(clientesQ.data || []).map((c: any) => {
        const struct = joinAddressParts(c.endereco, c.cidade, c.estado, c.cep ? `CEP ${c.cep}` : null, "Brasil");
        return [c.id, c.nome, c.empresa, c.cpf_cnpj, c.email, c.telefone, c.endereco, c.cidade, c.estado, c.cep, c.geo_lat, c.geo_lng, resolveGeoAddress(c.geo_endereco, struct), c.source || "app", formatDateTimeForSheet(c.created_at)];
      }),
    ];
    const produtosRows = [
      ["ID","Nome","SKU","Categoria","Preço","Estoque","Ativo","Fonte","Criado em"],
      ...(produtosQ.data || []).map((p: any) => [p.id, p.nome, p.sku, p.categoria, p.preco, p.estoque, p.ativo, p.source || "app", formatDateTimeForSheet(p.created_at)]),
    ];
    const orcRows = [
      ["Número","Cliente","CPF/CNPJ Cliente","Status","Validade","Total","Lat","Lng","Endereço GPS","Fonte","Criado em"],
      ...(orcamentosQ.data || []).map((o: any) => {
        const struct = joinAddressParts(o.clientes?.endereco, o.clientes?.cidade, o.clientes?.estado, o.clientes?.cep ? `CEP ${o.clientes.cep}` : null, "Brasil");
        return [o.numero, o.clientes?.nome, o.clientes?.cpf_cnpj, o.status, o.validade, o.total, o.geo_lat, o.geo_lng, resolveGeoAddress(o.geo_endereco || o.clientes?.geo_endereco, struct), o.source || "app", formatDateTimeForSheet(o.created_at)];
      }),
    ];
    const pedRows = [
      ["Número","Cliente","CPF/CNPJ Cliente","Status","Total","Lat","Lng","Endereço GPS","Fonte","Criado em"],
      ...(pedidosQ.data || []).map((p: any) => {
        const struct = joinAddressParts(p.clientes?.endereco, p.clientes?.cidade, p.clientes?.estado, p.clientes?.cep ? `CEP ${p.clientes.cep}` : null, "Brasil");
        return [p.numero, p.clientes?.nome, p.clientes?.cpf_cnpj, p.status, p.total, p.geo_lat, p.geo_lng, resolveGeoAddress(p.geo_endereco || p.clientes?.geo_endereco, struct), p.source || "app", formatDateTimeForSheet(p.created_at)];
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
      imported,
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
