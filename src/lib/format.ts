export const fmtMoney = (v: number | null | undefined) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(Number(v ?? 0));

export const fmtDate = (d: string | Date | null | undefined) => {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("pt-BR");
};

export const fmtDateTime = (d: string | Date | null | undefined) => {
  if (!d) return "—";
  return new Date(d).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" });
};

/**
 * Abrevia texto longo mantendo um limite aproximado de caracteres.
 * Ex.: abreviar("João da Silva Santos", 15) => "João da Silva…"
 */
export const abreviar = (s: string | null | undefined, max = 15): string => {
  const t = (s ?? "").toString().trim();
  if (!t) return "—";
  if (t.length <= max) return t;
  return t.slice(0, Math.max(1, max - 1)).trimEnd() + "…";
};
