import { supabase } from "@/integrations/supabase/client";

export interface GeoCapture {
  geo_lat: number | null;
  geo_lng: number | null;
  geo_endereco: string | null;
}

export interface CaptureOptions {
  /** Motivo da captura (ex: "orcamento", "pedido", "funil", "cliente", "ping_periodico"). */
  reason?: string;
  /** Tabela e id de referência, para vincular o log. */
  refTable?: string;
  refId?: string;
}

function hasCoordinates(lat: unknown, lng: unknown) {
  return typeof lat === "number" && Number.isFinite(lat) && typeof lng === "number" && Number.isFinite(lng);
}

async function reverseGeocode(lat: number, lng: number): Promise<string | null> {
  try {
    const { data } = await supabase.functions.invoke("reverse-geocode", { body: { lat, lng } });
    return data?.address ?? data?.formatted_address ?? null;
  } catch {
    return null;
  }
}

async function logCapture(geo: GeoCapture, opts: CaptureOptions, success: boolean, reason?: string) {
  if (!opts.reason) return; // só registra log quando o motivo é informado
  try {
    const { data: userData } = await supabase.auth.getUser();
    const u = userData.user;
    if (!u) return;
    await supabase.from("access_logs").insert({
      user_id: u.id,
      email: u.email ?? null,
      action: "location_capture",
      success,
      reason: reason ?? null,
      reason_context: opts.reason,
      ref_table: opts.refTable ?? null,
      ref_id: opts.refId ?? null,
      geo_lat: geo.geo_lat,
      geo_lng: geo.geo_lng,
      geo_endereco: geo.geo_endereco,
      user_agent: typeof navigator !== "undefined" ? navigator.userAgent : null,
    });
  } catch {
    // silencioso
  }
}

/**
 * Captura SOMENTE a localização atual via GPS do navegador.
 * Quando `options.reason` é passado, registra a tentativa em `access_logs`
 * (sucesso ou falha) com o motivo, para auditoria.
 */
export async function captureLocation(
  _fallbackAddress?: string | null,
  options: CaptureOptions = {},
): Promise<GeoCapture> {
  const empty: GeoCapture = { geo_lat: null, geo_lng: null, geo_endereco: null };

  if (typeof navigator === "undefined" || !navigator.geolocation) {
    await logCapture(empty, options, false, "geolocation indisponível");
    return empty;
  }

  const result = await new Promise<{ pos: GeolocationPosition | null; reason?: string }>((resolve) => {
    try {
      navigator.geolocation.getCurrentPosition(
        (pos) => resolve({ pos }),
        (err) => resolve({ pos: null, reason: err?.message || `código ${err?.code}` }),
        { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 },
      );
    } catch (e: any) {
      resolve({ pos: null, reason: e?.message || "erro ao acessar GPS" });
    }
  });

  if (!result.pos) {
    await logCapture(empty, options, false, result.reason || "GPS indisponível");
    return empty;
  }

  const lat = result.pos.coords.latitude;
  const lng = result.pos.coords.longitude;
  const endereco = await reverseGeocode(lat, lng);
  const geo: GeoCapture = {
    geo_lat: lat,
    geo_lng: lng,
    geo_endereco: endereco ?? `Lat ${lat.toFixed(6)}, Lng ${lng.toFixed(6)}`,
  };
  await logCapture(geo, options, true);
  return geo;
}
