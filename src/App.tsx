import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider } from "@/hooks/useAuth";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { AppLayout } from "@/components/AppLayout";
import Index from "./pages/Index";
import Auth from "./pages/Auth";
import Clientes from "./pages/Clientes";
import Produtos from "./pages/Produtos";
import Orcamentos from "./pages/Orcamentos";
import Pedidos from "./pages/Pedidos";
import Funil from "./pages/Funil";
import Configuracoes from "./pages/Configuracoes";
import Install from "./pages/Install";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const Protected = ({ children, admin = false }: any) => (
  <ProtectedRoute requireAdmin={admin}><AppLayout>{children}</AppLayout></ProtectedRoute>
);

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner position="top-right" />
      <BrowserRouter>
        <AuthProvider>
          <Routes>
            <Route path="/auth" element={<Auth />} />
            <Route path="/install" element={<Install />} />
            <Route path="/" element={<Protected><Index /></Protected>} />
            <Route path="/clientes" element={<Protected><Clientes /></Protected>} />
            <Route path="/produtos" element={<Protected><Produtos /></Protected>} />
            <Route path="/orcamentos" element={<Protected><Orcamentos /></Protected>} />
            <Route path="/pedidos" element={<Protected><Pedidos /></Protected>} />
            <Route path="/funil" element={<Protected><Funil /></Protected>} />
            <Route path="/configuracoes" element={<Protected admin><Configuracoes /></Protected>} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
