import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Download, Share, Plus, X, Smartphone } from "lucide-react";

type BIPEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

const DISMISS_KEY = "medcontrol:install-prompt:dismissed-at";
const DISMISS_DAYS = 7;

export const InstallPrompt = () => {
  const [deferred, setDeferred] = useState<BIPEvent | null>(null);
  const [show, setShow] = useState(false);
  const [showIOSHelp, setShowIOSHelp] = useState(false);

  const ua = typeof navigator !== "undefined" ? navigator.userAgent : "";
  const isIOS = /iPhone|iPad|iPod/i.test(ua);
  const isSafari = /^((?!chrome|android|crios|fxios).)*safari/i.test(ua);
  const isStandalone =
    typeof window !== "undefined" &&
    (window.matchMedia("(display-mode: standalone)").matches ||
      // @ts-ignore
      window.navigator.standalone === true);

  useEffect(() => {
    if (isStandalone) return;
    const dismissedAt = localStorage.getItem(DISMISS_KEY);
    if (dismissedAt) {
      const days = (Date.now() - Number(dismissedAt)) / (1000 * 60 * 60 * 24);
      if (days < DISMISS_DAYS) return;
    }

    const onPrompt = (e: Event) => {
      e.preventDefault();
      setDeferred(e as BIPEvent);
      setShow(true);
    };
    window.addEventListener("beforeinstallprompt", onPrompt);

    // iOS Safari não dispara beforeinstallprompt — mostra ajuda manual
    if (isIOS && isSafari) {
      const t = setTimeout(() => setShow(true), 2500);
      return () => {
        clearTimeout(t);
        window.removeEventListener("beforeinstallprompt", onPrompt);
      };
    }
    return () => window.removeEventListener("beforeinstallprompt", onPrompt);
  }, [isIOS, isSafari, isStandalone]);

  const dismiss = () => {
    localStorage.setItem(DISMISS_KEY, String(Date.now()));
    setShow(false);
    setShowIOSHelp(false);
  };

  const install = async () => {
    if (deferred) {
      await deferred.prompt();
      const choice = await deferred.userChoice;
      if (choice.outcome === "accepted") setShow(false);
      setDeferred(null);
    } else if (isIOS) {
      setShowIOSHelp(true);
    }
  };

  if (!show || isStandalone) return null;

  return (
    <div className="fixed inset-x-0 bottom-0 z-50 p-3 pb-[max(env(safe-area-inset-bottom),12px)] md:bottom-4 md:left-auto md:right-4 md:max-w-sm">
      <Card className="relative border-primary/20 p-4 shadow-elevated">
        <button
          onClick={dismiss}
          aria-label="Fechar"
          className="absolute right-2 top-2 rounded-md p-1 text-muted-foreground hover:bg-muted"
        >
          <X className="h-4 w-4" />
        </button>

        {!showIOSHelp ? (
          <div className="flex items-start gap-3 pr-6">
            <div className="rounded-xl bg-primary/10 p-2 text-primary">
              <Smartphone className="h-5 w-5" />
            </div>
            <div className="flex-1">
              <p className="text-sm font-semibold">Instalar MedControl</p>
              <p className="mt-0.5 text-xs text-muted-foreground">
                Tenha acesso rápido na tela inicial, em tela cheia, com GPS.
              </p>
              <div className="mt-3 flex gap-2">
                <Button size="sm" variant="brand" onClick={install} className="flex-1">
                  <Download className="h-4 w-4" />
                  {isIOS ? "Como instalar" : "Instalar"}
                </Button>
                <Button size="sm" variant="ghost" onClick={dismiss}>
                  Agora não
                </Button>
              </div>
            </div>
          </div>
        ) : (
          <div className="pr-6">
            <p className="text-sm font-semibold">Instalar no iPhone / iPad</p>
            <ol className="mt-2 space-y-1.5 text-xs text-muted-foreground">
              <li>1. Toque em <Share className="inline h-3.5 w-3.5 align-text-bottom" /> <strong>Compartilhar</strong> (barra do Safari).</li>
              <li>2. Selecione <Plus className="inline h-3.5 w-3.5 align-text-bottom" /> <strong>Adicionar à Tela de Início</strong>.</li>
              <li>3. Confirme em <strong>Adicionar</strong>.</li>
            </ol>
            <Button size="sm" variant="outline" onClick={dismiss} className="mt-3 w-full">
              Entendi
            </Button>
          </div>
        )}
      </Card>
    </div>
  );
};
