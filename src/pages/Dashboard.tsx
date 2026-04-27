import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/PageHeader";
import { Card } from "@/components/ui/card";
import { Users, ShoppingCart, FileText, TrendingUp, MapPin, Package } from "lucide-react";
import { fmtMoney } from "@/lib/format";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";
import { Skeleton } from "@/components/ui/skeleton";

interface Stats {
  clientes: number;
  produtos: number;
  orcamentos: number;
  pedidos: number;
  vendasMes: number;
  conversao: number;
  topClientes: { nome: string; total: number }[];
  vendasPorDia: { dia: string; total: number }[];
}

export default function Dashboard() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => { load(); }, []);

  const load = async () => {
    setLoading(true);
    const inicioMes = new Date();
    inicioMes.setDate(1); inicioMes.setHours(0,0,0,0);
    const trintaDias = new Date(); trintaDias.setDate(trintaDias.getDate() - 29);

    const [clientesQ, produtosQ, orcamentosQ, pedidosQ, pedidosMesQ, pedidos30Q] = await Promise.all([
      supabase.from("clientes").select("id", { count: "exact", head: true }),
      supabase.from("produtos").select("id", { count: "exact", head: true }),
      supabase.from("orcamentos").select("id", { count: "exact", head: true }),
      supabase.from("pedidos").select("id", { count: "exact", head: true }),
      supabase.from("pedidos").select("total").gte("created_at", inicioMes.toISOString()).neq("status", "cancelado"),
      supabase.from("pedidos").select("total, created_at, cliente_id, clientes(nome)").gte("created_at", trintaDias.toISOString()).neq("status", "cancelado"),
    ]);

    const vendasMes = (pedidosMesQ.data || []).reduce((s, p: any) => s + Number(p.total), 0);
    const conversao = (orcamentosQ.count || 0) > 0
      ? Math.round(((pedidosQ.count || 0) / (orcamentosQ.count || 1)) * 100)
      : 0;

    // Top clientes
    const map: Record<string, { nome: string; total: number }> = {};
    (pedidos30Q.data || []).forEach((p: any) => {
      const key = p.cliente_id;
      if (!map[key]) map[key] = { nome: p.clientes?.nome || "—", total: 0 };
      map[key].total += Number(p.total);
    });
    const topClientes = Object.values(map).sort((a, b) => b.total - a.total).slice(0, 5);

    // Vendas por dia (últimos 14 dias)
    const dias: Record<string, number> = {};
    for (let i = 13; i >= 0; i--) {
      const d = new Date(); d.setDate(d.getDate() - i);
      const k = d.toISOString().slice(0, 10);
      dias[k] = 0;
    }
    (pedidos30Q.data || []).forEach((p: any) => {
      const k = String(p.created_at).slice(0, 10);
      if (k in dias) dias[k] += Number(p.total);
    });
    const vendasPorDia = Object.entries(dias).map(([k, total]) => ({
      dia: new Date(k).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" }),
      total,
    }));

    setStats({
      clientes: clientesQ.count || 0,
      produtos: produtosQ.count || 0,
      orcamentos: orcamentosQ.count || 0,
      pedidos: pedidosQ.count || 0,
      vendasMes,
      conversao,
      topClientes,
      vendasPorDia,
    });
    setLoading(false);
  };

  return (
    <div>
      <PageHeader title="Dashboard" description="Visão geral em tempo real do seu CRM" />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard icon={TrendingUp} label="Vendas no mês" value={loading ? null : fmtMoney(stats!.vendasMes)} accent />
        <KpiCard icon={ShoppingCart} label="Pedidos" value={loading ? null : String(stats!.pedidos)} />
        <KpiCard icon={FileText} label="Orçamentos" value={loading ? null : String(stats!.orcamentos)} />
        <KpiCard icon={Users} label="Clientes" value={loading ? null : String(stats!.clientes)} />
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-3">
        <Card className="p-6 lg:col-span-2 shadow-elevated">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <h3 className="font-semibold">Vendas — últimos 14 dias</h3>
              <p className="text-xs text-muted-foreground">Receita diária de pedidos confirmados</p>
            </div>
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
                <Tooltip
                  contentStyle={{ background: "hsl(var(--popover))", border: "1px solid hsl(var(--border))", borderRadius: 8, fontSize: 12 }}
                  formatter={(v: number) => fmtMoney(v)}
                />
                <Bar dataKey="total" fill="url(#grad)" radius={[6,6,0,0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </Card>

        <Card className="p-6 shadow-elevated">
          <h3 className="font-semibold mb-4">Top clientes (30 dias)</h3>
          {loading ? <Skeleton className="h-48 w-full" /> : stats!.topClientes.length === 0 ? (
            <p className="text-sm text-muted-foreground">Sem vendas no período</p>
          ) : (
            <ul className="space-y-3">
              {stats!.topClientes.map((c, i) => (
                <li key={i} className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-brand-gradient text-xs font-bold text-primary-foreground">
                      {i + 1}
                    </span>
                    <span className="truncate text-sm font-medium">{c.nome}</span>
                  </div>
                  <span className="text-sm font-semibold text-primary">{fmtMoney(c.total)}</span>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>

      <div className="mt-6 grid gap-4 sm:grid-cols-3">
        <KpiCard icon={Package} label="Produtos cadastrados" value={loading ? null : String(stats!.produtos)} />
        <KpiCard icon={TrendingUp} label="Taxa de conversão" value={loading ? null : `${stats!.conversao}%`} hint="Pedidos / Orçamentos" />
        <Card className="p-5 shadow-elevated">
          <div className="flex items-center gap-3">
            <div className="rounded-lg bg-accent/10 p-2.5">
              <MapPin className="h-5 w-5 text-accent" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Geolocalização</p>
              <p className="text-sm font-semibold">Ativa em todos os cadastros</p>
            </div>
          </div>
        </Card>
      </div>
    </div>
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
