import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { MapPin, Bell, CheckCircle2, XCircle } from "lucide-react";

const STORAGE_KEY = "medcontrol:onboarding-permissions:v1";

type PermState = "idle" | "granted" | "denied" | "unsupported";

/**
 * Onboarding de permissões: solicita ao usuário, no primeiro acesso autorizado,
 * a permissão de geolocalização (e, opcionalmente, notificações no futuro).
 * Roda apenas 1x — após interação fica salvo em localStorage.
 */
export function OnboardingPermissions() {
  const [open, setOpen] = useState(false);
  const [geoState, setGeoState] = useState<PermState>("idle");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    try {
      const done = localStorage.getItem(STORAGE_KEY);
      if (done) return;
    } catch {
      // localStorage indisponível — apenas não mostra
      return;
    }

    // Verifica suporte a geolocation
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      setGeoState("unsupported");
    }

    // Verifica estado atual da permissão (se browser suportar Permissions API)
    const tryCheck = async () => {
      try {
        // @ts-ignore
        if (navigator.permissions?.query) {
          // @ts-ignore
          const res = await navigator.permissions.query({ name: "geolocation" });
          if (res.state === "granted") {
            // Já concedido em outra sessão → marca como done e não abre
            try { localStorage.setItem(STORAGE_KEY, "granted"); } catch {}
            return;
          }
        }
      } catch {
        // ignore
      }
      setOpen(true);
    };
    tryCheck();
  }, []);

  const requestGeo = () => {
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      setGeoState("unsupported");
      return;
    }
    setBusy(true);
    navigator.geolocation.getCurrentPosition(
      () => { setGeoState("granted"); setBusy(false); },
      () => { setGeoState("denied"); setBusy(false); },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 },
    );
  };

  const finish = () => {
    try { localStorage.setItem(STORAGE_KEY, geoState || "skipped"); } catch {}
    setOpen(false);
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) finish(); }}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Bem-vindo ao MedControl 👋</DialogTitle>
          <DialogDescription>
            Para o aplicativo funcionar corretamente, precisamos de algumas permissões. Você pode revisá-las depois nas configurações do navegador.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 py-2">
          <div className="flex items-start gap-3 rounded-lg border p-3">
            <div className="rounded-md bg-primary/10 p-2 text-primary">
              <MapPin className="h-5 w-5" />
            </div>
            <div className="flex-1">
              <div className="flex items-center justify-between gap-2">
                <p className="text-sm font-medium">Localização</p>
                {geoState === "granted" && <CheckCircle2 className="h-4 w-4 text-green-600" />}
                {geoState === "denied" && <XCircle className="h-4 w-4 text-destructive" />}
              </div>
              <p className="mt-0.5 text-xs text-muted-foreground">
                Usada para registrar onde os clientes e visitas são cadastrados (opcional, mas recomendada).
              </p>
              {geoState === "idle" && (
                <Button size="sm" variant="brand" className="mt-2" onClick={requestGeo} disabled={busy}>
                  {busy ? "Solicitando..." : "Permitir localização"}
                </Button>
              )}
              {geoState === "denied" && (
                <p className="mt-2 text-[11px] text-muted-foreground">
                  Sem problemas — você ainda pode cadastrar tudo informando o endereço manualmente.
                </p>
              )}
              {geoState === "unsupported" && (
                <p className="mt-2 text-[11px] text-muted-foreground">
                  Este dispositivo não suporta GPS. Os endereços serão usados manualmente.
                </p>
              )}
            </div>
          </div>

          <div className="flex items-start gap-3 rounded-lg border border-dashed p-3 opacity-60">
            <div className="rounded-md bg-muted p-2">
              <Bell className="h-5 w-5" />
            </div>
            <div className="flex-1">
              <p className="text-sm font-medium">Notificações</p>
              <p className="mt-0.5 text-xs text-muted-foreground">
                Em breve — para alertas de pedidos e oportunidades.
              </p>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={finish}>Pular</Button>
          <Button variant="brand" onClick={finish}>Continuar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
