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
    return data?.address ?? null;
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
      return { geo_lat: data.lat, geo_lng: data.lng, geo_endereco: data.address ?? address };
    }
  } catch {
    // ignore
  }
  return { geo_lat: null, geo_lng: null, geo_endereco: null };
}

/**
 * Tenta capturar a localização do usuário via GPS do navegador.
 * Se falhar (negado / sem suporte / timeout) e um endereço de fallback for informado,
 * faz geocoding direto do endereço para obter coordenadas + endereço completo.
 *
 * Sempre retorna um objeto seguro (com nulls se não houver nenhuma informação).
 */
export async function captureLocation(fallbackAddress?: string | null): Promise<GeoCapture> {
  const empty: GeoCapture = { geo_lat: null, geo_lng: null, geo_endereco: null };

  const tryFallback = async (): Promise<GeoCapture> => {
    if (!fallbackAddress || !fallbackAddress.trim()) return empty;
    return await forwardGeocode(fallbackAddress.trim());
  };

  if (typeof navigator === "undefined" || !navigator.geolocation) {
    return await tryFallback();
  }

  const position = await new Promise<GeolocationPosition | null>((resolve) => {
    try {
      navigator.geolocation.getCurrentPosition(
        (pos) => resolve(pos),
        () => resolve(null),
        { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 },
      );
    } catch {
      resolve(null);
    }
  });

  if (!position) {
    // GPS negado / indisponível → tenta pelo endereço digitado
    return await tryFallback();
  }

  const lat = position.coords.latitude;
  const lng = position.coords.longitude;
  const endereco = await reverseGeocode(lat, lng);
  const fallbackText = fallbackAddress?.trim() || `Lat ${lat.toFixed(6)}, Lng ${lng.toFixed(6)}`;

  return {
    geo_lat: lat,
    geo_lng: lng,
    geo_endereco: endereco ?? fallbackText,
  };
}
