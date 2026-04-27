// Geocoding via Google Maps
// - Reverse: { lat, lng } -> endereço detalhado
// - Direto:  { address }  -> { lat, lng, address }
// deno-lint-ignore-file no-explicit-any
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function pickComponent(components: any[] = [], types: string[]) {
  return components.find((component) => types.every((type) => component.types?.includes(type))) ?? null;
}

function buildDetailedAddress(result: any) {
  const components = result?.address_components ?? [];
  const street = pickComponent(components, ["route"])?.long_name ?? null;
  const streetNumber = pickComponent(components, ["street_number"])?.long_name ?? null;
  const postalCode = pickComponent(components, ["postal_code"])?.long_name ?? null;
  const neighborhood = pickComponent(components, ["sublocality", "political"])?.long_name
    ?? pickComponent(components, ["sublocality_level_1", "sublocality", "political"])?.long_name
    ?? pickComponent(components, ["neighborhood", "political"])?.long_name
    ?? null;
  const city = pickComponent(components, ["locality", "political"])?.long_name
    ?? pickComponent(components, ["administrative_area_level_2", "political"])?.long_name
    ?? null;
  const state = pickComponent(components, ["administrative_area_level_1", "political"])?.short_name
    ?? pickComponent(components, ["administrative_area_level_1", "political"])?.long_name
    ?? null;
  const country = pickComponent(components, ["country", "political"])?.long_name ?? null;

  const streetLine = [street, streetNumber].filter(Boolean).join(", ");
  const localityLine = [neighborhood, city].filter(Boolean).join(" - ");
  const regionLine = [state, postalCode ? `CEP ${postalCode}` : null, country].filter(Boolean).join(", ");
  const formatted = [streetLine, localityLine, regionLine].filter(Boolean).join(" • ") || result?.formatted_address || null;

  return {
    address: formatted,
    street,
    street_number: streetNumber,
    postal_code: postalCode,
    neighborhood,
    city,
    state,
    country,
    formatted_address: result?.formatted_address ?? null,
  };
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const body = await req.json().catch(() => ({}));
    const { lat, lng, address } = body || {};

    const apiKey = Deno.env.get("GOOGLE_MAPS_API_KEY");
    if (!apiKey) {
      console.warn("GOOGLE_MAPS_API_KEY não configurada");
      return new Response(JSON.stringify({ address: null, warning: "API key not configured" }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (typeof lat === "number" && typeof lng === "number") {
      const url = `https://maps.googleapis.com/maps/api/geocode/json?latlng=${lat},${lng}&language=pt-BR&key=${apiKey}`;
      const r = await fetch(url);
      const data: any = await r.json();
      if (data.status && data.status !== "OK" && data.status !== "ZERO_RESULTS") {
        console.error("Google reverse error:", data.status, data.error_message);
      }

      const result = data?.results?.[0];
      const detailed = buildDetailedAddress(result);

      return new Response(JSON.stringify({
        lat,
        lng,
        ...detailed,
      }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (typeof address === "string" && address.trim().length > 0) {
      const url = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(address)}&language=pt-BR&region=br&key=${apiKey}`;
      const r = await fetch(url);
      const data: any = await r.json();
      if (data.status && data.status !== "OK" && data.status !== "ZERO_RESULTS") {
        console.error("Google forward error:", data.status, data.error_message);
      }

      const result = data?.results?.[0];
      if (!result) {
        return new Response(JSON.stringify({ address: null, lat: null, lng: null }), {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const detailed = buildDetailedAddress(result);
      return new Response(JSON.stringify({
        lat: result.geometry?.location?.lat ?? null,
        lng: result.geometry?.location?.lng ?? null,
        ...detailed,
      }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ error: "Informe lat/lng ou address" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e: any) {
    console.error("geocode error:", e);
    return new Response(JSON.stringify({ error: e?.message || "erro" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
