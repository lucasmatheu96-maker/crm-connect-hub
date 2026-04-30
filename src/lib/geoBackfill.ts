import { supabase } from "@/integrations/supabase/client";

/** Detecta o fallback antigo "Lat X, Lng Y" salvo no banco. */
export function isCoordFallback(s: string | null | undefined): boolean {
  if (!s) return true;
  return /^Lat\s-?\d/i.test(s.trim());
}

const inflight = new Map<string, Promise<string | null>>();

/**
 * Resolve o endereço a partir de lat/lng e atualiza a tabela informada.
 * Faz cache em memória por id para evitar chamadas duplicadas.
 */
export async function backfillGeoEndereco(
  table: string,
  id: string,
  lat: number | null | undefined,
  lng: number | null | undefined,
): Promise<string | null> {
  if (typeof lat !== "number" || typeof lng !== "number") return null;
  const key = `${table}:${id}`;
  if (inflight.has(key)) return inflight.get(key)!;

  const p = (async () => {
    try {
      const { data } = await supabase.functions.invoke("reverse-geocode", { body: { lat, lng } });
      const address: string | null = data?.address ?? data?.formatted_address ?? null;
      if (!address) return null;
      await supabase.from(table as any).update({ geo_endereco: address }).eq("id", id);
      return address;
    } catch {
      return null;
    }
  })();

  inflight.set(key, p);
  return p;
}
