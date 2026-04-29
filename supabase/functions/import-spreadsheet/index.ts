// Importa planilhas (.xlsx/.xls/.csv) de Clientes, Produtos, Orçamentos/Pedidos
// deno-lint-ignore-file no-explicit-any
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};
import { createClient } from "npm:@supabase/supabase-js@2.45.0";
import * as XLSX from "npm:xlsx@0.18.5";

const onlyDigits = (s: any) => String(s ?? "").replace(/\D/g, "");
const norm = (s: any) => String(s ?? "").trim();
const normLower = (s: any) => norm(s).toLowerCase();
const toNumBR = (v: any): number => {
  if (v == null || v === "") return 0;
  if (typeof v === "number") return v;
  const s = String(v).trim().replace(/\s/g, "");
  // suporta "1.234,56" e "1234.56"
  const cleaned = s.includes(",") && s.includes(".")
    ? s.replace(/\./g, "").replace(",", ".")
    : s.includes(",") ? s.replace(",", ".") : s;
  const n = parseFloat(cleaned);
  return Number.isNaN(n) ? 0 : n;
};
const parseDateBR = (v: any): string | null => {
  if (!v) return null;
  if (v instanceof Date) return v.toISOString().slice(0, 10);
  const s = String(v).trim();
  // dd/mm/yyyy
  const m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})/);
  if (m) {
    const yy = m[3].length === 2 ? "20" + m[3] : m[3];
    return `${yy}-${m[2].padStart(2, "0")}-${m[1].padStart(2, "0")}`;
  }
  return null;
};
const parseDateTimeBR = (v: any): string | null => {
  if (!v) return null;
  if (v instanceof Date) return v.toISOString();
  const s = String(v).trim();
  const m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})(?:\s+(\d{1,2}):(\d{2})(?::(\d{2}))?)?/);
  if (m) {
    const yy = m[3].length === 2 ? "20" + m[3] : m[3];
    const time = m[4] ? `${m[4].padStart(2,"0")}:${m[5]}:${m[6] || "00"}` : "00:00:00";
    return `${yy}-${m[2].padStart(2,"0")}-${m[1].padStart(2,"0")}T${time}-03:00`;
  }
  return null;
};

// Mapeia "Situação" da planilha para status interno + status_externo bruto
type DocKind = "orcamento" | "pedido" | "ignore";
function classifyDoc(situacao: string): { kind: DocKind; statusInterno: string } {
  const s = normLower(situacao);
  if (s.includes("os ")) return { kind: "ignore", statusInterno: "" };
  if (s.includes("orçamento") || s.includes("orcamento")) {
    if (s.includes("encerrado")) return { kind: "orcamento", statusInterno: "aprovado" };
    if (s.includes("aprovação") || s.includes("aprovacao")) return { kind: "orcamento", statusInterno: "enviado" };
    if (s.includes("digitação") || s.includes("digitacao")) return { kind: "orcamento", statusInterno: "rascunho" };
    return { kind: "orcamento", statusInterno: "rascunho" };
  }
  if (s.includes("pedido") || s.includes("nf-e") || s.includes("nfe") || s.includes("encerrado") || s.includes("faturamento")) {
    if (s.includes("nf-e") || s.includes("nfe")) return { kind: "pedido", statusInterno: "faturado" };
    if (s.includes("encerrado") || s.includes("faturamento")) return { kind: "pedido", statusInterno: "entregue" };
    if (s.includes("digitação") || s.includes("digitacao")) return { kind: "pedido", statusInterno: "novo" };
    return { kind: "pedido", statusInterno: "novo" };
  }
  if (s.includes("aguardando aprovação") || s.includes("aguardando aprovacao")) {
    return { kind: "orcamento", statusInterno: "enviado" };
  }
  return { kind: "ignore", statusInterno: "" };
}

