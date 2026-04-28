import { useEffect, useState } from "react";
import { WifiOff, Wifi, CloudUpload } from "lucide-react";
import { toast } from "sonner";
import { count, subscribe, initOutbox, flush } from "@/lib/outbox";

export const OfflineIndicator = () => {
  const [online, setOnline] = useState(typeof navigator !== "undefined" ? navigator.onLine : true);
  const [pending, setPending] = useState(0);

  useEffect(() => {
    initOutbox();
    const refresh = async () => setPending(await count());
    refresh();
    const unsub = subscribe(refresh);

    const handleOnline = () => {
      setOnline(true);
      toast.success("Conexão restabelecida", { icon: <Wifi className="h-4 w-4" /> });
    };
    const handleOffline = () => {
      setOnline(false);
      toast.warning("Você está offline. As alterações serão sincronizadas ao reconectar.", {
        icon: <WifiOff className="h-4 w-4" />,
        duration: 5000,
      });
    };
    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);
    return () => {
      unsub();
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  if (online && pending === 0) return null;

  return (
    <div
      className="fixed left-1/2 top-2 z-[100] -translate-x-1/2 rounded-full border bg-background/95 px-3 py-1.5 text-xs font-medium shadow-elevated backdrop-blur"
      style={{ paddingTop: "max(0.375rem, env(safe-area-inset-top))" }}
      role="status"
      aria-live="polite"
    >
      {!online ? (
        <span className="flex items-center gap-1.5 text-warning-foreground">
          <WifiOff className="h-3.5 w-3.5" />
          Modo offline {pending > 0 && `• ${pending} pendente(s)`}
        </span>
      ) : (
        <button
          onClick={() => flush()}
          className="flex items-center gap-1.5 text-primary"
        >
          <CloudUpload className="h-3.5 w-3.5" />
          Sincronizando {pending} alteração(ões)...
        </button>
      )}
    </div>
  );
};
