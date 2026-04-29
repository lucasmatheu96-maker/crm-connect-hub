import { useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { captureLocation } from "@/hooks/useGeolocation";

const CHECK_INTERVAL_MS = 5 * 60 * 1000; // verifica condições a cada 5min
const PING_INTERVAL_MS = 2 * 60 * 60 * 1000; // 2 horas entre pings
const LAST_PING_KEY = "lastLocationPingAt";

function isWithinWindow(d: Date) {
  const day = d.getDay(); // 0=dom, 6=sab
  const hour = d.getHours();
  return day >= 1 && day <= 5 && hour >= 8 && hour < 18;
}

/**
 * Enquanto o app estiver aberto, captura a localização do usuário a cada 2h
 * dentro da janela 08h–18h em dias úteis, somente se ele tiver `track_location`
 * habilitado pelo administrador.
 */
export function useLocationTracking() {
  const { user } = useAuth();
  const enabledRef = useRef(false);
  const checkedAtRef = useRef(0);

  // Verifica periodicamente se o usuário está habilitado (cache 30min)
  useEffect(() => {
    if (!user?.email) return;
    let cancelled = false;
    const check = async () => {
      const now = Date.now();
      if (now - checkedAtRef.current < 30 * 60 * 1000 && checkedAtRef.current > 0) return;
      checkedAtRef.current = now;
      const { data } = await supabase
        .from("authorized_emails")
        .select("track_location, status")
        .eq("email", user.email!.toLowerCase())
        .maybeSingle();
      if (cancelled) return;
      enabledRef.current = !!(data?.track_location && data?.status === "ativo");
    };
    check();
    const id = setInterval(check, 30 * 60 * 1000);
    return () => { cancelled = true; clearInterval(id); };
  }, [user?.email]);

  // Loop de envio
  useEffect(() => {
    if (!user?.id) return;
    const tick = async () => {
      if (!enabledRef.current) return;
      if (!isWithinWindow(new Date())) return;
      const last = Number(localStorage.getItem(LAST_PING_KEY) || 0);
      if (Date.now() - last < PING_INTERVAL_MS) return;
      const geo = await captureLocation();
      if (geo.geo_lat == null || geo.geo_lng == null) return;
      const { error } = await supabase.from("location_pings").insert({
        user_id: user.id,
        geo_lat: geo.geo_lat,
        geo_lng: geo.geo_lng,
        geo_endereco: geo.geo_endereco,
      });
      if (!error) localStorage.setItem(LAST_PING_KEY, String(Date.now()));
    };
    // primeira verificação após 30s, depois a cada 5min
    const t = setTimeout(tick, 30 * 1000);
    const id = setInterval(tick, CHECK_INTERVAL_MS);
    return () => { clearTimeout(t); clearInterval(id); };
  }, [user?.id]);
}