// Encontra o valor de uma coluna tentando variações de nome (case/acento-insensitive)
function getCol(row: Record<string, any>, ...names: string[]): any {
  const keys = Object.keys(row);
  for (const n of names) {
    const target = normLower(n).replace(/[^a-z0-9]/g, "");
    for (const k of keys) {
      const kn = normLower(k).replace(/[^a-z0-9]/g, "");
      if (kn === target) return row[k];
    }
  }
  return "";
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Não autenticado" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const token = authHeader.replace("Bearer ", "");
    const { data: userData } = await supabase.auth.getUser(token);
    if (!userData.user) {
      return new Response(JSON.stringify({ error: "Não autenticado" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const { data: roleRow } = await supabase.from("user_roles").select("role")
      .eq("user_id", userData.user.id).eq("role", "admin").maybeSingle();
    if (!roleRow) {
      return new Response(JSON.stringify({ error: "Apenas administradores podem importar" }), {
        status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const adminUserId = userData.user.id;

    const form = await req.formData();
    const file = form.get("file") as File | null;
    const kind = String(form.get("kind") || ""); // 'clientes' | 'produtos' | 'documentos'
    if (!file || !["clientes", "produtos", "documentos"].includes(kind)) {
      return new Response(JSON.stringify({ error: "Arquivo ou tipo inválido" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const buf = new Uint8Array(await file.arrayBuffer());
    const wb = XLSX.read(buf, { type: "array", cellDates: true });
    const sheetName = wb.SheetNames[0];
    const ws = wb.Sheets[sheetName];
    const rows: Record<string, any>[] = XLSX.utils.sheet_to_json(ws, { defval: "" });

    // Carrega usuários autorizados para mapear vendedor → user_id
    const { data: profiles } = await supabase.from("profiles").select("user_id, nome");
    const profByName = new Map<string, string>();
    (profiles || []).forEach((p: any) => {
      if (p.nome) profByName.set(normLower(p.nome).replace(/[^a-z0-9]/g, ""), p.user_id);
    });
    const findVendedor = (nome: string): string => {
      const n = normLower(nome).replace(/[^a-z0-9]/g, "");
      if (!n) return adminUserId;
      if (profByName.has(n)) return profByName.get(n)!;
      // tenta prefix-match
      for (const [k, v] of profByName) {
        if (k.startsWith(n) || n.startsWith(k)) return v;
      }
      return adminUserId;
    };

    const result: any = { kind, total: rows.length, inserted: 0, updated: 0, ignored: 0, errors: [] as string[] };

    if (kind === "clientes") {
      const { data: existing } = await supabase.from("clientes")
        .select("id, codigo_externo, cpf_cnpj");
      const byCodigo = new Map<string, string>();
      const byCpf = new Map<string, string>();
      (existing || []).forEach((c: any) => {
        if (c.codigo_externo) byCodigo.set(String(c.codigo_externo), c.id);
        if (c.cpf_cnpj) byCpf.set(onlyDigits(c.cpf_cnpj), c.id);
      });

      for (const r of rows) {
        const codigo = norm(getCol(r, "Código", "Codigo"));
        const razao = norm(getCol(r, "Razão Social / Nome", "Razão Social", "Razao Social"));
        if (!razao && !codigo) { result.ignored++; continue; }
        const cpf = norm(getCol(r, "CNPJ / CPF / R.U.", "CNPJ/CPF/R.U.", "CNPJ", "CPF"));
        const fantasia = norm(getCol(r, "Nome Fantasia"));
        const vendedorNome = norm(getCol(r, "Vendedor / Responsável", "Vendedor"));
        const ownerId = findVendedor(vendedorNome);

        const payload: any = {
          owner_id: ownerId,
          source: "sheet",
          codigo_externo: codigo || null,
          razao_social: razao || null,
          nome_fantasia: fantasia || null,
          nome: fantasia || razao || "(sem nome)",
          empresa: razao || null,
          cpf_cnpj: cpf || null,
          email: norm(getCol(r, "E-mail", "Email")) || null,
          telefone: norm(getCol(r, "Telefone")) || null,
          cidade: norm(getCol(r, "Cidade")) || null,
          uf: norm(getCol(r, "UF")) || null,
          estado: norm(getCol(r, "UF")) || null,
          cep: norm(getCol(r, "CEP")) || null,
          vendedor_responsavel: vendedorNome || null,
          status_financeiro: norm(getCol(r, "Status Financeiro")) || null,
        };

        const existingId = (codigo && byCodigo.get(codigo)) || (cpf && byCpf.get(onlyDigits(cpf)));
        if (existingId) {
          const { error } = await supabase.from("clientes").update(payload).eq("id", existingId);
          if (error) { result.errors.push(`Cliente ${codigo || razao}: ${error.message}`); }
          else result.updated++;
        } else {
          const { error } = await supabase.from("clientes").insert(payload);
          if (error) { result.errors.push(`Cliente ${codigo || razao}: ${error.message}`); }
          else result.inserted++;
        }
      }
    }

    else if (kind === "produtos") {
      const { data: existing } = await supabase.from("produtos")
        .select("id, codigo_externo, sku");
      const byCodigo = new Map<string, string>();
      (existing || []).forEach((p: any) => {
        if (p.codigo_externo) byCodigo.set(String(p.codigo_externo), p.id);
        if (p.sku) byCodigo.set(String(p.sku), p.id); // overlap
      });

      for (const r of rows) {
        const codigo = norm(getCol(r, "Código", "Codigo"));
        const descricao = norm(getCol(r, "Produto (Descrição Completa)", "Produto", "Descrição Completa"));
        if (!codigo && !descricao) { result.ignored++; continue; }
        const preco = toNumBR(getCol(r, "Vlr. Consumidor", "Vlr Consumidor", "Preço Sugerido", "Preço"));
        const disponivel = toNumBR(getCol(r, "Disponível", "Disponivel"));
        const unidade = norm(getCol(r, "Unid.", "Unidade", "Unid"));
        const classificacao = norm(getCol(r, "Classificação", "Classificacao", "Classificação Produto"));

        const payload: any = {
          owner_id: adminUserId, // produtos pertencem ao admin
          source: "sheet",
          codigo_externo: codigo || null,
          sku: codigo || null,
          nome: descricao || `Produto ${codigo}`,
          descricao: descricao || null,
          categoria: classificacao || null,
          unidade: unidade || null,
          preco: preco,
          preco_sugerido: preco,
          disponivel: disponivel,
          estoque: Math.max(0, Math.floor(disponivel)),
          ativo: true,
        };

        const existingId = byCodigo.get(codigo);
        if (existingId) {
          const { error } = await supabase.from("produtos").update(payload).eq("id", existingId);
          if (error) { result.errors.push(`Produto ${codigo}: ${error.message}`); }
          else result.updated++;
        } else {
          const { error } = await supabase.from("produtos").insert(payload);
          if (error) { result.errors.push(`Produto ${codigo}: ${error.message}`); }
          else result.inserted++;
        }
      }
    }

    else if (kind === "documentos") {
      // Carrega clientes existentes para mapear
      const { data: clis } = await supabase.from("clientes")
        .select("id, codigo_externo, cpf_cnpj, razao_social, nome");
      const cliByCodigo = new Map<string, string>();
      const cliByCpf = new Map<string, string>();
      const cliByRazao = new Map<string, string>();
      (clis || []).forEach((c: any) => {
        if (c.codigo_externo) cliByCodigo.set(String(c.codigo_externo), c.id);
        if (c.cpf_cnpj) cliByCpf.set(onlyDigits(c.cpf_cnpj), c.id);
        const razao = c.razao_social || c.nome;
        if (razao) cliByRazao.set(normLower(razao), c.id);
      });

      const { data: existingOrc } = await supabase.from("orcamentos")
        .select("id, codigo_externo");
      const { data: existingPed } = await supabase.from("pedidos")
        .select("id, codigo_externo");
      const orcByCodigo = new Map<string, string>();
      const pedByCodigo = new Map<string, string>();
      (existingOrc || []).forEach((o: any) => o.codigo_externo && orcByCodigo.set(String(o.codigo_externo), o.id));
      (existingPed || []).forEach((p: any) => p.codigo_externo && pedByCodigo.set(String(p.codigo_externo), p.id));

      for (const r of rows) {
        const finalidade = normLower(getCol(r, "Finalidade"));
        if (!finalidade.startsWith("venda")) { result.ignored++; continue; }

        const situacao = norm(getCol(r, "Situação", "Situacao"));
        const cls = classifyDoc(situacao);
        if (cls.kind === "ignore") { result.ignored++; continue; }

        const codigo = norm(getCol(r, "Código", "Codigo"));
        if (!codigo) { result.ignored++; continue; }

        const cpf = onlyDigits(getCol(r, "CNPJ / CPF / R.U.", "CNPJ/CPF/R.U.", "CNPJ"));
        const razao = norm(getCol(r, "Razão Social / Nome", "Razão Social"));
        const fantasia = norm(getCol(r, "Nome Fantasia"));
        const cidade = norm(getCol(r, "Cidade"));
        const uf = norm(getCol(r, "UF"));
        const respDoc = norm(getCol(r, "Responsável Documento", "Responsavel Documento"));

        // Resolve cliente_id
        let clienteId = cliByCodigo.get(norm(getCol(r, "Cliente"))) // "Cliente" às vezes traz código
          || (cpf && cliByCpf.get(cpf))
          || cliByRazao.get(normLower(razao))
          || cliByRazao.get(normLower(fantasia));

        if (!clienteId) {
          // cria cliente mínimo
          const ownerId = findVendedor(respDoc);
          const novo: any = {
            owner_id: ownerId,
            source: "sheet",
            razao_social: razao || null,
            nome_fantasia: fantasia || null,
            nome: fantasia || razao || `Cliente ${codigo}`,
            empresa: razao || null,
            cpf_cnpj: getCol(r, "CNPJ / CPF / R.U.", "CNPJ") || null,
            cidade: cidade || null,
            uf: uf || null,
            estado: uf || null,
          };
          const { data: novoCli, error: ec } = await supabase.from("clientes").insert(novo).select("id").single();
          if (ec || !novoCli) { result.errors.push(`Doc ${codigo}: erro criando cliente: ${ec?.message}`); result.ignored++; continue; }
          clienteId = novoCli.id;
          if (cpf) cliByCpf.set(cpf, clienteId);
          if (razao) cliByRazao.set(normLower(razao), clienteId);
        }

        const ownerId = findVendedor(respDoc);
        const orig = norm(getCol(r, "Orig. / Dest.", "Orig./Dest.", "Orig/Dest"));
        const valorTotal = toNumBR(getCol(r, "Valor Total"));
        const dataDoc = parseDateBR(getCol(r, "Data Documento"));
        const dataSit = parseDateTimeBR(getCol(r, "Data Situação", "Data Situacao"));

        const basePayload: any = {
          owner_id: ownerId,
          source: "sheet",
          cliente_id: clienteId,
          codigo_externo: codigo,
          total: valorTotal,
          data_documento: dataDoc,
          data_situacao: dataSit,
          prioridade: norm(getCol(r, "Prioridade")) || null,
          nfe_seq: norm(getCol(r, "NF-e - Seq.", "NFe Seq", "NF-e Seq")) || null,
          responsavel_documento: respDoc || null,
          empresa_cadastro: norm(getCol(r, "Empresa Cadastro")) || null,
          finalidade: norm(getCol(r, "Finalidade")) || null,
          status_externo: situacao,
          observacoes: orig ? `Orig./Dest.: ${orig}` : null,
        };

        if (cls.kind === "orcamento") {
          basePayload.status = cls.statusInterno;
          const existingId = orcByCodigo.get(codigo);
          if (existingId) {
            const { error } = await supabase.from("orcamentos").update(basePayload).eq("id", existingId);
            if (error) { result.errors.push(`Orçamento ${codigo}: ${error.message}`); }
            else result.updated++;
          } else {
            const { error } = await supabase.from("orcamentos").insert(basePayload);
            if (error) { result.errors.push(`Orçamento ${codigo}: ${error.message}`); }
            else result.inserted++;
          }
        } else {
          basePayload.status = cls.statusInterno;
          const existingId = pedByCodigo.get(codigo);
          if (existingId) {
            const { error } = await supabase.from("pedidos").update(basePayload).eq("id", existingId);
            if (error) { result.errors.push(`Pedido ${codigo}: ${error.message}`); }
            else result.updated++;
          } else {
            const { error } = await supabase.from("pedidos").insert(basePayload);
            if (error) { result.errors.push(`Pedido ${codigo}: ${error.message}`); }
            else result.inserted++;
          }
        }
      }
    }

    // limita lista de erros para não estourar resposta
    if (result.errors.length > 20) {
      result.errorsTruncated = result.errors.length;
      result.errors = result.errors.slice(0, 20);
    }

    return new Response(JSON.stringify({ success: true, ...result }), {
      status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e: any) {
    console.error("import-spreadsheet error:", e);
    return new Response(JSON.stringify({ error: e?.message || "erro desconhecido" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
