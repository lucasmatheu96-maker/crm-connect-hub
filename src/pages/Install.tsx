import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Smartphone, Apple, Chrome, Download, Share, Plus, ArrowLeft, CheckCircle2 } from "lucide-react";
import { Logo } from "@/components/Logo";

type BIPEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

export default function Install() {
  const navigate = useNavigate();
  const [deferred, setDeferred] = useState<BIPEvent | null>(null);
  const [installed, setInstalled] = useState(false);

  // Detecta plataforma
  const ua = typeof navigator !== "undefined" ? navigator.userAgent : "";
  const isIOS = /iPhone|iPad|iPod/i.test(ua);
  const isAndroid = /Android/i.test(ua);
  const isStandalone =
    typeof window !== "undefined" &&
    (window.matchMedia("(display-mode: standalone)").matches ||
      // @ts-ignore
      window.navigator.standalone === true);

  useEffect(() => {
    const onPrompt = (e: Event) => {
      e.preventDefault();
      setDeferred(e as BIPEvent);
    };
    const onInstalled = () => setInstalled(true);
    window.addEventListener("beforeinstallprompt", onPrompt);
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", onPrompt);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  const triggerInstall = async () => {
    if (!deferred) return;
    await deferred.prompt();
    const choice = await deferred.userChoice;
    if (choice.outcome === "accepted") setInstalled(true);
    setDeferred(null);
  };

  return (
    <div className="min-h-screen bg-subtle-gradient">
      <header className="sticky top-0 z-10 flex items-center gap-3 border-b bg-background/85 px-4 py-3 backdrop-blur md:px-8">
        <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <h1 className="text-lg font-semibold">Baixar Aplicativo Mobile</h1>
      </header>

      <main className="mx-auto max-w-3xl space-y-6 p-4 md:p-8">
        <Card className="overflow-hidden p-6 shadow-elevated md:p-10">
          <div className="flex flex-col items-center text-center">
            <div className="rounded-2xl bg-white p-3 shadow-soft">
              <Logo size="lg" />
            </div>
            <h2 className="mt-4 text-2xl font-bold">MedControl CRM no seu celular</h2>
            <p className="mt-2 max-w-lg text-sm text-muted-foreground">
              Instale o MedControl como um aplicativo nativo no seu celular: ícone na tela inicial,
              tela cheia, acesso rápido e localização GPS funcionando perfeitamente nos cadastros.
            </p>

            {isStandalone || installed ? (
              <div className="mt-6 inline-flex items-center gap-2 rounded-full bg-success/10 px-4 py-2 text-sm font-medium text-success">
                <CheckCircle2 className="h-4 w-4" /> Aplicativo já instalado
              </div>
            ) : deferred ? (
              <Button onClick={triggerInstall} variant="brand" size="lg" className="mt-6">
                <Download className="h-4 w-4" /> Instalar agora
              </Button>
            ) : null}
          </div>
        </Card>

        {/* Android / Chrome */}
        <Card className="p-6 shadow-soft">
          <div className="mb-4 flex items-center gap-3">
            <div className="rounded-lg bg-primary/10 p-2 text-primary">
              <Smartphone className="h-5 w-5" />
            </div>
            <h3 className="text-lg font-semibold">No Android (Chrome)</h3>
          </div>
          <ol className="space-y-2 text-sm text-muted-foreground">
            <li><strong className="text-foreground">1.</strong> Abra esta página no Chrome do seu Android.</li>
            <li><strong className="text-foreground">2.</strong> Toque no botão <em>Instalar agora</em> acima — ou no menu (⋮) do Chrome → <em>Instalar app</em>.</li>
            <li><strong className="text-foreground">3.</strong> Confirme. O ícone do MedControl aparecerá na tela inicial.</li>
          </ol>
          {isAndroid && !deferred && !isStandalone && (
            <div className="mt-3 rounded-lg bg-muted p-3 text-xs text-muted-foreground">
              Se o botão não aparecer, abra o menu (⋮) do navegador e escolha <strong>“Instalar app”</strong> ou <strong>“Adicionar à tela inicial”</strong>.
            </div>
          )}
        </Card>

        {/* iOS / Safari */}
        <Card className="p-6 shadow-soft">
          <div className="mb-4 flex items-center gap-3">
            <div className="rounded-lg bg-primary/10 p-2 text-primary">
              <Apple className="h-5 w-5" />
            </div>
            <h3 className="text-lg font-semibold">No iPhone / iPad (Safari)</h3>
          </div>
          <ol className="space-y-2 text-sm text-muted-foreground">
            <li><strong className="text-foreground">1.</strong> Abra esta página no <strong>Safari</strong> (não funciona em outros navegadores).</li>
            <li className="flex items-start gap-2">
              <strong className="text-foreground">2.</strong>
              <span>
                Toque no ícone <Share className="inline h-4 w-4 align-text-bottom" /> <strong>Compartilhar</strong> na barra inferior.
              </span>
            </li>
            <li className="flex items-start gap-2">
              <strong className="text-foreground">3.</strong>
              <span>
                Role e selecione <Plus className="inline h-4 w-4 align-text-bottom" /> <strong>Adicionar à Tela de Início</strong>.
              </span>
            </li>
            <li><strong className="text-foreground">4.</strong> Confirme em <em>Adicionar</em>. Pronto, o app aparecerá na tela do iPhone.</li>
          </ol>
          {isIOS && !isStandalone && (
            <div className="mt-3 rounded-lg bg-accent-soft p-3 text-xs text-accent">
              💡 Dica: no iPhone, a permissão de localização (GPS) só é solicitada após instalar como app.
            </div>
          )}
        </Card>

        {/* Desktop */}
        <Card className="p-6 shadow-soft">
          <div className="mb-4 flex items-center gap-3">
            <div className="rounded-lg bg-primary/10 p-2 text-primary">
              <Chrome className="h-5 w-5" />
            </div>
            <h3 className="text-lg font-semibold">No computador (Chrome / Edge)</h3>
          </div>
          <p className="text-sm text-muted-foreground">
            Você verá um ícone de instalação <Download className="inline h-3.5 w-3.5 align-text-bottom" /> na barra de endereços.
            Clique nele e confirme — o MedControl será instalado como um aplicativo de desktop.
          </p>
        </Card>

        <div className="text-center text-xs text-muted-foreground">
          O MedControl funciona como Progressive Web App (PWA) — sem precisar de loja de aplicativos,
          com atualizações automáticas e funcionamento offline para telas já visitadas.
        </div>
      </main>
    </div>
  );
}
