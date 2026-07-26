import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/PageHeader";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { ShoppingCart, FileText, TrendingUp, Users, Package, Trophy } from "lucide-react";
import { fmtMoney, fmtDate, abreviar } from "@/lib/format";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, LineChart, Line } from "recharts";
import { Skeleton } from "@/components/ui/skeleton";
import { AgendaDia } from "@/components/AgendaDia";


type RankMode = "vendedor" | "cliente" | "produto";

interface RankItem {
  key: string;
  nome: string;
  total: number;
}

export default function Dashboard() {
  const [loading, setLoading] = useState(true);
  const [pedidos30, setPedidos30] = useState<any[]>([]);
  const [orcamentos30, setOrcamentos30] = useState<any[]>([]);
  const [pedidoItens, setPedidoItens] = useState<any[]>([]);
  const [profiles, setProfiles] = useState<any[]>([]);
  const [stats, setStats] = useState<{ orcamentos: number; pedidos: number; vendasMes: number; conversao: number; vendasPorDia: { dia: string; total: number }[] } | null>(null);
  const [rankMode, setRankMode] = useState<RankMode>("vendedor");
  const [detail, setDetail] = useState<{ mode: RankMode; key: string; nome: string } | null>(null);

  useEffect(() => { load(); }, []);

  const load = async () => {
    setLoading(true);
    const inicioMes = new Date(); inicioMes.setDate(1); inicioMes.setHours(0,0,0,0);
    const trintaDias = new Date(); trintaDias.setDate(trintaDias.getDate() - 29);

    const [orcQ, pedQ, pedMesQ, ped30Q, orc30Q, profQ, itensQ] = await Promise.all([
      supabase.from("orcamentos").select("id", { count: "exact", head: true }),
      supabase.from("pedidos").select("id", { count: "exact", head: true }),
      supabase.from("pedidos").select("total").gte("created_at", inicioMes.toISOString()).neq("status", "cancelado"),
      supabase.from("pedidos").select("id, numero, total, created_at, cliente_id, owner_id, status, clientes(nome)").gte("created_at", trintaDias.toISOString()).neq("status", "cancelado"),
      supabase.from("orcamentos").select("id, numero, total, created_at, cliente_id, owner_id, status, clientes(nome)").gte("created_at", trintaDias.toISOString()),
      supabase.from("profiles").select("user_id, nome"),
      supabase.from("pedido_itens").select("produto_id, descricao, quantidade, preco_unitario, subtotal, pedido_id, created_at, produtos(nome)").gte("created_at", trintaDias.toISOString()),
    ]);

    const vendasMes = (pedMesQ.data || []).reduce((s, p: any) => s + Number(p.total), 0);
    const conversao = (orcQ.count || 0) > 0
      ? Math.round(((pedQ.count || 0) / (orcQ.count || 1)) * 100)
      : 0;

    const dias: Record<string, number> = {};
    for (let i = 13; i >= 0; i--) {
      const d = new Date(); d.setDate(d.getDate() - i);
      dias[d.toISOString().slice(0, 10)] = 0;
    }
    (ped30Q.data || []).forEach((p: any) => {
      const k = String(p.created_at).slice(0, 10);
      if (k in dias) dias[k] += Number(p.total);
    });
    const vendasPorDia = Object.entries(dias).map(([k, total]) => ({
      dia: new Date(k).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" }),
      total,
    }));

    setPedidos30(ped30Q.data || []);
    setOrcamentos30(orc30Q.data || []);
    setPedidoItens(itensQ.data || []);
    setProfiles(profQ.data || []);
    setStats({ orcamentos: orcQ.count || 0, pedidos: pedQ.count || 0, vendasMes, conversao, vendasPorDia });
    setLoading(false);
  };

  const profMap = useMemo(() => new Map(profiles.map((p) => [p.user_id, p.nome])), [profiles]);

  const ranking: RankItem[] = useMemo(() => {
    const map: Record<string, RankItem> = {};
    if (rankMode === "vendedor") {
      pedidos30.forEach((p: any) => {
        const k = p.owner_id || "—";
        if (!map[k]) map[k] = { key: k, nome: profMap.get(k) || "—", total: 0 };
        map[k].total += Number(p.total);
      });
    } else if (rankMode === "cliente") {
      pedidos30.forEach((p: any) => {
        const k = p.cliente_id || "—";
        if (!map[k]) map[k] = { key: k, nome: p.clientes?.nome || "—", total: 0 };
        map[k].total += Number(p.total);
      });
    } else {
      pedidoItens.forEach((it: any) => {
        const k = it.produto_id || it.descricao || "—";
        if (!map[k]) map[k] = { key: k, nome: it.produtos?.nome || it.descricao || "—", total: 0 };
        map[k].total += Number(it.subtotal || (Number(it.quantidade) * Number(it.preco_unitario)));
      });
    }
    return Object.values(map).sort((a, b) => b.total - a.total).slice(0, 10);
  }, [rankMode, pedidos30, pedidoItens, profMap]);

  const rankTitle = rankMode === "vendedor" ? "Ranking por Vendedor" : rankMode === "cliente" ? "Ranking de Clientes" : "Ranking de Produtos";

  const nextMode = (): RankMode => rankMode === "vendedor" ? "cliente" : rankMode === "cliente" ? "produto" : "vendedor";

  return (
    <div>
      <PageHeader title="Dashboard" description="Visão geral em tempo real do seu CRM" />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard icon={TrendingUp} label="Vendas no mês" value={loading ? null : fmtMoney(stats!.vendasMes)} accent />
        <KpiCard icon={ShoppingCart} label="Pedidos" value={loading ? null : String(stats!.pedidos)} />
        <KpiCard icon={FileText} label="Orçamentos" value={loading ? null : String(stats!.orcamentos)} />
        <KpiCard icon={TrendingUp} label="Taxa de conversão" value={loading ? null : `${stats!.conversao}%`} />
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-3">
        <Card className="p-6 lg:col-span-2 shadow-elevated">
          <div className="mb-4">
            <h3 className="font-semibold">Vendas — últimos 14 dias</h3>
            <p className="text-xs text-muted-foreground">Receita diária de pedidos confirmados</p>
          </div>
          {loading ? <Skeleton className="h-64 w-full" /> : (
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={stats!.vendasPorDia}>
                <defs>
                  <linearGradient id="grad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="hsl(var(--primary-glow))" />
                    <stop offset="100%" stopColor="hsl(var(--primary))" />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                <XAxis dataKey="dia" tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" />
                <YAxis tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" tickFormatter={(v) => `R$${v}`} />
                <Tooltip contentStyle={{ background: "hsl(var(--popover))", border: "1px solid hsl(var(--border))", borderRadius: 8, fontSize: 12 }} formatter={(v: number) => fmtMoney(v)} />
                <Bar dataKey="total" fill="url(#grad)" radius={[6,6,0,0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </Card>

        <Card className="p-6 shadow-elevated">
          <div className="mb-4 flex items-start justify-between gap-2">
            <div>
              <h3 className="font-semibold flex items-center gap-2"><Trophy className="h-4 w-4 text-primary" />{rankTitle}</h3>
              <p className="text-xs text-muted-foreground">Últimos 30 dias</p>
            </div>
            <Button size="sm" variant="outline" onClick={() => setRankMode(nextMode())} className="text-xs">
              {rankMode === "vendedor" ? <Users className="h-3 w-3" /> : rankMode === "cliente" ? <Package className="h-3 w-3" /> : <Trophy className="h-3 w-3" />}
              {rankMode === "vendedor" ? "Clientes" : rankMode === "cliente" ? "Produtos" : "Vendedores"}
            </Button>
          </div>
          {loading ? <Skeleton className="h-48 w-full" /> : ranking.length === 0 ? (
            <p className="text-sm text-muted-foreground">Sem dados no período</p>
          ) : (
            <ul className="space-y-2">
              {ranking.map((r, i) => (
                <li key={r.key}>
                  <button
                    type="button"
                    onClick={() => setDetail({ mode: rankMode, key: r.key, nome: r.nome })}
                    className="w-full flex items-center justify-between gap-3 rounded-lg p-2 hover:bg-accent/50 transition-colors text-left min-w-0"
                    title={r.nome}
                  >
                    <div className="flex items-center gap-3 min-w-0 flex-1">
                      <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-brand-gradient text-[11px] font-bold text-primary-foreground">
                        {i + 1}
                      </span>
                      <span className="truncate text-sm font-medium min-w-0 flex-1">{abreviar(r.nome, 15)}</span>
                    </div>
                    <span className="text-sm font-semibold text-primary shrink-0">{fmtMoney(r.total)}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>

      <AgendaDia />



      <DetailModal
        detail={detail}
        onClose={() => setDetail(null)}
        pedidos={pedidos30}
        orcamentos={orcamentos30}
        pedidoItens={pedidoItens}
      />
    </div>
  );
}

function DetailModal({ detail, onClose, pedidos, orcamentos, pedidoItens }: any) {
  const data = useMemo(() => {
    if (!detail) return null;
    const matchPed = (p: any) => detail.mode === "vendedor" ? p.owner_id === detail.key : detail.mode === "cliente" ? p.cliente_id === detail.key : false;
    const matchOrc = (o: any) => detail.mode === "vendedor" ? o.owner_id === detail.key : detail.mode === "cliente" ? o.cliente_id === detail.key : false;

    let peds: any[] = [], orcs: any[] = [];
    if (detail.mode === "produto") {
      const pedidoIds = new Set(pedidoItens.filter((it: any) => (it.produto_id || it.descricao) === detail.key).map((it: any) => it.pedido_id));
      peds = pedidos.filter((p: any) => pedidoIds.has(p.id));
      orcs = [];
    } else {
      peds = pedidos.filter(matchPed);
      orcs = orcamentos.filter(matchOrc);
    }

    const dias: Record<string, number> = {};
    for (let i = 29; i >= 0; i--) {
      const d = new Date(); d.setDate(d.getDate() - i);
      dias[d.toISOString().slice(0, 10)] = 0;
    }
    if (detail.mode === "produto") {
      pedidoItens.filter((it: any) => (it.produto_id || it.descricao) === detail.key).forEach((it: any) => {
        const k = String(it.created_at).slice(0, 10);
        if (k in dias) dias[k] += Number(it.subtotal || it.quantidade * it.preco_unitario);
      });
    } else {
      peds.forEach((p: any) => {
        const k = String(p.created_at).slice(0, 10);
        if (k in dias) dias[k] += Number(p.total);
      });
    }
    const evolucao = Object.entries(dias).map(([k, total]) => ({
      dia: new Date(k).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" }),
      total,
    }));
    const totalPed = peds.reduce((s, p) => s + Number(p.total), 0);
    const totalOrc = orcs.reduce((s, o) => s + Number(o.total), 0);
    return { peds, orcs, evolucao, totalPed, totalOrc };
  }, [detail, pedidos, orcamentos, pedidoItens]);

  return (
    <Dialog open={!!detail} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 min-w-0">
            <span className="truncate min-w-0 flex-1" title={detail?.nome}>{abreviar(detail?.nome, 22)}</span>
            <Badge variant="secondary" className="text-[10px] shrink-0">{detail?.mode}</Badge>
          </DialogTitle>
        </DialogHeader>

        {data && (
          <div className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-2">
              <Card className="p-4">
                <div className="text-xs text-muted-foreground">Total em pedidos</div>
                <div className="text-xl font-bold text-primary">{fmtMoney(data.totalPed)}</div>
                <div className="text-[11px] text-muted-foreground mt-1">{data.peds.length} pedido(s)</div>
              </Card>
              {detail?.mode !== "produto" && (
                <Card className="p-4">
                  <div className="text-xs text-muted-foreground">Total em orçamentos</div>
                  <div className="text-xl font-bold">{fmtMoney(data.totalOrc)}</div>
                  <div className="text-[11px] text-muted-foreground mt-1">{data.orcs.length} orçamento(s)</div>
                </Card>
              )}
            </div>

            <Card className="p-4">
              <h4 className="font-semibold text-sm mb-3">Evolução — últimos 30 dias</h4>
              <ResponsiveContainer width="100%" height={200}>
                <LineChart data={data.evolucao}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="dia" tick={{ fontSize: 10 }} stroke="hsl(var(--muted-foreground))" />
                  <YAxis tick={{ fontSize: 10 }} stroke="hsl(var(--muted-foreground))" tickFormatter={(v) => `R$${v}`} />
                  <Tooltip contentStyle={{ background: "hsl(var(--popover))", border: "1px solid hsl(var(--border))", borderRadius: 8, fontSize: 12 }} formatter={(v: number) => fmtMoney(v)} />
                  <Line type="monotone" dataKey="total" stroke="hsl(var(--primary))" strokeWidth={2} dot={{ r: 3 }} />
                </LineChart>
              </ResponsiveContainer>
            </Card>

            {data.peds.length > 0 && (
              <Card className="p-4">
                <h4 className="font-semibold text-sm mb-3">Pedidos</h4>
                <ul className="divide-y">
                  {data.peds.slice(0, 20).map((p: any) => (
                    <li key={p.id} className="py-2 flex items-center justify-between text-sm">
                      <div className="min-w-0">
                        <div className="font-mono text-xs text-muted-foreground">#{p.numero}</div>
                        <div className="truncate" title={p.clientes?.nome || ""}>{abreviar(p.clientes?.nome, 15)}</div>
                      </div>
                      <div className="text-right">
                        <div className="font-semibold text-primary">{fmtMoney(p.total)}</div>
                        <div className="text-[10px] text-muted-foreground">{fmtDate(p.created_at)}</div>
                      </div>
                    </li>
                  ))}
                </ul>
              </Card>
            )}

            {data.orcs.length > 0 && (
              <Card className="p-4">
                <h4 className="font-semibold text-sm mb-3">Orçamentos</h4>
                <ul className="divide-y">
                  {data.orcs.slice(0, 20).map((o: any) => (
                    <li key={o.id} className="py-2 flex items-center justify-between text-sm">
                      <div className="min-w-0">
                        <div className="font-mono text-xs text-muted-foreground">#{o.numero}</div>
                        <div className="truncate" title={o.clientes?.nome || ""}>{abreviar(o.clientes?.nome, 15)}</div>
                      </div>
                      <div className="text-right">
                        <div className="font-semibold">{fmtMoney(o.total)}</div>
                        <div className="text-[10px] text-muted-foreground">{fmtDate(o.created_at)}</div>
                      </div>
                    </li>
                  ))}
                </ul>
              </Card>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

function KpiCard({ icon: Icon, label, value, accent, hint }: any) {
  return (
    <Card className={`p-5 shadow-elevated ${accent ? "bg-brand-gradient text-primary-foreground" : ""}`}>
      <div className="flex items-center justify-between">
        <div>
          <p className={`text-xs ${accent ? "text-primary-foreground/80" : "text-muted-foreground"}`}>{label}</p>
          {value === null ? (
            <Skeleton className={`mt-2 h-7 w-24 ${accent ? "bg-white/30" : ""}`} />
          ) : (
            <p className="mt-1 text-2xl font-bold">{value}</p>
          )}
          {hint && <p className={`text-[11px] mt-0.5 ${accent ? "text-primary-foreground/70" : "text-muted-foreground"}`}>{hint}</p>}
        </div>
        <div className={`rounded-lg p-2.5 ${accent ? "bg-white/20" : "bg-primary/10"}`}>
          <Icon className={`h-5 w-5 ${accent ? "text-primary-foreground" : "text-primary"}`} />
        </div>
      </div>
    </Card>
  );
}
