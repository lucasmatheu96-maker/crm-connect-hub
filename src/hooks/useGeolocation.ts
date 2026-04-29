import { supabase } from "@/integrations/supabase/client";

export interface GeoCapture {
  geo_lat: number | null;
  geo_lng: number | null;
  geo_endereco: string | null;
}

function hasCoordinates(lat: unknown, lng: unknown) {
  return typeof lat === "number" && Number.isFinite(lat) && typeof lng === "number" && Number.isFinite(lng);
}

/** Reverse geocoding (coordenadas → endereço) */
async function reverseGeocode(lat: number, lng: number): Promise<string | null> {
  try {
    const { data } = await supabase.functions.invoke("reverse-geocode", {
      body: { lat, lng },
    });
    return data?.address ?? data?.formatted_address ?? null;
  } catch {
    return null;
  }
}

/** Forward geocoding (endereço → coordenadas + endereço normalizado) */
async function forwardGeocode(address: string): Promise<GeoCapture> {
  try {
    const { data } = await supabase.functions.invoke("reverse-geocode", {
      body: { address },
    });
    if (hasCoordinates(data?.lat, data?.lng)) {
      return {
        geo_lat: data.lat,
        geo_lng: data.lng,
        geo_endereco: data?.address ?? data?.formatted_address ?? address,
      };
    }
  } catch {
    // ignore
  }
  return { geo_lat: null, geo_lng: null, geo_endereco: null };
}

/**
 * Captura SOMENTE a localização atual via GPS do navegador.
 * Se o GPS falhar (negado / sem suporte / timeout), retorna nulls — NUNCA usa
 * endereço de fallback do cliente, pois o objetivo é registrar onde o usuário
 * realmente estava no momento de salvar.
 *
 * O parâmetro fallbackAddress é mantido por compatibilidade mas é ignorado.
 */
export async function captureLocation(_fallbackAddress?: string | null): Promise<GeoCapture> {
  const empty: GeoCapture = { geo_lat: null, geo_lng: null, geo_endereco: null };

  if (typeof navigator === "undefined" || !navigator.geolocation) {
    return empty;
  }

  const position = await new Promise<GeolocationPosition | null>((resolve) => {
    try {
      navigator.geolocation.getCurrentPosition(
        (pos) => resolve(pos),
        () => resolve(null),
        { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 },
      );
    } catch {
      resolve(null);
    }
  });

  if (!position) return empty;

  const lat = position.coords.latitude;
  const lng = position.coords.longitude;
  const endereco = await reverseGeocode(lat, lng);

  return {
    geo_lat: lat,
    geo_lng: lng,
    geo_endereco: endereco ?? `Lat ${lat.toFixed(6)}, Lng ${lng.toFixed(6)}`,
  };
}
