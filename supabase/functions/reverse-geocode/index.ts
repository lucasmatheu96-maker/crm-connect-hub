// Geocoding via Google Maps
// - Reverse: { lat, lng } -> endereço
// - Direto:  { address }  -> { lat, lng, address }
// deno-lint-ignore-file no-explicit-any
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const body = await req.json().catch(() => ({}));
    const { lat, lng, address } = body || {};

    const apiKey = Deno.env.get("GOOGLE_MAPS_API_KEY");
    if (!apiKey) {
      console.warn("GOOGLE_MAPS_API_KEY não configurada");
      return new Response(JSON.stringify({ address: null, warning: "API key not configured" }), {
        status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 1) Reverse geocoding (lat/lng -> endereço)
    if (typeof lat === "number" && typeof lng === "number") {
      const url = `https://maps.googleapis.com/maps/api/geocode/json?latlng=${lat},${lng}&language=pt-BR&key=${apiKey}`;
      const r = await fetch(url);
      const data: any = await r.json();
      if (data.status && data.status !== "OK" && data.status !== "ZERO_RESULTS") {
        console.error("Google reverse error:", data.status, data.error_message);
      }
      const formatted = data?.results?.[0]?.formatted_address ?? null;
      return new Response(JSON.stringify({ address: formatted, lat, lng }), {
        status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 2) Geocoding direto (endereço -> lat/lng)
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
          status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      return new Response(JSON.stringify({
        address: result.formatted_address ?? null,
        lat: result.geometry?.location?.lat ?? null,
        lng: result.geometry?.location?.lng ?? null,
      }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    return new Response(JSON.stringify({ error: "Informe lat/lng ou address" }), {
      status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e: any) {
    console.error("geocode error:", e);
    return new Response(JSON.stringify({ error: e?.message || "erro" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
