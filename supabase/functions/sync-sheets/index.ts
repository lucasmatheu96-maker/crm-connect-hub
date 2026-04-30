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
  // Sempre priorizar o endereço real obtido por GPS/geocoding (vendedor).
  // O endereço estruturado (cliente) só é usado como último recurso para o cadastro do cliente.
  const real = geoAddress?.toString().trim();
  if (real) return real;
  return structured || "";
}

function isCoordFallback(value: string | null | undefined) {
  if (!value) return true;
  const text = value.toString().trim();
  return /^Lat\s-?\d/i.test(text) || /^-?\d+(?:\.\d+)?,\s*-?\d+(?:\.\d+)?$/.test(text);
}

const geoCache = new Map<string, Promise<string>>();

async function reverseGeocodeFallback(lat: number, lng: number) {
  const url = `https://nominatim.openstreetmap.org/reverse?format=jsonv2&accept-language=pt-BR&lat=${lat}&lon=${lng}`;
  const response = await fetch(url, {
    headers: {
      "User-Agent": "Lovable CRM/1.0",
      "Accept-Language": "pt-BR",
    },
  });
  const data: any = await response.json().catch(() => ({}));
  const addr = data?.address ?? {};
  const street = [addr.road, addr.house_number].filter(Boolean).join(", ");
  const locality = [addr.suburb || addr.neighbourhood, addr.city || addr.town || addr.village].filter(Boolean).join(" - ");
  const region = [addr.state, addr.postcode ? `CEP ${addr.postcode}` : null, addr.country].filter(Boolean).join(", ");
  return [street, locality, region].filter(Boolean).join(" • ") || data?.display_name || "";
}

async function resolveGeoForExport(geoAddress: string | null | undefined, lat: number | null | undefined, lng: number | null | undefined) {
  const real = geoAddress?.toString().trim() || "";
  if (real && !isCoordFallback(real)) return real;
  if (typeof lat !== "number" || typeof lng !== "number") return "";

  const key = `${lat.toFixed(6)},${lng.toFixed(6)}`;
  if (!geoCache.has(key)) {
    geoCache.set(key, reverseGeocodeFallback(lat, lng).catch(() => ""));
  }
  return await geoCache.get(key)!;
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
  try {
    await callSheets("POST", `/spreadsheets/${spreadsheetId}/values/${tab}!A:Z:clear`, sheetsKey, lovKey, {});
    await callSheets(
      "PUT",
      `/spreadsheets/${spreadsheetId}/values/${tab}!A1?valueInputOption=USER_ENTERED`,
      sheetsKey, lovKey,
      { values: rows },
    );
    console.log(`[sync-sheets] writeTab ${tab}: ${rows.length - 1} linhas escritas`);
  } catch (e) {
    console.error(`[sync-sheets] writeTab ${tab} FALHOU:`, e);
    throw e;
  }
}

const BATCH_SIZE = 200;

function chunkArray<T>(items: T[], size = BATCH_SIZE) {
  const chunks: T[][] = [];
  for (let i = 0; i < items.length; i += size) {
    chunks.push(items.slice(i, i + size));
  }
  return chunks;
}

async function insertRowsInChunks(supabase: any, table: string, rows: any[]) {
  if (!rows.length) return 0;
  let inserted = 0;
  for (const chunk of chunkArray(rows)) {
    const { error } = await supabase.from(table).insert(chunk);
    if (error) throw error;
    inserted += chunk.length;
  }
  return inserted;
}

