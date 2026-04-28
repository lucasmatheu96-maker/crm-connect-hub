import { ReactNode } from "react";
import { NavLink, useLocation } from "react-router-dom";
import {
  LayoutDashboard, Users, Package, FileText, ShoppingCart, Trello, Settings, LogOut, Smartphone, Download, ShieldCheck,
} from "lucide-react";
import { Logo } from "@/components/Logo";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";
import { cn } from "@/lib/utils";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
  DropdownMenuLabel, DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { OnboardingPermissions } from "@/components/OnboardingPermissions";

const nav = [
  { to: "/", label: "Dashboard", icon: LayoutDashboard, end: true },
  { to: "/clientes", label: "Clientes", icon: Users },
  { to: "/produtos", label: "Produtos", icon: Package },
  { to: "/orcamentos", label: "Orçamentos", icon: FileText },
  { to: "/pedidos", label: "Pedidos", icon: ShoppingCart },
  { to: "/funil", label: "Funil de Vendas", icon: Trello },
];

export const AppLayout = ({ children }: { children: ReactNode }) => {
  const { user, role, signOut } = useAuth();
  const location = useLocation();

  const initials = (user?.user_metadata?.nome || user?.email || "U")
    .split(" ").map((s: string) => s[0]).slice(0, 2).join("").toUpperCase();

  const currentTitle = nav.find((n) => n.end ? location.pathname === n.to : location.pathname.startsWith(n.to))?.label
    || (location.pathname.startsWith("/configuracoes") ? "Configurações" : "MedControl");

  return (
    <div className="flex min-h-screen bg-subtle-gradient">
      <OnboardingPermissions />
      {/* Sidebar */}
      <aside className="hidden w-64 flex-col bg-sidebar text-sidebar-foreground md:flex">
        <div className="flex items-center gap-3 px-5 py-5 border-b border-sidebar-border">
          <div className="rounded-lg bg-white p-1.5">
            <Logo size="sm" />
          </div>
          <div className="flex flex-col">
            <span className="font-bold text-sm">MedControl</span>
            <span className="text-[10px] uppercase tracking-widest text-sidebar-foreground/60">CRM</span>
          </div>
        </div>

        <nav className="flex-1 space-y-1 p-3">
          {nav.map(({ to, label, icon: Icon, end }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              className={({ isActive }) =>
                cn(
                  "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
                  isActive
                    ? "bg-sidebar-primary text-sidebar-primary-foreground shadow-soft"
                    : "text-sidebar-foreground/80 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
                )
              }
            >
              <Icon className="h-4 w-4" />
              {label}
            </NavLink>
          ))}

          {role === "admin" && (
            <>
              <NavLink
                to="/usuarios"
                className={({ isActive }) =>
                  cn(
                    "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
                    isActive
                      ? "bg-sidebar-primary text-sidebar-primary-foreground shadow-soft"
                      : "text-sidebar-foreground/80 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
                  )
                }
              >
                <ShieldCheck className="h-4 w-4" />
                Usuários
              </NavLink>
              <NavLink
                to="/configuracoes"
                className={({ isActive }) =>
                  cn(
                    "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
                    isActive
                      ? "bg-sidebar-primary text-sidebar-primary-foreground shadow-soft"
                      : "text-sidebar-foreground/80 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
                  )
                }
              >
                <Settings className="h-4 w-4" />
                Configurações
              </NavLink>
            </>
          )}

          <NavLink
            to="/install"
            className={({ isActive }) =>
              cn(
                "mt-2 flex items-center gap-3 rounded-lg border border-dashed border-sidebar-border/60 px-3 py-2.5 text-sm font-medium transition-colors",
                isActive
                  ? "bg-sidebar-primary text-sidebar-primary-foreground shadow-soft"
                  : "text-sidebar-foreground/80 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
              )
            }
          >
            <Smartphone className="h-4 w-4" />
            Baixar Aplicativo Mobile
          </NavLink>
        </nav>

        <div className="border-t border-sidebar-border p-3">
          <div className="rounded-lg bg-sidebar-accent/40 px-3 py-2.5 text-xs text-sidebar-foreground/70">
            <div className="font-medium text-sidebar-foreground">{user?.user_metadata?.nome || user?.email}</div>
            <Badge variant="outline" className="mt-1 border-sidebar-border bg-transparent text-[10px] uppercase tracking-wider text-sidebar-foreground/80">
              {role || "vendedor"}
            </Badge>
          </div>
        </div>
      </aside>

      {/* Main */}
      <div className="flex flex-1 flex-col">
        <header className="sticky top-0 z-20 flex h-16 items-center justify-between border-b bg-background/85 px-4 backdrop-blur md:px-8">
          <div className="flex items-center gap-3">
            <div className="md:hidden">
              <Logo size="sm" />
            </div>
            <h1 className="text-lg font-semibold">{currentTitle}</h1>
          </div>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" className="gap-2 px-2">
                <Avatar className="h-8 w-8">
                  <AvatarFallback className="bg-brand-gradient text-primary-foreground text-xs font-semibold">
                    {initials}
                  </AvatarFallback>
                </Avatar>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuLabel>
                <div className="flex flex-col">
                  <span className="text-sm font-medium">{user?.user_metadata?.nome || "Usuário"}</span>
                  <span className="text-xs text-muted-foreground">{user?.email}</span>
                </div>
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => (window.location.href = "/install")}>
                <Download className="mr-2 h-4 w-4" /> Baixar Aplicativo Mobile
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={signOut} className="text-destructive">
                <LogOut className="mr-2 h-4 w-4" /> Sair
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </header>

        <main className="flex-1 p-4 md:p-8">{children}</main>

        {/* Mobile bottom nav */}
        <nav className="sticky bottom-0 z-20 flex border-t bg-background md:hidden">
          {nav.slice(0, 5).map(({ to, label, icon: Icon, end }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              className={({ isActive }) =>
                cn(
                  "flex flex-1 flex-col items-center gap-1 py-2 text-[10px]",
                  isActive ? "text-primary" : "text-muted-foreground",
                )
              }
            >
              <Icon className="h-5 w-5" />
              {label}
            </NavLink>
          ))}
        </nav>
      </div>
    </div>
  );
};
