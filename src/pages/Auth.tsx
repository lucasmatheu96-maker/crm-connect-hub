import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable/index";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Logo } from "@/components/Logo";
import { toast } from "sonner";
import { Loader2, ShieldAlert } from "lucide-react";

export default function AuthPage() {
  const navigate = useNavigate();
  const { user, loading } = useAuth();
  const [busy, setBusy] = useState(false);
  const [blockedReason, setBlockedReason] = useState<string | null>(null);

  useEffect(() => {
    const check = async () => {
      if (loading || !user) return;

      // Verifica se o e-mail logado está autorizado
      const { data, error } = await supabase.rpc("is_current_user_authorized");
      if (error) {
        console.error("Erro ao validar autorização:", error);
      }

      if (data === true) {
        // Registra login bem-sucedido (best-effort)
        await supabase.from("access_logs").insert({
          email: user.email, user_id: user.id,
          action: "login", success: true,
          provider: (user.app_metadata as any)?.provider || "google",
          user_agent: navigator.userAgent,
        });
        navigate("/", { replace: true });
      } else {
        // Não autorizado: desloga e mostra mensagem
        setBlockedReason(user.email || "");
        await supabase.auth.signOut();
        toast.error("Acesso não autorizado. Entre em contato com o administrador.");
      }
    };
    check();
  }, [user, loading, navigate]);

  const handleGoogle = async () => {
    setBusy(true);
    setBlockedReason(null);
    const result = await lovable.auth.signInWithOAuth("google", {
      redirect_uri: window.location.origin,
      extraParams: { prompt: "select_account" },
    });
    if (result.error) {
      setBusy(false);
      toast.error("Erro ao entrar com Google");
      return;
    }
    if (result.redirected) return;
    // Após sessão estabelecida, useEffect acima fará a checagem.
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-brand-strong p-4">
      <div className="w-full max-w-md">
        <div className="mb-8 flex flex-col items-center gap-3 text-center">
          <div className="rounded-2xl bg-white/95 p-4 shadow-floating">
            <Logo size="lg" />
          </div>
          <h1 className="text-2xl font-bold text-white">CRM MedControl</h1>
          <p className="text-sm text-white/80">Gestão completa de clientes, vendas e oportunidades</p>
        </div>

        <Card className="p-6 shadow-floating">
          <div className="text-center mb-6">
            <h2 className="text-lg font-semibold">Entrar no sistema</h2>
            <p className="text-xs text-muted-foreground mt-1">
              O acesso é exclusivo via Google para e-mails previamente autorizados pelo administrador.
            </p>
          </div>

          {blockedReason && (
            <div className="mb-4 flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
              <ShieldAlert className="h-4 w-4 mt-0.5 flex-shrink-0" />
              <div>
                <p className="font-medium">Acesso negado</p>
                <p className="text-xs mt-0.5 opacity-90">
                  O e-mail <strong>{blockedReason}</strong> não está autorizado. Solicite ao administrador para liberar seu cadastro.
                </p>
              </div>
            </div>
          )}

          <Button type="button" variant="brand" size="lg" className="w-full" onClick={handleGoogle} disabled={busy}>
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : (
              <>
                <svg className="mr-2 h-4 w-4" viewBox="0 0 24 24"><path fill="#fff" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/><path fill="#fff" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" opacity=".85"/><path fill="#fff" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" opacity=".7"/><path fill="#fff" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" opacity=".55"/></svg>
                Continuar com Google
              </>
            )}
          </Button>

          <p className="mt-6 text-center text-[11px] text-muted-foreground">
            Ao continuar, você concorda em ter seu acesso registrado para fins de auditoria.
          </p>
        </Card>
      </div>
    </div>
  );
}