async function upsertRowsByIdInChunks(supabase: any, table: string, rows: any[]) {
  if (!rows.length) return;
  for (const chunk of chunkArray(rows)) {
    const { error } = await supabase.from(table).upsert(chunk, { onConflict: "id" });
    if (error) throw error;
  }
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
      const { data: existing } = await supabase.from("clientes").select("id, cpf_cnpj, source");
      const byCpf = new Map<string, { id: string; source: string | null }>();
      (existing || []).forEach((c: any) => {
        if (c.cpf_cnpj) byCpf.set(onlyDigits(c.cpf_cnpj), { id: c.id, source: c.source || null });
      });
      const toInsert: any[] = [];
      const toUpdate: any[] = [];

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
        const existingRow = byCpf.get(cpf);
        if (existingRow?.source === "sheet") {
          toUpdate.push({ id: existingRow.id, ...payload });
        } else if (!existingRow) {
          toInsert.push(payload);
        }
      }

      await upsertRowsByIdInChunks(supabase, "clientes", toUpdate);
      imported.clientes += await insertRowsInChunks(supabase, "clientes", toInsert);
    }

    // PRODUTOS — chave: SKU
    {
      const rows = await readTab(spreadsheetId, "Produtos", sheetsKey, lovKey);
      const objs = rowsToObjects(rows);
      const { data: existing } = await supabase.from("produtos").select("id, sku, source");
      const bySku = new Map<string, { id: string; source: string | null }>();
      (existing || []).forEach((p: any) => {
        if (p.sku) bySku.set(norm(p.sku), { id: p.id, source: p.source || null });
      });
      const toInsert: any[] = [];
      const toUpdate: any[] = [];

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
        const existingRow = bySku.get(sku);
        if (existingRow?.source === "sheet") {
          toUpdate.push({ id: existingRow.id, ...payload });
        } else if (!existingRow) {
          toInsert.push(payload);
        }
      }

      await upsertRowsByIdInChunks(supabase, "produtos", toUpdate);
      imported.produtos += await insertRowsInChunks(supabase, "produtos", toInsert);
    }

    const { data: clientesForDocs } = await supabase.from("clientes").select("id, cpf_cnpj, nome");
    const cliByCpf = new Map<string, string>();
    const cliByNome = new Map<string, string>();
    (clientesForDocs || []).forEach((c: any) => {
      if (c.cpf_cnpj) cliByCpf.set(onlyDigits(c.cpf_cnpj), c.id);
      if (c.nome) cliByNome.set(norm(c.nome), c.id);
    });

    // ORCAMENTOS / PEDIDOS — chave: Número (e cliente por CPF/CNPJ na coluna)
    // Para orçamentos/pedidos importados da planilha, exigimos CPF/CNPJ do cliente para vincular
    const importDocs = async (
      tab: "Orcamentos" | "Pedidos",
      table: "orcamentos" | "pedidos",
    ) => {
      const rows = await readTab(spreadsheetId, tab, sheetsKey, lovKey);
      const objs = rowsToObjects(rows);
      const { data: existing } = await supabase.from(table).select("id, numero, source");
      const byNumero = new Map<number, { id: string; source: string | null }>();
      (existing || []).forEach((d: any) => byNumero.set(Number(d.numero), { id: d.id, source: d.source || null }));
      const toInsert: any[] = [];
      const toUpdate: any[] = [];

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

        const existingRow = numero ? byNumero.get(numero) : null;
        if (existingRow?.source === "sheet") {
          toUpdate.push({ id: existingRow.id, ...base });
        } else {
          const insertPayload = numero ? { ...base, numero } : base;
          if (!existingRow) toInsert.push(insertPayload);
        }
      }

      await upsertRowsByIdInChunks(supabase, table, toUpdate);
      imported[table] += await insertRowsInChunks(supabase, table, toInsert);
    };
    await Promise.all([
      importDocs("Orcamentos", "orcamentos"),
      importDocs("Pedidos", "pedidos"),
    ]);

    // ============ FASE 2: EXPORTAR DO APP PARA A PLANILHA ============

    const [clientesQ, produtosQ, orcamentosQ, pedidosQ, oportQ] = await Promise.all([
      supabase.from("clientes").select("*").order("created_at", { ascending: false }).limit(5000),
      supabase.from("produtos").select("*").order("created_at", { ascending: false }).limit(5000),
      supabase.from("orcamentos").select("*").order("created_at", { ascending: false }).limit(5000),
      supabase.from("pedidos").select("*").order("created_at", { ascending: false }).limit(5000),
      supabase.from("oportunidades").select("*").order("created_at", { ascending: false }).limit(5000),
    ]);

    if (clientesQ.error) console.error("[sync-sheets] clientesQ error:", clientesQ.error);
    if (produtosQ.error) console.error("[sync-sheets] produtosQ error:", produtosQ.error);
    if (orcamentosQ.error) console.error("[sync-sheets] orcamentosQ error:", orcamentosQ.error);
    if (pedidosQ.error) console.error("[sync-sheets] pedidosQ error:", pedidosQ.error);
    if (oportQ.error) console.error("[sync-sheets] oportQ error:", oportQ.error);

    console.log(`[sync-sheets] export counts: clientes=${clientesQ.data?.length || 0} produtos=${produtosQ.data?.length || 0} orcamentos=${orcamentosQ.data?.length || 0} pedidos=${pedidosQ.data?.length || 0} oportunidades=${oportQ.data?.length || 0}`);

    // Mapa de clientes por id (para enriquecer orçamentos/pedidos/oportunidades sem depender de FK embed)
    const clienteById = new Map<string, any>();
    (clientesQ.data || []).forEach((c: any) => clienteById.set(c.id, c));

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
    const orcData = await Promise.all((orcamentosQ.data || []).map(async (o: any) => {
      const cli = clienteById.get(o.cliente_id);
      const geoAddress = await resolveGeoForExport(o.geo_endereco, o.geo_lat, o.geo_lng);
      return [o.numero, cli?.nome || "", cli?.cpf_cnpj || "", o.status, o.validade, o.total, o.geo_lat, o.geo_lng, geoAddress, o.source || "app", formatDateTimeForSheet(o.created_at)];
    }));
    const orcRows = [
      ["Número","Cliente","CPF/CNPJ Cliente","Status","Validade","Total","Lat","Lng","Endereço GPS","Fonte","Criado em"],
      ...orcData,
    ];
    const pedData = await Promise.all((pedidosQ.data || []).map(async (p: any) => {
      const cli = clienteById.get(p.cliente_id);
      const geoAddress = await resolveGeoForExport(p.geo_endereco, p.geo_lat, p.geo_lng);
      return [p.numero, cli?.nome || "", cli?.cpf_cnpj || "", p.status, p.total, p.geo_lat, p.geo_lng, geoAddress, p.source || "app", formatDateTimeForSheet(p.created_at)];
    }));
    const pedRows = [
      ["Número","Cliente","CPF/CNPJ Cliente","Status","Total","Lat","Lng","Endereço GPS","Fonte","Criado em"],
      ...pedData,
    ];
    const opData = await Promise.all((oportQ.data || []).map(async (o: any) => {
      const geoAddress = await resolveGeoForExport(o.geo_endereco, o.geo_lat, o.geo_lng);
      const cli = clienteById.get(o.cliente_id);
      return [o.titulo, cli?.nome || "", o.estagio, o.valor, o.probabilidade, o.data_fechamento_prevista, o.geo_lat, o.geo_lng, geoAddress, formatDateTimeForSheet(o.created_at)];
    }));
    const opRows = [
      ["Título","Cliente","Estágio","Valor","Probabilidade","Fechamento previsto","Lat","Lng","Endereço GPS","Criado em"],
      ...opData.map((o: any) => {
        return o;
      }),
    ];

    const writeResults = await Promise.allSettled([
      writeTab(spreadsheetId, "Clientes", clientesRows, sheetsKey, lovKey),
      writeTab(spreadsheetId, "Produtos", produtosRows, sheetsKey, lovKey),
      writeTab(spreadsheetId, "Orcamentos", orcRows, sheetsKey, lovKey),
      writeTab(spreadsheetId, "Pedidos", pedRows, sheetsKey, lovKey),
      writeTab(spreadsheetId, "Oportunidades", opRows, sheetsKey, lovKey),
    ]);
    writeResults.forEach((r, i) => {
      if (r.status === "rejected") console.error(`[sync-sheets] writeTab idx=${i} falhou:`, r.reason);
    });

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
