import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

type Role = "admin" | "vendedor";

interface AuthContextValue {
  session: Session | null;
  user: User | null;
  role: Role | null;
  loading: boolean;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue>({
  session: null,
  user: null,
  role: null,
  loading: true,
  signOut: async () => {},
});

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [role, setRole] = useState<Role | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // 1) listener primeiro
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, newSession) => {
      setSession(newSession);
      setUser(newSession?.user ?? null);
      if (newSession?.user) {
        // Diferir consulta para evitar deadlock com auth state
        setTimeout(() => {
          fetchRole(newSession.user.id);
        }, 0);

        // Registra login real (não dispara em TOKEN_REFRESHED nem USER_UPDATED)
        if (event === "SIGNED_IN") {
          const u = newSession.user;
          const key = `access_log_login_${u.id}_${newSession.access_token?.slice(-10)}`;
          if (!sessionStorage.getItem(key)) {
            sessionStorage.setItem(key, "1");
            setTimeout(() => {
              supabase.from("access_logs").insert({
                email: u.email,
                user_id: u.id,
                action: "login",
                success: true,
                provider: (u.app_metadata as any)?.provider || "google",
                user_agent: navigator.userAgent,
              }).then(({ error }) => {
                if (error) console.warn("[access_logs] login insert failed", error.message);
              });
            }, 0);
          }
        }
      } else {
        setRole(null);
        if (event === "SIGNED_OUT") {
          // best-effort: o user já foi limpo, então só logamos se tivermos email no estado anterior
        }
      }
    });

    // 2) Sessão inicial
    supabase.auth.getSession().then(({ data: { session: s } }) => {
      setSession(s);
      setUser(s?.user ?? null);
      if (s?.user) fetchRole(s.user.id);
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  const fetchRole = async (uid: string) => {
    const { data } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", uid)
      .order("role", { ascending: true })
      .limit(1)
      .maybeSingle();
    setRole((data?.role as Role) ?? "vendedor");
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    setSession(null);
    setUser(null);
    setRole(null);
  };

  return (
    <AuthContext.Provider value={{ session, user, role, loading, signOut }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
