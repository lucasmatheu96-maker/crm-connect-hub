import { useEffect, useState } from "react";
import { WifiOff, Wifi } from "lucide-react";
import { toast } from "sonner";

export const OfflineIndicator = () => {
  const [online, setOnline] = useState(typeof navigator !== "undefined" ? navigator.onLine : true);

  useEffect(() => {
    const handleOnline = () => {
      setOnline(true);
      toast.success("Conexão restabelecida", { icon: <Wifi className="h-4 w-4" /> });
    };
    const handleOffline = () => {
      setOnline(false);
      toast.warning("Você está offline. Os dados em cache continuam disponíveis.", {
        icon: <WifiOff className="h-4 w-4" />,
        duration: 5000,
      });
    };
    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);
    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  if (online) return null;

  return (
    <div
      className="fixed left-1/2 top-2 z-[100] -translate-x-1/2 rounded-full border border-warning/30 bg-warning/95 px-3 py-1.5 text-xs font-medium text-warning-foreground shadow-elevated backdrop-blur"
      style={{ paddingTop: "max(0.375rem, env(safe-area-inset-top))" }}
      role="status"
      aria-live="polite"
    >
      <span className="flex items-center gap-1.5">
        <WifiOff className="h-3.5 w-3.5" />
        Modo offline — exibindo dados salvos
      </span>
    </div>
  );
};
