import { supabase } from "@/integrations/supabase/client";

export interface GeoCapture {
  geo_lat: number | null;
  geo_lng: number | null;
  geo_endereco: string | null;
}

/**
 * Captura a localização atual via GPS do navegador e faz reverse geocoding
 * via edge function (que usa GOOGLE_MAPS_API_KEY no servidor).
 * Sempre retorna um objeto seguro — se o usuário negar GPS, retorna nulls.
 */
export async function captureLocation(): Promise<GeoCapture> {
  const empty: GeoCapture = { geo_lat: null, geo_lng: null, geo_endereco: null };

  if (typeof navigator === "undefined" || !navigator.geolocation) {
    return empty;
  }

  const position = await new Promise<GeolocationPosition | null>((resolve) => {
    navigator.geolocation.getCurrentPosition(
      (pos) => resolve(pos),
      () => resolve(null),
      { enableHighAccuracy: true, timeout: 8000, maximumAge: 60000 },
    );
  });

  if (!position) return empty;

  const lat = position.coords.latitude;
  const lng = position.coords.longitude;

  let endereco: string | null = null;
  try {
    const { data } = await supabase.functions.invoke("reverse-geocode", {
      body: { lat, lng },
    });
    if (data?.address) endereco = data.address;
  } catch {
    // mantém endereço null se falhar
  }

  return { geo_lat: lat, geo_lng: lng, geo_endereco: endereco };
}
